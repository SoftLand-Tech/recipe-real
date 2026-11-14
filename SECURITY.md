# Security Policy

## Supported versions

| Version | Supported |
|---|---|
| 1.1.x (current) | Supported |
| < 1.1 | Not supported (upgrade to the latest APK) |

## Reporting a vulnerability

**Do not open a public issue, discussion, or PR for security reports.**

Email **mamounprogrammer@gmail.com** with:

- A description of the vulnerability and its impact
- Steps to reproduce (requests, payloads, device/build where relevant)
- Any affected endpoints, screens, or versions

What to expect:

- Acknowledgement within **72 hours**
- Status updates at least weekly until resolved
- Credit in the release notes if you want it (opt-in)

## Scope notes

- The API lives at `recipe-real.softland.tech`; please avoid destructive testing (no mass account creation, spam, or DoS).
- Secrets (API keys, keystores, OAuth clients) must never be committed — CI scans PRs for common patterns.
- Account deletion (`DELETE /api/account`, Settings → Danger zone, and `/account/delete`) is a store-policy surface: deletion bugs are treated as high severity.
