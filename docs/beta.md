# RecipeReal — Beta Program Playbook (Week 6)

This doc covers the **human/operational** side of the beta. The code-able
parts (EAS build config, analytics instrumentation) are already in the repo:
- `mobile/eas.json` — build profiles (development / preview / production).
- `mobile/src/analytics.ts` + instrumentation — funnels are tracked via
  `POST /api/events` (see `analytics_events` table).

> Everything below requires accounts that cannot be created from a dev
> machine automatically: an Expo account, an Apple Developer account
> ($99/yr), and a Google Play Console account ($25 one-time). A human must
> run the builds and recruit users.

## 1. Build the beta binaries (EAS)

```bash
cd mobile
npm install -g eas-cli
eas login                       # Expo account
eas init                        # links the project, sets expo.extra.eas.projectId

# iOS internal (TestFlight) + Android internal (Play Console)
eas build --profile preview --platform ios
eas build --profile preview --platform android
```

- `preview` uses `distribution: internal` → installable by internal testers
  without store review. For iOS, register tester devices in the Expo
  dashboard or submit to TestFlight via `eas submit --platform ios`.
- For Android, download the APK (or AAB) and upload to Play Console →
  Internal Testing.

## 2. Recruit 20–30 beta users

Targeted subreddits (the spec's plan):
- r/CookingforBeginners, r/Cooking, r/MealPrepSunday
- Post framing: "I'm building an app that tells you the *honest* cook time
  (including cleanup) before you start — looking for 25 testers."

Ask testers to cook ≥3 recipes in Cook Mode so each one generates timing
submissions and unlocks their personal pace overlay.

## 3. What we measure (already instrumented)

Activation / engagement events (in `analytics_events`):
- `app_open`, `recipe_viewed`, `cook_started`, `cook_completed`
  (with `total_actual_minutes` + `feedback`),
  `pace_viewed`, `upgrade_viewed`, `upgrade_checkout_opened`.

Funnel queries (run on the server):
- **Activation**: % of signups with a `cook_completed` within 7 days.
- **Cook Mode completion**: `cook_completed / cook_started`.
- **Feedback rate**: `cook_completed` events with non-null feedback.
- **Retention**: distinct users with `app_open` on day N.
- **Upgrade intent**: `upgrade_viewed → upgrade_checkout_opened`.

Example:
```bash
php artisan tinker --execute='echo App\Models\AnalyticsEvent::select("name", DB::raw("count(*) c"))->groupBy("name")->orderByDesc("c")->get();'
```

## 4. Collect qualitative feedback

- A short Typeform/Google Form linked from the recruitment post.
- Focus questions on: timing accuracy, Cook Mode usability, the "aha" moment
  ("the estimate was right for the first time"), and upgrade intent.
- Target the spec's success bar: ≥10 beta users say "I would have used this
  last month" / "this made me trust a recipe estimate for the first time."

## 5. Out of scope here (needs humans/accounts)
- Creating Expo / Apple / Google accounts.
- Running `eas build` / submitting to TestFlight + Play Internal.
- Reddit recruitment and managing the beta cohort.
