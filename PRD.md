# PRD: RecipeReal

- **Category**: Kitchen & Cooking Time Friction
- **One-liner**: The only cooking app that crowdsources actual cook times from verified stopwatch sessions and calibrates every estimate to your personal pace — so you know the real time commitment before you start chopping, not the publisher's marketing number.
- **Status**: Enriched

---

## 1. Problem & Evidence

Home cooks routinely spend 2–4 hours on recipes advertised as "30 minutes" because published times systematically omit prep, cleanup, and the interruptions that define real kitchen life. A 2026 Recipy audit of 30 AI-generated recipes found an average 47% underestimate: a 25-minute mapo tofu from ChatGPT took 71 minutes; a 30-minute pad thai from Gemini took 68 minutes. Even the best structured app (Recipy Cook Mode) showed 18% overrun for experienced cooks and 41% for novices. The root cause is architectural: recipe blogs train on fast, uninterrupted authors who don't distinguish active minutes from passive minutes and routinely omit invisible steps (oven preheat, water boil, meat rest, dough proof) that pad clock time by 15–25 minutes per recipe.

The frustration is universal and well-documented. r/cookingforbeginners threads show users asking "Why does every recipe I try take me a LOT longer than it says?" and "It feels like it takes me way too long to cook things." Southern Living's recipe developers admit: "A published time is never going to be 100 percent accurate for every single person." Better Homes & Gardens confirms: "The crucial steps that aren't included in a recipe are why you're taking 1–2 hours to get your dinner on the table."

Every existing tool inherits this flaw. CHOP markets "honest cooking time estimates" but generates AI recipes from scratch — the times are LLM-inferred, not measured. Recipy has the best data model (active/passive time fields per step) but explicitly states "per-user pace calibration is not shipped" and "no consumer cooking app ships it yet." NowCook claims "real cook times — tested, not guessed" but uses a closed chef-curated catalog with no community data layer. NYT Cooking, SideChef, and Mealime all show single point estimates with no skill-level stratification, no per-user calibration, and no cleanup inclusion.

The cook is left choosing between optimistic magazine times, AI hallucinations, and a stopwatch. No product crowdsources actual cook times from verified stopwatch sessions, stratifies by skill level, calibrates to the individual user's measured pace, or includes cleanup in the planning estimate.

**Market context**: Recipe app market $1.41B (2025) → $2.63B (2030, 13.1% CAGR). 61.2% of Americans engage in food prep/cleanup daily (BLS 2024). 93% of adults expect to cook as much or more in coming years. 64% of US smartphone users have installed at least one cooking/food app; users spend avg 11.8 minutes per session. Users who connect meal-planning features spend 40% more time inside recipe apps. Yet the timing layer — the single most requested feature for planning — is unoccupied. Every competitor competes on recipe generation, meal planning, or grocery integration. None owns timing accuracy as the primary product.

**Evidence sources**:
- https://www.reddit.com/r/cookingforbeginners/comments/1qef2cn/newbie_question_how_to_reduce_cooking_and_prep/
- https://www.reddit.com/r/cookingforbeginners/comments/ru52ew/it_feels_like_it_takes_me_way_too_long_to_cook/
- https://www.reddit.com/r/cookingforbeginners/comments/1fopx1u/why_does_every_recipe_i_try_take_me_a_lot_longer/
- https://www.reddit.com/r/cookingforbeginners/comments/1d8dmi8/every_time_i_make_a_recipe_it_takes_much_longer/
- https://recipyapp.com/blog/ai-recipe-cook-time-accuracy-2026
- https://www.southernliving.com/recipe-times-never-seem-accurate-11725412
- https://www.bhg.com.au/food/tips-how-to/30-minute-recipe-takes-too-long-to-cook/

---

## 2. Target Personas

### Persona 1: The Time-Anxious Beginner (22–35, new to cooking)

**Profile**: Has tried 5+ recipes that all took "way longer than the card said," feels like they're bad at cooking when the real problem is bad estimates, plans meals around "30 min recipes" that regularly stretch to 90 min, causing dinner plans to fall apart. Under time pressure from work/kids and doesn't have the experience to know which steps can be parallelized or which "5 minutes" actually means 15.

