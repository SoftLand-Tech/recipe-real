# RecipeReal backend — production deploy runbook

The backend is deployed to **`https://recipe-real.softland.tech`** (Hetzner VPS
`qufran.com` / `188.245.213.35`), following the same Laravel pattern as the
other `*.softland.tech` apps on this box (e.g. seraty).

## Production setup at a glance
| What | Value |
|---|---|
| Repo | `SoftLand-Tech/recipe-real` (private, branch `main`) |
| Path on VPS | `/var/www/recipe-real` (backend at `backend/`) |
| Web root (nginx) | `/var/www/recipe-real/backend/public` |
| PHP | `php8.4-fpm` (socket `/var/run/php/php8.4-fpm.sock`); CLI `php` 8.4 |
| DB | **sqlite** at `backend/database/database.sqlite` |
| Queue + cache | **redis** (127.0.0.1); `QUEUE_CONNECTION=redis`, `CACHE_STORE=redis` |
| Queue worker | supervisor program `recipe-real-queue` |
| Cron | `/etc/cron.d/recipe-real` → `php artisan schedule:run` |
| TLS | Let's Encrypt via certbot (`--redirect` to HTTPS) |
| Landing page | `GET /` (the marketing page) |
| Env | `/var/www/recipe-real/backend/.env` (VPS-local, not in git) |

> **Billing decision (2026-08-15): Stripe will NOT be used** (no bank account).
> Monetization, when the MVP has real users, will move to **Gumroad** (external
> checkout + license-key verification). Until then all Stripe/Cashier env keys
> stay empty and billing endpoints keep returning 503 — this is safe: the
> webhook is inert without keys, and **no Stripe keys should ever be added**
> (doing so without `STRIPE_WEBHOOK_SECRET` would expose an unsigned webhook).
> When switching to Gumroad: add a license-key verification endpoint, replace
> `isPremium()`'s Cashier check with license state, and remove the Cashier
> dependency + billing routes.

## Deploy / update (one command)
From your local machine:
```bash
ssh root@qufran.com 'cd /var/www/recipe-real && ./deploy.sh'
```
`deploy.sh` (in the repo root) does: `git pull` → `composer install --no-dev -o`
→ `migrate --force` → re-cache config/routes/views/events → fix perms → restart
the supervisor queue worker → health-check.

## Verify
```bash
# API up
curl -s -o /dev/null -w "%{http_code}\n" https://recipe-real.softland.tech/api/recipes   # 200
# Landing page
curl -s https://recipe-real.softland.tech/ | grep -o "Honest cook-time"                   # matches
# Queue worker
ssh root@qufran.com 'supervisorctl status recipe-real-queue:*'
# Funnel metrics
ssh root@qufran.com 'cd /var/www/recipe-real/backend && php artisan recipereal:stats'
```

## Rollback
```bash
ssh root@qufran.com 'cd /var/www/recipe-real && \
  git log --oneline -5 && git checkout <good-sha> && \
  cd backend && composer install --no-dev --optimize-autoloader --no-interaction && \
  php artisan migrate --force && \
  php artisan config:cache && php artisan route:cache && \
  cd .. && chown -R www-data:www-data /var/www/recipe-real && \
  supervisorctl restart recipe-real-queue:*'
```
Then `git checkout main` so the next pull is clean.

## First-time setup (already done — for reference)
1. Created `SoftLand-Tech/recipe-real` (private) + pushed the monorepo.
2. On the VPS: `git clone git@github.com:SoftLand-Tech/recipe-real.git /var/www/recipe-real`.
3. `backend/`: `composer install --no-dev -o`, build prod `.env`, `key:generate`,
   `touch database/database.sqlite`, `migrate --force` + `db:seed` (200 recipes),
   `config/route/view/event:cache`.
4. nginx site (root `backend/public`, php8.4-fpm) + `certbot --nginx -d recipe-real.softland.tech --redirect`.
5. supervisor `recipe-real-queue` + `/etc/cron.d/recipe-real`.

(Mobile ships separately via EAS — see `docs/launch.md`. Point the app at this
API via `expo.extra.reciperealApiBaseUrl = https://recipe-real.softland.tech`.)
