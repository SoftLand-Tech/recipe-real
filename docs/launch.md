# RecipeReal — Launch Playbook (Week 8)

The code-able launch pieces (production cache readiness, public landing page,
`recipereal:stats` funnel command) are in the repo. This doc covers the
**human/account** steps you cannot automate from a dev machine.

## Production backend deployment
1. Provision a PHP host (Laravel Forge / Vapor / a VPS with PHP 8.5 + a web
   server). Point the web root at `backend/public/`.
2. Set production env (copy `backend/.env.example`):
   - `APP_ENV=production`, `APP_DEBUG=false`, `APP_URL=https://api.yourdomain`.
   - DB credentials (MySQL/Postgres recommended over sqlite for production).
   - `QUEUE_CONNECTION=database` (or redis) — the pace-calibration job needs a
     worker: run `php artisan queue:work` under a process manager (Supervisor),
     or use Laravel Horizon.
   - Stripe: `STRIPE_KEY`, `STRIPE_SECRET`, `STRIPE_WEBHOOK_SECRET`,
     `STRIPE_PRICE_MONTHLY`, `STRIPE_PRICE_YEARLY` (create these Products/Prices
     in the Stripe dashboard). **Webhook is signature-protected only when
     `STRIPE_WEBHOOK_SECRET` is set** — mandatory in prod. Point the Stripe
     webhook at `POST https://api.yourdomain/api/stripe/webhook`.
3. Deploy + warm caches:
   ```
   php artisan migrate --force
   php artisan config:cache && php artisan route:cache && php artisan view:cache && php artisan event:cache
   php artisan queue:restart   # if a worker is running
   ```
4. Cron entry for scheduled jobs (weekly digest, etc.):
   `* * * * * cd /path/backend && php artisan schedule:run >> /dev/null 2>&1`

## Mobile — store submission (EAS)
```bash
cd mobile
eas build --profile production --platform ios      # requires Apple Developer account
eas build --profile production --platform android   # requires Google Play Console
eas submit --platform ios        # -> App Store Connect / TestFlight
eas submit --platform android    # -> Play Console
```
Prepare in the store consoles: app title/description, screenshots, privacy
policy URL, the `com.recipereal.app` bundle id/package, signing credentials,
and the API base URL (`expo.extra.reciperealApiBaseUrl` → production API).
OTA hotfixes: `eas update --branch production`.

## Funnel / success metrics
Run on the server (also available via the command):
```
php artisan recipereal:stats
```
Track against the spec's success criteria:
- Activation: >30% of signups log a first cook within 7 days.
- Retention: >50% D30 for users who complete a Cook Mode session.
- Pace accuracy: <15% error after 5 logged cooks.
- Engagement: >3 recipes viewed / user / month; >2 cook sessions / user / month;
  >60% of Cook Mode sessions get a "how did that go?" log.
- Revenue: first paying user within 30 days; >$2K MRR at 6 months.
- Qualitative: ≥10 beta users say "I would have used this last month."

## Launch distribution
- Show HN (with a "Show HN: I built an app that tells you the honest cook time"
  framing), r/Cooking, r/Cookingforbeginners, r/MealPrepSunday.
- Link the landing page (`GET /` on the API host) with app-store badges.

## Out of scope here (needs humans/accounts)
- Provisioning hosting + DB; configuring Stripe products/webhook; cron/worker.
- Apple/Google developer accounts; building + submitting binaries; store
  listings/screenshots; signing.
- Writing and posting the HN/Reddit launch content.