**Jobs-to-be-done**: Know the real time commitment before I start chopping; feel confident scheduling cooking around my actual evening; stop feeling like I'm "bad at cooking" when the recipe was just badly estimated; find recipes that fit into my actual available window.

**Bad today**: Searches "30 min weeknight dinner" on Allrecipes → picks a recipe → starts at 6:30 PM → still chopping at 7:15 → dinner at 8:00 → ruins evening plans → feels defeated → questions whether they should bother cooking at all. The recipe said 30 minutes. The reality was 90 minutes. The gap between promise and reality is the problem, not their cooking skill.

**RecipeReal value**: Skill-level stratified timing shows what a recipe actually takes for a first-time cook (not the idealized test-kitchen time); per-user pace calibration learns their actual chopping and sauté speed after a few cooks and overlays it on future recipes; cleanup-inclusive total time means they know the real commitment ("30 min cook + 14 min cleanup = 44 min total") before they start; interruption-adjusted estimate accounts for kids/pets/phone calls.

### Persona 2: The Interrupted Parent/Caregiver (28–42, cooks for a family)

**Profile**: Cannot monofocus — kids, pets, and phone calls fragment the cooking process, knows their kitchen time is 1.5–2x published estimates but has no way to model it, resents recipes that assume a quiet, uninterrupted test kitchen, wants planning tools that respect real life. Often starts cooking after kids' bedtime or during brief windows between activities.

**Jobs-to-be-done**: Plan meals around a realistic total time that includes kid-interruptions and cleanup; find recipes that fit into actual available windows; feel like a cooking app understands that my kitchen is not a test kitchen; avoid the 8 PM dinner disaster that comes from optimistic estimates.

**Bad today**: Opens a recipe app → sees "25 minutes" → thinks "I can squeeze this in before the kids' bath time" → starts cooking → kid needs help with homework → dog needs to go out → phone rings → actual cook time: 65 minutes → kids are hangry → bath time is late → feels like cooking is a failure. The recipe's time estimate was a fantasy that didn't account for real life.

**RecipeReal value**: Multitasking/interruption penalty modeling lets them set interruption frequency (high/medium/low) and applies a multiplier to passive-step windows — "focused cook: 35 min; interrupted cook (your setting): 52 min"; cleanup-inclusive total time accounts for family-sized dish burden; skill-level stratification accounts for the fact that they're competent but slow because they're managing three things at once.

### Persona 3: The Efficiency-Minded Home Cook (25–40, cooks regularly)

**Profile**: Has developed personal pacing intuitions (knows their onion dice takes 8 min, not 3), is frustrated that every app shows the same generic time regardless of skill, wants a tool that gets smarter the more they use it, already uses timers and prep bowls but wants something that learns. Cooks 3–5 times per week and treats kitchen efficiency as a hobby.

**Jobs-to-be-done**: Get recipe times calibrated to my actual pace; discover how my cooking speed compares to others at my skill level; use timing data to plan meals more precisely; optimize kitchen workflow.

**Bad today**: Uses a generic recipe app → sees "3 min dice" → knows it will take them 7 min → manually adds a buffer → cooks → logs actual time in a notebook → next recipe, same dance. The app never learns. They have to manually compensate for every optimistic estimate. They've tried 6 different apps and none gets smarter with use.

**RecipeReal value**: Per-user pace calibration is the core feature — after a few logged cooks, the app overlays their personal pace distribution on every future recipe ("you dice onions in 7.2 min vs. recipe's 3 min"); community timing data shows them how their pace compares to intermediate cooks at their skill level; the more they cook, the more accurate their personal time estimates become — the app gets smarter, not just bigger.

---

## 3. Vision & Success Metrics

**Vision**: Make recipe time honest and personally calibrated — so home cooks can plan their actual evenings around real cooking commitments instead of idealized test-kitchen estimates that ignore prep, cleanup, and real life.

