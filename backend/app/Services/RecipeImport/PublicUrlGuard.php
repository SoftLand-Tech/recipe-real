<?php

namespace App\Services\RecipeImport;

use InvalidArgumentException;

/**
 * SSRF guard for user-supplied source URLs (recipe imports + resolver
 * thumbnails).
 *
 * String blocklists alone lose to DNS: an attacker controls both the URL
 * and the answer, so "resolve the name and check the first record" still
 * lets a hostname that answers public on one record and 10.x on another
 * through. This guard therefore:
 *
 *   1. rejects non-canonical host spellings that bypass naive checks
 *      (pure-numeric IPv4 like 2130706433, hex 0x7f000001, mixed-octal
 *      0177.0.0.1, short forms like 127.1, malformed IPv6 literals);
 *   2. short-circuits literal IPs (never hitting DNS) through a full
 *      private/reserved range check;
 *   3. resolves hostnames to EVERY A + AAAA record and requires all of
 *      them to be public.
 *
 * Callers keep the same public API: assertPublic() throws
 * InvalidArgumentException on anything non-public.
 */
class PublicUrlGuard
{
    public function assertPublic(string $url): void
    {
        $parts = parse_url($url);
        $scheme = strtolower((string) ($parts['scheme'] ?? ''));
        $host = strtolower((string) ($parts['host'] ?? ''));

        if (! in_array($scheme, ['http', 'https'], true) || $host === '') {
            throw new InvalidArgumentException('The source URL must be an http(s) URL.');
        }

        // Bracketed IPv6 literal: strict validation only — no zone/scope
        // ids, no compressed-but-invalid shapes.
        if (str_starts_with($host, '[')) {
            $ip = trim($host, '[]');

            if (filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_IPV6) === false) {
                throw new InvalidArgumentException('Private source URLs are not allowed.');
            }

            if (! $this->ipIsPublic($ip)) {
                throw new InvalidArgumentException('Private source URLs are not allowed.');
            }

            return;
        }

        // Canonical dotted-quad IPv4 literal: vet it directly, no DNS.
        if (filter_var($host, FILTER_VALIDATE_IP, FILTER_FLAG_IPV4) !== false) {
            if (! $this->ipIsPublic($host)) {
                throw new InvalidArgumentException('Private source URLs are not allowed.');
            }

            return;
        }

        // Non-canonical encodings: anything that is neither a strict IPv4
        // literal nor a clean hostname (digits/dots only → 2130706433,
        // 127.1, 0177.0.0.1; 0x-prefixed → hex forms; or characters
        // outside the hostname alphabet) is rejected outright.
        if (
            preg_match('/^[0-9.]+$/', $host) === 1
            || str_starts_with($host, '0x')
            || preg_match('/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)*$/', $host) !== 1
        ) {
            throw new InvalidArgumentException('Private source URLs are not allowed.');
        }

        // Metadata + loopback names (checked before DNS so a hostile
        // resolver never gets consulted for them).
        if (
            $host === 'localhost'
            || str_ends_with($host, '.localhost')
            || $host === 'metadata.google.internal'
            || str_ends_with($host, '.internal')
            || $host === '169.254.169.254'
        ) {
            throw new InvalidArgumentException('Private source URLs are not allowed.');
        }

        // Hostname: resolve A + AAAA and vet EVERY address.
        $ips = $this->resolveIps($host);

        if ($ips === []) {
            // Unresolvable hostname: fail closed (a resolver outage must
            // not open the fetch path).
            throw new InvalidArgumentException('The source URL host could not be resolved.');
        }

