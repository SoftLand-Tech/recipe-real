# MVP: RecipeReal

## Goal
Prove that home cooks will use a cooking app whose core value is honest, calibrated cook-time estimates — not recipe generation — and that stopwatch-native timing data from guided Cook Mode sessions becomes accurate enough that users trust it enough to plan their actual evenings around it.

## Core Value Loop
1. **Recipe → 3-Skill Estimate → Cook Mode → Log → Calibrate**: User picks a recipe → sees three time estimates (novice / intermediate / expert) with cleanup included → cooks in guided Cook Mode with per-step timers → logs "how did that go?" (faster / as expected / slower) → next recipe shows their personal pace overlay.
2. The "aha" is "I knew this would take 52 minutes before I started chopping, and it actually took 49 — for the first time in my cooking life, the estimate was right."

## Clever Simplifications
- **Web-first PWA instead of React Native + Expo**: Research confirms PWAs validate demand 2–3x faster than native apps — ship in days, not weeks. Service workers + IndexedDB provide offline-first storage; Web Audio API handles audio cues; push notifications work on Android and iOS (with home-screen install). The core timing engine doesn't need native APIs. Port to React Native only after traction proves demand. Eliminates EAS builds, App Store review, and native debugging overhead.
- **Pre-seeded recipe library instead of AI parsing pipeline**: The reviewer's draft relies on Schema.org parsing (~49% success rate) + OpenAI GPT-4o-mini for step tagging. Research confirms AI recipe parsing has known accuracy issues (wrong ingredients, missed steps, ~$18/month API cost). Instead, pre-seed 200 recipes with manually verified timing data across 3 skill levels. The recipe database IS the product — own it from day one. Cut OpenAI entirely from MVP. Eliminates API cost, parsing complexity, and hallucination risk.
- **Single-question logging instead of complex pace calibration**: Replace multi-step pace calibration with "how did that go?" (faster / as expected / slower). One tap, immediate payoff. Aggregate responses into a simple multiplier. No complex outlier detection, no step-by-step timing, no confidence intervals. Less code, less friction, proven to work. Reviewer's frictionless design.
- **Community averages instead of skill-level stratified timing MVP**: Start with community averages from 200 seed recipes. Add skill-level stratification post-MVP once you have enough data. Proves the timing concept without the complexity of building distributions from scratch.
- **Supabase Auth instead of Clerk**: Already using Supabase for Postgres. Supabase Auth is free to 50K MAU, integrates natively with Row Level Security, costs 6x less at scale ($0.00325/MAU overage vs Clerk's $0.02/MRU). Eliminates one external dependency and one bill.

## Scope

**IN**:
- Web-first PWA with offline-first storage (IndexedDB via Dexie.js) — reviewer keeps React Native + Expo as target, but PWA validates faster; reviewer says "shippable in 8 weeks"
- Cook Mode with per-step timers and one-tap completion (reviewer keeps as core primitive; offline-first, audio cues, hands-free)
- Crowdsourced timing engine — stopwatch-verified Cook Mode sessions only (reviewer explicitly defines verification as Cook Mode-only logging; no manual time entry, anti-gaming via consistency)
- Simple per-user pace calibration — "how did that go?" post-cook log (3 options: faster / as expected / slower); immediate personalized payoff (reviewer explicitly redesigns to minimize friction)
- Cleanup-inclusive total time — simple dish-burden estimate (reviewer keeps; "30 min cook + 12 min cleanup = 42 min total")
- Free/Premium tier gating with Stripe — Free: 5 recipes/month, basic timing; Premium ($5.99/mo): unlimited, pace calibration, cleanup estimates (reviewer keeps pricing anchor)
- 200 pre-seeded recipes with manual timing data (reviewer cuts URL import + AI parsing to P1; seed data proves concept)

**OUT**:
- Recipe URL import + AI step parsing (deferred: reviewer says 2–3 week sub-project with uncertain success rate; validate with 100-recipe parsing test post-MVP)
- Skill-level stratified timing (deferred: start with community averages; add novice/intermediate/expert post-MVP once data volume justifies it)
- Interruption penalty modeling (deferred: reviewer says multipliers are untested assumptions; run 10-user logging study first to derive actual multipliers)
- Instacart grocery handoff (deferred: reviewer explicitly drops from MVP; not in PRD P0 anyway)
- Timing karma gamification (deferred: reviewer cuts; simplify to basic submission without karma)
- Household tier ($8.99/mo) (deferred: reviewer adds post-MVP)
- YouTube/TikTok/Instagram video recipe import (deferred: reviewer explicitly drops; not needed for MVP)
- AI chat for timing explanations (deferred: not in MVP scope; static tooltips suffice)
- Resend email / Sentry monitoring (deferred: reviewer drops both; Expo Notifications or Firebase Cloud Messaging for push only)

## Tech Stack
- **Frontend**: Next.js 15 + PWA (web-first). Research confirms PWAs validate demand 2–3x faster than React Native for MVPs. Service workers + IndexedDB provide offline-first. Ship in days, not weeks. Port to React Native + Expo after traction.
- **Backend**: Supabase (PostgreSQL + Edge Functions). Handles timing logs, crowdsourced distributions, pace calibration, and recipe metadata.
- **Database**: PostgreSQL via Supabase for cloud data; IndexedDB via Dexie.js for offline-first PWA storage. Standard relational model for users, recipes, steps, timing submissions, and pace calibrations.
- **AI**: None in P0. Reviewer cuts OpenAI from MVP; pre-seed timing data manually. Static tooltips replace AI chat.
- **Auth**: Supabase Auth. Free to 50K MAU, integrates with Postgres RLS, 6x cheaper at scale than Clerk. Eliminates one external dependency.
- **Hosting**: Vercel for Next.js PWA, Supabase for backend. Zero infra management; scales to first 1K users.

## Data Model

```
users (id, email, skill_level, created_at)
profiles (id, user_id, display_name, cleanup_speed, created_at)
recipes (id, title, source_url, ingredients JSON, steps JSON, publisher_time_minutes, community_avg_minutes, cleanup_avg_minutes, created_at)
recipe_steps (id, recipe_id, step_number, description, step_type, publisher_minutes, community_avg_minutes, created_at)
timing_submissions (id, user_id, recipe_step_id, actual_minutes, session_id, created_at)
pace_calibrations (id, user_id, step_type, personal_avg_minutes, community_avg_minutes, confidence, created_at)
cook_sessions (id, user_id, recipe_id, total_actual_minutes, cleanup_minutes, rating, created_at)
```

## Integration Wiring

| Integration | What it does in MVP | Pricing | The one call that matters |
|-------------|---------------------|---------|---------------------------|
| **Supabase Auth** | Email/password signup, session management | Free to 50K MAU | `supabase.auth.signUp()` + `supabase.auth.signInWithPassword()` |
| **Supabase Postgres** | User timing logs, crowdsourced distributions, pace calibration | Free to 500MB DB | Standard CRUD via `supabase-js` client |
| **Stripe Checkout** | Single subscription product ($5.99/mo or $49.99/yr) | 2.9% + $0.30/txn, no monthly fee | `POST /v1/checkout/sessions` with `mode=subscription` |
| **Resend** | Account confirmation + password reset emails | Free to 3,000 emails/mo (100/day) | `POST /v1/emails` with transaction template |

**Cut from draft**: OpenAI API (pre-seeded data instead); Clerk (use Supabase Auth instead); Stripe Billing (use Checkout instead — saves 0.7% fee); React Native + Expo (use PWA instead for faster validation); Schema.org parser (manual seed instead).

**Fallback**: If Stripe Checkout subscription API doesn't support annual billing in your region, fall back to one-time $49.99/year "credits" purchased via Stripe Checkout `mode=payment`.

## Week-by-Week Build Plan

**Week 1: Timing Data Foundation + PWA Scaffold**
- Goal: Prove the data layer and offline-first PWA before building the full app.
- Deliverable: 50 recipes manually timed across 3 skill levels load into Supabase; PWA scaffold with IndexedDB offline storage; recipe list view with community averages.
- Tasks: Manually time 50 popular recipes with stopwatch (reviewer's explicit pre-sprint validation), tag steps as active/passive/cleanup, document outlier handling rules, build Next.js 15 PWA scaffold with service worker + Dexie.js for offline storage, Supabase project setup + schema, recipe list and detail views with community averages. **This week tackles the two riskiest assumptions: (1) manual seed data is good enough to feel real, and (2) users will engage with a web-based cooking timer.**

**Week 2: Cook Mode + Timing Submission**
- Goal: Guided cooking with automatic time logging.
- Deliverable: User taps "Start Cooking" → full-screen Cook Mode with per-step timers → completes recipe → "how did that go?" prompt (faster / as expected / slower).
- Tasks: Build Cook Mode UI (full-screen, large text, audio cues via Web Audio API, offline-first), per-step timers with one-tap completion, post-cook "how did that go?" log (3 options only — reviewer's frictionless design), timing submission creation, session summary view.

**Week 3: Pace Calibration Engine**
- Goal: Personal pace overlay on future recipes.
- Deliverable: After 3 logged cooks, user sees "your onion dice: 7.2 min vs. community 5.1 min" on recipe detail view.
- Tasks: Build pace calibration computation (aggregate user's timing submissions by step_type), personal pace overlay UI on recipe detail, calibration confidence indicator, "your pace" dashboard view, simple outlier handling (ignore sessions >2x community median).

**Week 4: Cleanup + Polish**
- Goal: Total time visibility with cleanup included.
- Deliverable: Recipe detail shows "focused: 35 min / cleanup: 12 min / total: 47 min" — simple and clear.
- Tasks: Build cleanup-inclusive total time calculation, dish-burden taxonomy (pan count, washer-safe vs. hand-wash, grease difficulty), cleanup estimate UI, total time display with all components visible, responsive design for mobile/tablet/desktop.

**Week 5: Free/Premium Gating + Stripe**
- Goal: Subscription billing and feature gates.
- Deliverable: Free tier (5 recipes/month, basic timing, Cook Mode) and Premium ($5.99/mo or $49.99/yr, unlimited recipes, pace calibration, cleanup estimates) with Stripe Checkout.
- Tasks: Stripe Checkout integration (annual subscription), premium gating UI, upgrade flow, webhook handling for subscription status, usage tracking for free tier limit.

**Week 6: Beta Recruitment + Customer Development**
- Goal: Validate core loop with real cooks before polish.
- Deliverable: 20–30 beta users from r/cookingforbeginners, r/Cooking, r/MealPrepSunday; structured feedback on timing accuracy and Cook Mode usability.
- Tasks: Recruit via Reddit and food blogger partners, ship beta (Vercel preview URLs), conduct short interviews, collect completion rates, pace calibration accuracy feedback, and upgrade intent.

**Week 7: Bug Bash + Recipe Expansion**
- Goal: Fix critical issues and expand recipe library.
- Deliverable: 200 recipes in library; critical Cook Mode bugs fixed; step-parsing accuracy validated on 100 random URLs (post-MVP gate).
- Tasks: Bug fixes from beta, expand recipe library via manual curation + Schema.org ingestion, validate AI step-parsing success rate on 100 random URLs (reviewer's explicit gate for P1), cleanup score calibration, editorial workflow for recipe curation.

**Week 8: Launch**
- Goal: Public launch with validated core loop.
- Deliverable: Live on web; first 100 users; Cook Mode + pace calibration working; Stripe billing live.
- Tasks: Deploy to Vercel, launch page, HN/Reddit post, analytics setup (activation funnel, retention, cook sessions logged, pace calibration accuracy, revenue), monitor crash reports and user feedback.

## Success Criteria
- **Recipe seeding**: 50 manually-timed recipes with <10% outlier rate across 3 skill levels.
- **Activation**: >30% of signups log their first cook time within 7 days.
- **Retention**: >50% D30 retention for users who complete at least one Cook Mode session.
- **Pace calibration**: <15% error rate vs. user's actual time after 5 logged cooks.
- **Engagement**: >3 recipes viewed per user per month; >2 cook sessions logged per user per month; >60% of Cook Mode sessions result in a "how did that go?" log.
- **Revenue**: First paying user within 30 days; >$2K MRR at 6 months.
- **Qualitative**: ≥10 beta users say "I would have used this last month" or "this made me trust a recipe estimate for the first time."

## Post-MVP (what comes next)
1. Recipe URL import + AI step parsing — after 100-URL parsing test validates >60% success rate
2. Interruption penalty modeling — after 10-user logging study derives actual multipliers
3. React Native + Expo port — after web traction proves demand
4. Skill-level stratified timing — once data volume justifies 3-skill distributions
5. Timing karma gamification — streaks, badges, community leaderboard for accurate submitters
6. Meal kit / grocery delivery partnerships — Instacart integration for shoppable recipes