**North Star Metric**: Weekly active users who log at least one verified actual cook time per week.

**KPIs**:
1. **Activation**: % of signups who log their first actual cook time within 7 days (target >30%).
2. **Retention**: % of users who log at least one cook time per week and remain active at D30 (target >50% D30 retention).
3. **Engagement**: Avg recipes viewed per user per month (target >8); avg actual cook times logged per user per month (target >3); avg pace calibration accuracy improvement over 5 cooks (target error rate <15% vs. first-cook error); avg cleanup times logged per user per month (target >2).
4. **Revenue**: Free-to-paid conversion rate (target >10%); MRR at 6 months (target >$2K); avg revenue per paying user (target >$5/mo).

---

## 4. Feature Scope

### MVP (P0 — ship in 8 weeks)

| Priority | Feature | Description |
|----------|---------|-------------|
| P0 | Verified Cook-Time Engine | Community-submitted actual cook times per recipe step, sourced from stopwatch-verified Cook Mode sessions (not self-reported estimates). Statistical distribution by skill level replaces single point estimate. |
| P0 | Skill-Level Stratified Timing | Three time estimates per recipe: novice (first-time), intermediate (familiar), expert. Users select their level; app surfaces the appropriate distribution with confidence intervals. |
| P0 | Per-User Pace Calibration | Opt-in step-completion timers inside Cook Mode. After 3+ logged cooks, app overlays personal pace distributions on every future recipe ("you dice onions in 7.2 min vs. recipe's 3 min"). Gets smarter with use. |
| P0 | Cleanup-Inclusive Total Time | Cleanup-time estimate based on dish count, cookware type, and user-reported cleanup speed. "30 min recipe + 12 min cleanup = 42 min total." Proprietary dish-burden taxonomy. |
| P0 | Interruption Penalty Modeling | User sets interruption frequency (high/medium/low); app applies multiplier to passive-step windows. "Focused cook: 35 min; interrupted cook (your setting): 52 min." Targets parents and caregivers ignored by test-kitchen recipes. |

### P1 (ship in weeks 9–12)

| Priority | Feature | Description |
|----------|---------|-------------|
| P1 | Free/Premium Tier Gating | Free: 5 recipes/month, basic community timing, standard skill-level estimates. Premium: unlimited recipes, per-user pace calibration, interruption modeling, cleanup estimates, ad-free. |
| P1 | Mobile App (iOS + Android) | React Native + Expo; offline-first Cook Mode with step timers; push notifications for timing nudges ("your usual pace says add 15 min"); widget for quick recipe access. |
| P1 | Recipe URL Import + Parser | Import any recipe from a URL; Schema.org parser extracts structured timing data; AI parses steps into active/passive/cleanup primitives. Users can paste or snap a photo of any recipe. |
| P1 | Community Timing Submission | Verified submission: users log actual cook times after completing a recipe in Cook Mode; earn timing karma for accurate, verified submissions; streak system for consistent logging. |
| P1 | Cook Mode with Step Timers | Guided cook mode with per-step timers, one-tap completion, and automatic actual-time logging. Audio cues for hands-free cooking. Offline-capable. |

### Later (post-MVP stretch)

- Multi-recipe choreography with kitchen-constraint scheduling (oven-as-shared-resource, stovetop coordination).
- Smart appliance integration (MEATER, June Oven) for passive-step automation.
- Meal planning with realistic total-time budgets.
- Grocery list handoff to Instacart/Walmart.
- "Stopwatch-verified" badge for recipes with N+ verified user sessions.
- Recipe creator analytics: "your recipe takes people 47 min on average, not 30."

---

## 5. UX & Information Architecture

**Onboarding** — 2-step setup: (1) self-reported skill level (novice / intermediate / expert), (2) interruption environment (focused / occasional interruptions / frequent interruptions). App explains the crowdsourced timing model and shows a sample recipe with three time estimates.

**Home Screen** — primary view: "Today's Realistic Options" showing recipes filtered by available time window (e.g., "recipes that take 30–45 min for an intermediate cook with occasional interruptions"). Quick-action: "Find a Recipe" or "Start Cooking."

