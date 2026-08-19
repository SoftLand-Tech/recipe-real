# RecipeReal — Community Feature Roadmap

*Ideation session 2026-08-19. The core insight: the community is currently a
generic skeleton (posts/likes/comments). The creative direction below turns it
into the verification engine for the app's real moat — honest, stopwatch-
verified cook times. Nobody else has this data; nobody else can copy these
features without it.*

## 0. Mandatory first (not creative — blocking)

- **Report/block on all UGC.** Posts, comments, public notes need report +
  block-user buttons. This is the Play Store UGC policy gap (flagged in the
  2026-08-18 acceptance assessment) — the one thing that can get the whole
  app rejected. Build before store submission.

## 1. "Proof of Cook" posts — the killer feature

When a Cook Mode session finishes, the app holds the *actual stopwatch time*,
which steps overran, and the cook's pace vs the recipe's claim. Let a "try"
post carry that automatically:

> ✓ Verified cook: really took 52 min — recipe says 35

with the timeline attached. Only posts backed by a real session get the
**"Verified cook ✓"** badge.

- Every community post becomes a data point that sharpens the Reality Index.
- Unfakeable: Instagram can't do this; Food.com can't copy it without
  stopwatch sessions.
- Implementation sketch: CookSession already records total + per-step marks;
  link session → post (nullable session_id on posts), badge from the link,
  timeline card rendered from the session payload.

## 2. Reputation built on honesty, not likes

Likes measure popularity; we can measure *trustworthiness*.

- Users whose reported times consistently match the community average become
  **"Trusted Cooks"**.
- A leaderboard: "most honest contributors of the month."
- The app about honest times has a community that ranks honesty — on-brand,
  unique, and it incentives the exact behavior that feeds the moat.

## 3. Failure tags — the anti-praise feature

Every recipe community is full of "came out great!" — useless data. Structure
fail-posts with what-went-wrong tags:

- took way longer / burnt / too salty / family didn't like it / …

Aggregate them per recipe so the recipe page can show:

> ⚠ Common pitfall: 60% of cooks needed +20 min at the simmer step.

Failure data is the moat's other half — nobody publishes real failure patterns.

## 4. "Cooking this tonight" presence

When someone starts Cook Mode on a recipe, optionally show
"3 people are cooking this right now" on the recipe page, with a light live
thread for that recipe.

- Cooking is communal in the target audience's culture.
- Becomes electric during Ramadan: everyone cooking the same iftar dish the
  same evening, comparing real finish times against maghrib.
- Implementation sketch: active-session counter per recipe (heartbeat or
  start/finish events), opt-in.

## 5. Ramadan cook-along events

Seasonal version of #4: "today's iftar challenge recipe — post your real
time." Ties into the broader Ramadan Mode item already on the product roadmap
(prayer-time-aware start planning).

## Sequencing

1. Report/block (necessity)
2. Proof of Cook (multiplies everything: badge, reputation, Reality Index)
3. Failure tags
4. Presence / live threads
5. Ramadan events