        foreach ($ips as $ip) {
            if (! $this->ipIsPublic($ip)) {
                throw new InvalidArgumentException('Private source URLs are not allowed.');
            }
        }
    }

    /**
     * All A + AAAA addresses for a hostname (deduplicated). dns_get_record
     * first; plain gethostbyname as the fallback for hosts where the
     * records API is unavailable. Returns [] when nothing resolves.
     *
     * @return list<string>
     */
    private function resolveIps(string $host): array
    {
        $ips = [];

        $records = @dns_get_record($host, DNS_A | DNS_AAAA);

        if (is_array($records)) {
            foreach ($records as $record) {
                $type = strtoupper((string) ($record['type'] ?? ''));

                if ($type === 'A' && isset($record['ip'])) {
                    $ips[] = (string) $record['ip'];
                } elseif ($type === 'AAAA' && isset($record['ipv6'])) {
                    $ips[] = (string) $record['ipv6'];
                }
            }
        }

        if ($ips === []) {
            $v4 = @gethostbyname($host);

            if (
                is_string($v4)
                && $v4 !== $host
                && filter_var($v4, FILTER_VALIDATE_IP, FILTER_FLAG_IPV4) !== false
            ) {
                $ips[] = $v4;
            }
        }

        return array_values(array_unique($ips));
    }

    /**
     * True only for addresses that are unambiguously public. Two belts:
     * PHP's own private/reserved flags, then the explicit deny-list the
     * hardening brief calls out (ranges PHP's flags leave open, e.g.
     * CGNAT 100.64/10, benchmark 198.18/15, multicast 224/4).
     */
    private function ipIsPublic(string $ip): bool
    {
        // IPv4-mapped IPv6 (::ffff:127.0.0.1) — unwrap and re-check as v4.
        if (str_starts_with($ip, '::ffff:')) {
            $mapped = substr($ip, 7);

            if (filter_var($mapped, FILTER_VALIDATE_IP, FILTER_FLAG_IPV4) !== false) {
                $ip = $mapped;
            }
        }

        $isV4 = filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_IPV4) !== false;

        if (filter_var(
            $ip,
            FILTER_VALIDATE_IP,
            FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE,
        ) === false) {
            return false;
        }

        return $isV4 ? $this->v4IsPublic($ip) : $this->v6IsPublic($ip);
    }

    /**
     * Explicit v4 deny-list (network/bits): 0.0.0.0/8, 10/8, 100.64/10,
     * 127/8, 169.254/16, 172.16/12, 192.0.0/24, 192.168/16, 198.18/15,
     * 192.0.2/24, 198.51.100/24, 203.0.113/24 (documentation),
     * 224/4 (multicast) and 240/4 (reserved + broadcast).
     */
    private function v4IsPublic(string $ip): bool
    {
        $long = (int) sprintf('%u', (string) ip2long($ip));

        $denied = [
            [0xFF000000, 0x00000000], // 0.0.0.0/8        "this" network
            [0xFF000000, 0x0A000000], // 10/8             private
            [0xFFC00000, 0x64400000], // 100.64/10        CGNAT
            [0xFF000000, 0x7F000000], // 127/8            loopback
            [0xFFFF0000, 0xA9FE0000], // 169.254/16       link-local
            [0xFFF00000, 0xAC100000], // 172.16/12        private
            [0xFFFFFF00, 0xC0000000], // 192.0.0/24       IETF protocol
            [0xFFFFFF00, 0xC0000200], // 192.0.2/24       documentation
            [0xFFFF0000, 0xC0A80000], // 192.168/16       private
            [0xFFFFFF00, 0xC6336400], // 198.51.100/24    documentation
            [0xFFFE0000, 0xC6120000], // 198.18/15        benchmarking
            [0xFFFFFF00, 0xCB007100], // 203.0.113/24     documentation
            [0xF0000000, 0xE0000000], // 224/4            multicast
            [0xF0000000, 0xF0000000], // 240/4            reserved
        ];

        foreach ($denied as [$mask, $network]) {
            if (($long & $mask) === $network) {
                return false;
            }
        }

        return true;
    }

    /**
     * Explicit v6 deny-list: :: (unspecified), ::1 (loopback), fc00::/7
     * (unique local), fe80::/10 (link local) and 2001:db8::/32
     * (documentation). IPv4-mapped forms were already unwrapped by
     * ipIsPublic().
     */
    private function v6IsPublic(string $ip): bool
    {
        if ($ip === '::' || $ip === '::1') {
            return false;
        }

        $bytes = @inet_pton($ip);

        if ($bytes === false || strlen($bytes) !== 16) {
            return false;
        }

        $b0 = ord($bytes[0]);
        $b1 = ord($bytes[1]);

        // fc00::/7 → first 8 bits are 1111110x.
        if (($b0 & 0xFE) === 0xFC) {
            return false;
        }

        // fe80::/10 → first 10 bits are 1111111010.
        if ($b0 === 0xFE && ($b1 & 0xC0) === 0x80) {
            return false;
        }

        // 2001:db8::/32 → documentation range.
        if ($b0 === 0x20 && $b1 === 0x01 && ord($bytes[2]) === 0x0D && ord($bytes[3]) === 0xB8) {
            return false;
        }

        return true;
    }
}