**Recipe Detail** — core view: three time columns (novice / intermediate / expert) with crowd-sourced distributions, per-user pace overlay ("based on your history: 38 min"), cleanup-inclusive total, and interruption-adjusted estimate. Step-by-step breakdown with active/passive/cleanup tags. Community timing submissions visible as a distribution chart with sample size and confidence intervals.

**Cook Mode** — full-screen guided flow: step-by-step with per-step timers, one-tap completion logging, audio cues, offline-capable. At completion: prompt "how long did that actually take?" with quick-select options. Logs feed directly into pace calibration engine and community timing dataset.

**Pace Calibration Dashboard** — shows user's personal pace distributions over time: "your onion dice: 7.2 min (community intermediate: 5.1 min)"; "your garlic sauté: 4.8 min (community intermediate: 3.2 min)". Visual improvement over time. Gamified with "you're 28% faster than you were 30 days ago."

**Community Timing Feed** — browse recent timing submissions from the community; filter by recipe type, skill level, and interruption environment. "Timing karma" leaderboard for accurate submitters. Verification badges for stopwatch-confirmed sessions.

**Core Flows**:
1. **First Launch → Skill Setup → First Recipe → First Cook**: User selects "novice, occasional interruptions" → searches "one-pan pasta" → sees three estimates (novice: 42 min / intermediate: 32 min / expert: 25 min) + cleanup: 14 min + interrupted total: 52 min → cooks with Cook Mode → logs actual time: 48 min → app notes calibration gap → next recipe gets personalized overlay.
2. **Recipe Import → Timing Recalibration**: User pastes a blog recipe URL → Schema.org parser extracts "30 min" → AI parses steps into 8 active, 4 passive, 1 cleanup → community data shows actual median 47 min → user sees "this recipe takes 57% longer than advertised" → chooses based on real time.
3. **Pace Calibration → Personalized Accuracy**: After 10 logged cooks, user's personal pace distributions are stable → app overlays on every recipe → "based on your history, this will take you 41 min, not the printed 32 min" → user trusts the estimate → schedules cooking with confidence.

---

## 6. Technical Architecture (High Level)

**Frontend**: React Native + Expo for cross-platform iOS/Android; offline-first Cook Mode with step timers and audio cues; push notifications for timing nudges; widget for quick recipe access. Mobile-first design for kitchen use (brightness-adaptive UI, audio-only mode, one-thumb navigation).

**Backend**: Supabase (PostgreSQL + Edge Functions) for user timing logs, crowdsourced step durations, skill-level distributions, recipe metadata cache, and pace calibration engine. OpenAI API for parsing recipe steps into active/passive/cleanup primitives and generating personalized time overlays. Schema.org parser for structured recipe data ingestion from blogs and recipe sites.

**Storage**: SQLite for local-first state (downloaded recipes, Cook Mode timers, offline timing logs); PostgreSQL via Supabase for cloud sync (user timing history, community distributions, recipe metadata, pace calibration models, verification data). Schema: `users`, `profiles`, `recipes`, `recipe_steps`, `timing_submissions`, `pace_calibrations`, `skill_levels`, `cleanup_estimates`, `interruption_models`, `timing_karma`, `verification_sessions`, `notifications`.

**Queue**: Supabase Edge Functions + lightweight queue for recipe ingestion, batch timing aggregation, pace calibration computation, and notification delivery.

**Auth**: Clerk or Supabase Auth; local-first mode for Cook Mode and timing logs (no auth required to use timers); cloud sync and community features require auth. Privacy-first design keeps cooking habits and pace data confidential.

**Hosting**: Expo Application Services (EAS) for mobile builds; Supabase for backend and PostgreSQL; Resend for email delivery; Sentry for monitoring. Mobile-first architecture means Cook Mode works fully offline; cloud features (community timing, pace sync) are optional enhancements.

---

## 7. Integrations

| Integration | Purpose | Docs URL |
|-------------|---------|----------|
| **Stripe** or **Paddle** | Subscription billing for premium tiers (unlimited recipes, per-user pace calibration, interruption modeling, cleanup estimates). | https://stripe.com/docs |
| **Clerk** or **Supabase Auth** | User accounts, skill-level profiles, saved timing history, cross-device sync. | https://clerk.com/docs |
| **OpenAI API** or **Anthropic API** | Parse recipe steps into active/passive/cleanup primitives; generate personalized time overlays; chat-based timing explanations. | https://platform.openai.com/docs |
| **Instacart Developer Platform** | Shoppable recipe links, grocery list handoff, affiliate revenue on ingredient orders. | https://docs.instacart.com/developer_platform_api |
| **Resend** or **Firebase Cloud Messaging** | Push/email reminders for saved recipes, timing nudges ("your usual pace says add 15 min"), weekly meal-plan alerts. | https://resend.com/docs |
| **Supabase** (PostgreSQL) | User timing logs, crowdsourced step durations, skill-level distributions, recipe metadata cache, pace calibration models, verification data. | https://supabase.com/docs |
| **Schema.org Recipe parser** | Ingest structured recipe data (cookTime, prepTime, performTime) from blogs and scale sites. | https://schema.org/Recipe |
| **YouTube / TikTok / Instagram API** | Import recipes from video URLs, extract step timings from captions/transcripts. | https://developers.google.com/youtube/v3 |

---

## 8. Monetization & Pricing

Anchored on verified competitor pricing: CHOP Plus $6.99/mo or $49.99/yr, NowCook Pro $9/mo or $72/yr, SideChef Premium $4.99/mo or $49.99/yr, NYT Cooking $4.99/mo or $39.99/yr, Mealime Pro $5.99/mo or $49.99/yr. Freemium is the norm. **RecipeReal anchors at $5.99/mo or $49.99/yr Premium** — at the proven consumer cooking app price point, justified by the proprietary pace calibration layer and crowdsourced timing data that free alternatives don't deliver.

| Tier | Price | Includes | Rationale |
|------|-------|----------|-----------|
| **Free** | $0 | 5 recipes/month, basic community timing access, standard skill-level estimates (novice/intermediate/expert), Cook Mode with step timers | Acquisition funnel; low enough friction that a time-anxious beginner will install to test timing accuracy; free tier must be useful enough to demonstrate value but gated enough to create upgrade pull. |
| **Premium** | $5.99/mo or $49.99/yr | Unlimited recipes, per-user pace calibration, interruption penalty modeling, cleanup-inclusive total time, ad-free, timing karma premium badge, priority support | Anchored at SideChef/Mealime/CHOP Plus price point ($4.99–6.99/mo); justified by the proprietary pace calibration layer that makes the app smarter the more the user cooks; annual at $49.99/yr (~$4.17/mo) drives cash flow and reduces churn. |
| **Household** | $8.99/mo or $69.99/yr | All Premium features; up to 4 user profiles with independent pace calibrations; shared timing data across household cooks; family interruption profiles; meal planning with realistic total-time budgets | Captures families and multi-cook households; opens group-planning revenue; positioned above Premium for power users. |

**Pricing rationale**: $5.99/mo is the proven consumer cooking app price point. The pitch is "RecipeReal pays for itself the first time you avoid a 90-minute cooking disaster because the app told you it would take 52 minutes." The free tier with 5 recipes/month and basic community timing is generous enough to demonstrate value but limited enough to drive upgrades. Per-user pace calibration and interruption modeling are premium features, not upsells — they are the proprietary value layer that requires logged user data.

**Tech/pricing sanity**:
- OpenAI GPT-4o-mini: $0.15/1M input, $0.60/1M output. At ~1K tokens per recipe parsing × 10K users × 3 recipes/user = 30M tokens/mo ≈ $18/mo at GPT-4o-mini pricing (negligible).
- Stripe: 2.9% + 30¢ per transaction; Stripe Billing: 0.7% of billing volume. On $2K MRR: ~$70/mo in Stripe fees.
- Supabase: free tier generous; Pro $25/seat/month. At 10K users: ~$25–50/month.
- Resend: free tier 3,000 emails/month; $1/1,000 after. At 10K alert emails/mo: ~$10/month.
- Total infrastructure at 10K users: ~$100–200/month.

---

## 9. GTM & Competition

**Competitors**:

| Competitor | What they do | Weakness RecipeReal exploits |
|------------|-------------|-----------------------------|
| **Recipy** (free, recipyapp.com) | AI kitchen orchestrator with Cook Mode; separates active/passive minutes per step; best cook-time accuracy in 2026 audit (18% overrun). Post-cook feedback loop with 6-field structured log. | Explicitly states "per-user pace calibration is not shipped" and "no consumer cooking app ships it yet"; imported recipes carry source time errors; no skill stratification or interruption modeling; no cleanup inclusion — best data model but no personalization |
| **CHOP** (free / Plus $6.99/mo or $49.99/yr, getchop.app) | AI-generated recipes from pantry scans; markets "honest cooking time estimates" that include chopping and oven preheat. | AI-generated recipe novelty, not crowdsourced real-user timing data; free tier limited to 1 recipe/day; no per-user pace calibration; no skill stratification or cleanup — recipe generator with honest marketing, not calibrated execution layer |
| **NowCook** ($9/mo or $72/yr, nowcook.app) | Pantry photo scanner, chef-tuned AI meal plans, claims "real cook times — tested, not guessed." | Closed catalog, not crowdsourced; no per-user skill calibration; pricing at high end ($9/mo); no interruption or cleanup modeling — meal planner with tested times, not community-calibrated |
| **SideChef** ($4.99/mo or $49.99/yr) | 18,000 hand-tested step-by-step recipes with video, voice guidance, smart-appliance control. | Premium paywall for popular recipes; grocery sync glitches; crashes on older tablets; no crowdsourced timing, no per-user calibration — hand-tested recipe library, not timing tool |
| **Mealime** ($5.99/mo or $49.99/yr) | Meal-planning-first with weekly menus and dietary filters. | Essentially in maintenance mode, minimal updates since mid-2024; generic prep times, no skill-level or cleanup timing; plan repetition complaints — 2019 technology in 2026 |
| **NYT Cooking** ($4.99/mo or $39.99/yr) | 20,000+ editorially tested recipes with active-time labeling. | Subscription wall, no free tier, no per-user calibration, no crowdsourcing; active-time labeling is editorial, not measured — curated publication, not calibration engine |

**Differentiator**: **RecipeReal's novel mechanism is "stopwatch-native timing provenance combined with per-user pace calibration as a compounding learning primitive" — every timing claim links to actual logged cook times from verified stopwatch sessions (not publisher estimates or AI guesses), and the app learns your personal chopping, sauté, and cleanup speed across step primitives, overlaying calibrated estimates on every future recipe that get more accurate the more you cook. No competitor crowdsources timing from real stopwatch data, stratifies by skill level with confidence intervals, or treats the user's measured pace as a first-class input that improves with use. Recipy is the closest competitor but explicitly admits "per-user pace calibration is not shipped" and "no consumer cooking app ships it yet."**

Every competitor is a point solution: CHOP/NowCook are recipe generators with honest marketing, Recipy has the best data model but no personalization, SideChef/NYT Cooking are hand-tested recipe libraries, Mealime is a stale meal planner. RecipeReal unifies them by treating timing accuracy as the primary product, not a feature of a recipe app.

**Go-to-Market Channels**:
1. **Reddit organic**: r/cookingforbeginners, r/Cooking, r/MealPrepSunday — share "I built an app that tells you the real time a recipe takes, including cleanup, calibrated to your skill level" screenshots and "I logged my actual onion dice time and it was 2x the recipe's estimate" stories; position as the app that ends the "why does every recipe take me twice as long" frustration.
2. **TikTok/Instagram Reels**: "This recipe says 30 min — my actual time with interruptions and cleanup was 48 min" — short-form content showing the crowdsourced timing data and pace calibration; drives organic installs from frustrated cooks.
3. **Food blogger / creator partnerships**: Partner with food bloggers whose recipes consistently get "this took way longer than you said" comments; offer RecipeReal timing data as a widget they can embed on their recipe pages; positions the tool as a quality signal for recipe creators.
4. **Build in public**: Share anonymized aggregate insights ("This month, RecipeReal users logged 5,000 actual cook times and the average overrun vs. publisher estimates was 47%") to build trust; publish timing-calibration methodology as public-good content.
5. **Meal kit / grocery delivery partnerships**: Integrate with meal kit services (Blue Apron, HelloFresh) and grocery delivery (Instacart) to show realistic total times for their recipes; affiliate revenue on ingredient orders; positions RecipeReal as the timing layer on top of any recipe source.

---

## 10. Roadmap (12 Weeks)

### Phase 1: Data Pipeline + Timing Engine (Weeks 1–3)
- Scaffold React Native + Expo mobile app; iOS + Android; offline-first Cook Mode with step timers.
- Build Supabase schema: `users`, `profiles`, `recipes`, `recipe_steps`, `timing_submissions`, `pace_calibrations`, `skill_levels`, `cleanup_estimates`, `interruption_models`, `timing_karma`, `verification_sessions`, `notifications`.
- Build recipe ingestion pipeline: Schema.org parser for structured recipe data from blogs; OpenAI/Anthropic API for parsing free-text recipe steps into active/passive/cleanup primitives. Seed with 500–1,000 popular recipes.
- Design crowdsourced cook time engine: community-submitted actual times per step, tagged by self-reported skill level; statistical distribution replaces single point estimate.
- Build skill-level stratified timing: three estimates per recipe (novice / intermediate / expert) with confidence intervals.
- **Deliverable**: User opens "one-pan pasta" recipe → sees three estimates (novice: 42 min / intermediate: 32 min / expert: 25 min) + community distribution chart → understands real time before starting.

### Phase 2: Pace Calibration + Cleanup + Interruption (Weeks 4–6)
- Implement per-user pace calibration: opt-in step-completion timers inside Cook Mode; after 3+ logged cooks, overlay personal pace distributions on future recipes ("you dice onions in 7.2 min vs. recipe's 3 min").
- Build cleanup-inclusive total time: proprietary dish-burden taxonomy (pan count, washer-safe vs. hand-wash, grease difficulty); user-reported cleanup speed; "30 min cook + 12 min cleanup = 42 min total."
- Implement multitasking/interruption penalty: user sets interruption frequency (high/medium/low); app applies multiplier to passive-step windows; "focused: 35 min; interrupted (your setting): 52 min."
- Auth with Clerk or Supabase; local-first Cook Mode works without auth; cloud sync requires signup.
- **Deliverable**: User cooks recipe with Cook Mode → logs actual time: 48 min → app calibrates personal pace → next recipe shows personalized estimate: 38 min → user sees cleanup + interruption total: 55 min → plans evening with confidence.

### Phase 3: Community + Tier Gating (Weeks 7–9)
- Build community timing submission: gamified submission with "timing karma" for accurate submitters; streak system for consistent logging; community timing feed with recipe distributions.
- Build free/premium tier gating; install tracking and analytics.
- Build recipe URL import + parser: paste any recipe URL → Schema.org parser extracts timing data → AI parses steps → crowdsourced community times overlaid.
- Build Cook Mode: full-screen guided flow with per-step timers, one-tap completion logging, audio cues, offline-capable.
- **Deliverable**: User pastes blog recipe URL → app parses steps → shows publisher estimate 30 min vs. community median 47 min → user cooks → logs actual: 49 min → earns timing karma → next imported recipe gets their personal pace overlay.

### Phase 4: Launch (Weeks 10–12)
- Beta with 100–200 users from r/cookingforbeginners, r/Cooking, and food blogger partners.
- Bug bash + timing calibration accuracy review; validate pace calibration model and interruption multipliers.
- Product Hunt + Reddit launch; publish essay on "why every recipe lies to you about cooking time (and how we're fixing it with crowdsourced data)."
- Set up analytics (activation funnel, retention, recipes viewed, actual times logged, pace calibration accuracy, revenue).
- **Deliverable**: Public launch; Free, Premium, and Household tiers live; first paying users from beginner cook and efficiency-minded cook communities.

---

## 11. Risks & Mitigations

| Risk | Severity | Mitigation |
|------|----------|------------|
| **Free-tier gravity and acquisition cost (market dominated by free ad-supported apps with massive catalogs; UAC up 25%)** | High | Lead with genuinely useful free tier (5 recipes/month, community timing access, Cook Mode); charge for the proprietary pace calibration layer and interruption modeling; partner with meal-kit and grocery-delivery brands for affiliate revenue to reduce pure-subscription dependency. |
| **Crowdsourcing cold-start problem (timing data worthless without volume; early users see generic estimates)** | High | Seed catalog with lab-tested baseline times for 500–1,000 popular recipes before launch; gamify submission with streaks and timing karma; let users opt into anonymous data sharing from day one to build the training set. |
| **AI recipe generation commoditization (ChatGPT/Gemini already generate free recipes; 47% underestimated on average)** | Medium | Do not position RecipeReal as a recipe generator; position it as a timing/execution layer on top of any recipe source (URL import, photo, text paste, AI generation); the value is calibration, not generation. |
| **Behavioral habit formation (users may not consistently log actual cook times, reducing calibration accuracy)** | Medium | Minimize friction with one-tap step-completion timers inside Cook Mode; use push nudges ("how long did that actually take?"); offer immediate payoff ("based on your history, this will take you 52 min, not the printed 32 min") to reinforce the habit. |

---

## 12. Innovation Bar

**Core novel mechanism in one sentence**: RecipeReal defines "stopwatch-native timing provenance" combined with "per-user pace calibration as a compounding learning primitive" — every timing claim links to actual logged cook times from verified stopwatch sessions (not publisher estimates or AI guesses), and the app learns your personal chopping, sauté, and cleanup speed across step primitives, overlaying calibrated estimates on every future recipe that get more accurate the more you cook — creating a proprietary dataset that improves with use and makes the app smarter, not just bigger.

**Honest assessment**: Skill-level stratified timing (Recipy has active/passive step fields) and "honest" time estimates (CHOP markets this) exist as standalone features. What is genuinely new is the *stopwatch-native provenance layer* — sourcing timing data from verified Cook Mode sessions rather than self-reported estimates or AI inferences — combined with *per-user pace calibration as a compounding primitive* — adjusting recipe times to the individual's measured cooking speed so the app gets smarter the more you cook. No competitor unifies verified stopwatch provenance, personal pace calibration, and cleanup choreography as a cohesive timing framework. Recipy comes closest but explicitly states "per-user pace calibration is not shipped" and "no consumer cooking app ships it yet."

**What would need to change to clear the bar fully**: RecipeReal needs to move from *timing-calibration app for individual home cooks* to *standard for recipe time accuracy across the food media ecosystem* — if the crowdsourced timing taxonomy, stopwatch-verified provenance methodology, and per-user pace calibration framework are adopted by food bloggers, meal kit services, grocery delivery platforms, and smart appliance manufacturers as the official standard for recipe time estimation, the platform becomes infrastructure rather than a mobile app. Right now it's a powerful timing-calibration tool for home cooks; making it the mandatory accuracy layer for every recipe published online is the gap between a better app and an infrastructure play.

---

*Enriched on 2026-08-12. Competitor identities, pricing, and capabilities verified via web research. Market data from Research and Markets, Technavio, Spherical Insights, BLS 2024, Sensor Tower, Recipy 2026 audit, and verified product searches. Tech/pricing verified: OpenAI GPT-4o-mini $0.15/0.60 per 1M tokens, Stripe 2.9% + 30¢ + 0.7% Billing, Supabase/Resend/Clerk free tiers available.*
