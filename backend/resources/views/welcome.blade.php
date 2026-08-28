<!DOCTYPE html>
<html lang="en">
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>RecipeReal — Recipes lie about time. We keep the real clock.</title>
        <meta name="description" content="RecipeReal clock-checks 20,089 halal-friendly recipes against what cooks actually spend in the kitchen. Claim vs reality on every recipe, offline library, guided Cook Mode with step alarms. Free Android app.">
        <link rel="canonical" href="https://recipe-real.softland.tech/">
        <meta name="theme-color" content="#171310">
        <meta property="og:type" content="website">
        <meta property="og:site_name" content="RecipeReal">
        <meta property="og:title" content="RecipeReal — Recipes lie about time. We keep the real clock.">
        <meta property="og:description" content="Stopwatch-verified cook times for 20,089 recipes. Claim vs reality, an offline library, and guided Cook Mode. Free for Android.">
        <meta property="og:url" content="https://recipe-real.softland.tech/">
        <meta property="og:image" content="https://recipe-real.softland.tech/img/recipereallogo.webp">
        <meta name="twitter:card" content="summary_large_image">
        <meta name="twitter:title" content="RecipeReal — the real clock for recipes">
        <meta name="twitter:description" content="Claim vs measured cook time on 20,089 recipes. Free Android app.">
        <meta name="twitter:image" content="https://recipe-real.softland.tech/img/recipereallogo.webp">
        <style>
            /* ============ THE TIMING BOARD ============
               RecipeReal rendered as the official timing body of home
               cooking: an ink instrument board, teal reserved for measured
               time, terracotta reserved for action, cream for print.
               World + execution contract for this page lives in the BODY
               comment below. Code-led build (no comp). */

            @font-face {
                font-family: "Big Shoulders";
                src: url("/fonts/BigShoulders-latin.woff2") format("woff2");
                font-weight: 100 900;
                font-display: swap;
            }
            :root {
                --board: #171310;
                --board-2: #1E1813;
                --print: #FBF8F3;
                --paper: #FAF7F1;
                --ink: #241D17;
                --ink-2: #6E6357;
                --ink-3: #A99E92;
                --hair-dark: #332A22;
                --hair-light: #E4DCD2;
                --accent: #E86A33;
                --accent-deep: #BF5523;
                --accent-soft: #FBE9DE;
                --timing: #287C78;
                --timing-lit: #5FBDB1;
                --timing-dim: rgba(95,189,177,.14);
                --success: #3D8B5A;
                --font-display: "Big Shoulders", "Arial Narrow", sans-serif;
                --font-body: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
                --font-mono: ui-monospace, "SF Mono", "Cascadia Mono", Menlo, Consolas, monospace;
            }
            *, *::before, *::after { box-sizing: border-box; }
            html { scroll-behavior: smooth; }
            body {
                margin: 0;
                background: var(--board);
                color: var(--print);
                font-family: var(--font-body);
                font-size: 16px;
                line-height: 1.6;
                -webkit-font-smoothing: antialiased;
                text-rendering: optimizeLegibility;
            }
            ::selection { background: var(--accent); color: #fff; }
            a { color: inherit; }
            :focus-visible { outline: 2px solid var(--timing-lit); outline-offset: 3px; border-radius: 2px; }
            .wrap { max-width: 1120px; margin: 0 auto; padding: 0 24px; }
            .mono { font-family: var(--font-mono); font-variant-numeric: tabular-nums; }

            /* ---------- shared controls ---------- */
            .btn {
                display: inline-flex; align-items: center; gap: 10px;
                padding: 15px 28px; border-radius: 4px;
                font-weight: 700; font-size: 15px; letter-spacing: .01em;
                text-decoration: none; border: 1px solid transparent; cursor: pointer;
                transition: background .15s ease, border-color .15s ease, transform .1s ease;
            }
            .btn:active { transform: translateY(1px); }
            .btn-accent { background: var(--accent); color: #fff; }
            .btn-accent:hover { background: var(--accent-deep); }
            .btn-line { background: transparent; color: var(--print); border-color: #4A3F35; }
            .btn-line:hover { border-color: var(--print); }
            .btn-sm { padding: 10px 18px; font-size: 13.5px; }

            /* ---------- nav ---------- */
            .nav { border-bottom: 1px solid var(--hair-dark); }
            .nav-inner { display: flex; align-items: center; justify-content: space-between; height: 68px; }
            .brand { display: flex; align-items: center; gap: 12px; text-decoration: none; }
            .brand-tile { width: 38px; height: 38px; border-radius: 9px; background: var(--print);
                display: flex; align-items: center; justify-content: center; }
            .brand-tile img { width: 30px; height: 30px; }
            .brand b { font-family: var(--font-display); font-weight: 700; font-size: 24px;
                letter-spacing: .02em; text-transform: uppercase; }
            .brand b em { font-style: normal; color: var(--accent); }
            .nav-links { display: flex; align-items: center; gap: 22px; }
            .nav-links a { text-decoration: none; font-size: 14px; color: var(--ink-3); }
            .nav-links a:hover { color: var(--print); }
            @media (max-width: 700px) { .nav-links .hide-m { display: none; } }

            /* ---------- hero ---------- */
            .hero { padding: 84px 0 72px; position: relative; overflow: hidden; }
            .hero .wrap { display: grid; grid-template-columns: 1.08fr .92fr; gap: 56px; align-items: center; }
            h1 {
                font-family: var(--font-display);
                font-weight: 800; text-transform: uppercase;
                font-size: clamp(3.1rem, 7.2vw, 5.6rem);
                line-height: .94; letter-spacing: -.01em;
                margin: 0 0 22px; text-wrap: balance;
            }
            h1 .lie { color: var(--ink-3); text-decoration: line-through;
                text-decoration-color: var(--accent); text-decoration-thickness: .09em; }
            h1 .real { color: var(--timing-lit); }
            .lede { font-size: 18px; color: #CFC4B8; max-width: 30em; margin: 0 0 32px; }
            .lede b { color: var(--print); }
            .hero-cta { display: flex; flex-wrap: wrap; gap: 14px; align-items: center; }
            .hero-proof { margin-top: 34px; display: flex; gap: 0; border: 1px solid var(--hair-dark);
                border-radius: 6px; overflow: hidden; width: fit-content; }
            .hero-proof div { padding: 10px 20px; border-right: 1px solid var(--hair-dark); }
            .hero-proof div:last-child { border-right: 0; }
            .hero-proof b { display: block; font-family: var(--font-mono); font-size: 19px;
                color: var(--timing-lit); font-variant-numeric: tabular-nums; }
            .hero-proof span { font-size: 11.5px; color: var(--ink-3); letter-spacing: .06em; text-transform: uppercase; }

            /* timing strip — the mechanism, demonstrated */
            .strip-shell { position: relative; }
            .strip {
                background: var(--board-2);
                border: 1px solid var(--hair-dark);
                border-radius: 10px;
                padding: 0 0 18px;
                box-shadow: 0 30px 80px -30px rgba(0,0,0,.7);
            }
            .strip-head {
                display: flex; justify-content: space-between; align-items: center;
                padding: 12px 18px; border-bottom: 1px solid var(--hair-dark);
                font-family: var(--font-mono); font-size: 11px; letter-spacing: .12em;
                color: var(--ink-3); text-transform: uppercase;
            }
            .strip-head .live { color: var(--timing-lit); }
            .strip-head .live::before { content: ""; display: inline-block; width: 7px; height: 7px;
                border-radius: 99px; background: var(--timing-lit); margin-inline-end: 7px;
                animation: pulse 1.6s ease-in-out infinite; }
            @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: .25; } }
            .strip-dish {
                margin: 18px 18px 0; height: 120px; border-radius: 6px;
                background: linear-gradient(155deg, #2E251D 0%, #241C15 60%, #1E1712 100%);
                border: 1px solid var(--hair-dark);
                display: flex; align-items: flex-end; padding: 14px 16px;
            }
            .strip-dish span { font-family: var(--font-display); font-weight: 700; text-transform: uppercase;
                font-size: 26px; letter-spacing: .02em; color: var(--print); }
            .strip-dish small { margin-inline-start: auto; font-family: var(--font-mono); font-size: 11px;
                color: var(--ink-3); border: 1px solid var(--hair-dark); border-radius: 3px; padding: 3px 7px; }
            .lane { padding: 16px 18px 0; display: grid; grid-template-columns: 1fr auto; gap: 4px 14px; }
            .lane small { font-family: var(--font-mono); font-size: 11px; letter-spacing: .1em;
                text-transform: uppercase; color: var(--ink-3); }
            .lane .claimed { font-family: var(--font-mono); font-size: 22px; color: var(--ink-3);
                text-decoration: line-through; text-decoration-color: var(--accent);
                text-decoration-thickness: 2px; text-align: right; }
            .lane .really-l { grid-row: 2; }
            .lane .really {
                grid-row: 2; grid-column: 2; text-align: right;
                font-family: var(--font-display); font-weight: 800; font-size: 56px; line-height: 1;
                color: var(--timing-lit); font-variant-numeric: tabular-nums; letter-spacing: .02em;
            }
            .lane .really .ghost { color: #2E2620; }
            .lane .delta { grid-row: 3; grid-column: 2; justify-self: end; margin-top: 6px;
                font-family: var(--font-mono); font-size: 12.5px; font-weight: 700; color: #F0B39C;
                background: rgba(232,106,51,.14); border: 1px solid rgba(232,106,51,.4);
                border-radius: 3px; padding: 2px 8px; }
            .lane .who { grid-row: 3; align-self: end; font-size: 12px; color: var(--ink-3); }
            .strip-foot { margin: 16px 18px 0; border-top: 1px dashed var(--hair-dark);
                padding-top: 12px; font-family: var(--font-mono); font-size: 10.5px;
                letter-spacing: .08em; color: var(--ink-3); text-transform: uppercase; }
            @media (max-width: 940px) {
                .hero .wrap { grid-template-columns: 1fr; gap: 44px; }
                .strip-shell { max-width: 460px; }
            }

            /* ---------- ticker ---------- */
            .ticker { border-block: 1px solid var(--hair-dark); background: var(--board-2);
                overflow: hidden; white-space: nowrap; }
            .ticker-track { display: inline-flex; gap: 0; padding: 13px 0;
                animation: tick 60s linear infinite; }
            .ticker:hover .ticker-track { animation-play-state: paused; }
            @keyframes tick { to { transform: translateX(-50%); } }
            .tick-item { display: inline-flex; align-items: center; gap: 10px; padding: 0 28px;
                font-family: var(--font-mono); font-size: 12.5px; color: var(--ink-3);
                border-right: 1px solid var(--hair-dark); }
            .tick-item b { color: var(--print); font-weight: 600; }
            .tick-item .from { text-decoration: line-through; text-decoration-color: var(--accent); }
            .tick-item .to { color: var(--timing-lit); font-weight: 700; }
            @media (prefers-reduced-motion: reduce) {
                .ticker-track { animation: none; }
                .strip-head .live::before { animation: none; }
            }

            /* ---------- sections ---------- */
            section { padding: 88px 0; }
            h2 {
                font-family: var(--font-display); font-weight: 800; text-transform: uppercase;
                font-size: clamp(2.1rem, 4.2vw, 3.4rem); line-height: .98;
                letter-spacing: -.005em; margin: 0 0 14px; text-wrap: balance;
            }
            h2 em { font-style: normal; color: var(--timing-lit); }
            .sec-lede { font-size: 17px; max-width: 44em; margin: 0 0 46px; color: #CFC4B8; }
            .paper .sec-lede { color: var(--ink-2); }

            /* paper reversal — the printed timing sheet */
            .paper { background: var(--paper); color: var(--ink); }
            .sheet {
                border: 1px solid var(--hair-light); background: #fff; border-radius: 8px;
                box-shadow: 0 1px 0 #fff inset, 0 24px 60px -34px rgba(36,29,23,.35);
                overflow: hidden;
            }
            .sheet-head { display: flex; justify-content: space-between; align-items: center;
                padding: 14px 24px; border-bottom: 2px solid var(--ink);
                font-family: var(--font-mono); font-size: 11.5px; letter-spacing: .14em;
                text-transform: uppercase; color: var(--ink-2); }
            .lane-row { display: grid; grid-template-columns: 96px 1fr; gap: 26px;
                padding: 30px 24px; border-bottom: 1px solid var(--hair-light); }
            .lane-row:last-child { border-bottom: 0; }
            .lane-no { font-family: var(--font-mono); font-size: 13px; color: var(--accent-deep);
                border: 1px solid var(--hair-light); border-radius: 4px; height: fit-content;
                padding: 6px 10px; letter-spacing: .1em; }
            .lane-row h3 { margin: 0 0 8px; font-size: 21px; font-weight: 800; letter-spacing: -.01em; }
            .lane-row p { margin: 0; color: var(--ink-2); max-width: 58ch; }
            .lane-read { display: block; margin-top: 14px; font-family: var(--font-mono);
                font-size: 12.5px; color: var(--timing); }
            .lane-read b { letter-spacing: .04em; }
            @media (max-width: 700px) {
                .lane-row { grid-template-columns: 1fr; gap: 14px; }
            }

            /* reality board */
            .board-head { display: flex; align-items: baseline; justify-content: space-between;
                flex-wrap: wrap; gap: 12px; }
            .board-note { font-family: var(--font-mono); font-size: 12px; color: var(--ink-3); }
            .board-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 26px; }
            @media (max-width: 940px) { .board-grid { grid-template-columns: 1fr; } }
            .board { border: 1px solid var(--hair-dark); border-radius: 8px; overflow: hidden;
                background: var(--board-2); }
            .board h3 { margin: 0; padding: 13px 18px; font-family: var(--font-mono); font-size: 12px;
                letter-spacing: .12em; text-transform: uppercase; border-bottom: 1px solid var(--hair-dark);
                color: var(--ink-3); font-weight: 600; }
            .board h3 b { color: var(--print); }
            .board h3 .over { color: #F0B39C; }
            .board h3 .under { color: var(--timing-lit); }
            .r-row { display: grid; grid-template-columns: 1fr auto auto; gap: 6px 16px;
                align-items: center; padding: 13px 18px; border-bottom: 1px solid var(--hair-dark);
                text-decoration: none; transition: background .12s ease; }
            .r-row:hover { background: #241C15; }
            .r-row:last-child { border-bottom: 0; }
            .r-title { font-size: 14.5px; font-weight: 600; overflow: hidden; text-overflow: ellipsis;
                white-space: nowrap; }
            .r-nums { font-family: var(--font-mono); font-size: 13px; text-align: right;
                font-variant-numeric: tabular-nums; white-space: nowrap; }
            .r-nums s { color: var(--ink-3); margin-inline-end: 8px; }
            .r-nums b { color: var(--timing-lit); font-weight: 700; }
            .r-gap { font-family: var(--font-mono); font-size: 12px; font-weight: 700; text-align: right;
                border-radius: 3px; padding: 2px 8px; white-space: nowrap; }
            .r-gap.slow { color: #F0B39C; background: rgba(232,106,51,.13); border: 1px solid rgba(232,106,51,.35); }
            .r-gap.fast { color: var(--timing-lit); background: var(--timing-dim); border: 1px solid rgba(95,189,177,.35); }
            .r-src { grid-column: 1 / -1; font-family: var(--font-mono); font-size: 10px;
                letter-spacing: .1em; color: var(--ink-3); text-transform: uppercase; }
            .board-foot { padding: 12px 18px; border-top: 1px solid var(--hair-dark);
                font-family: var(--font-mono); font-size: 11px; color: var(--ink-3); }

            /* feature lanes (asymmetric rows, not cards) */
            .lane-feature { display: grid; grid-template-columns: 64px 1.1fr 1fr; gap: 30px;
                align-items: start; padding: 34px 0; border-top: 1px solid var(--hair-dark); }
            .lane-feature:first-of-type { border-top: 0; padding-top: 8px; }
            .f-ico { width: 52px; height: 52px; border: 1px solid var(--hair-dark); border-radius: 8px;
                display: flex; align-items: center; justify-content: center; color: var(--timing-lit); }
            .lane-feature h3 { margin: 0 0 8px; font-family: var(--font-display); font-weight: 700;
                text-transform: uppercase; font-size: 28px; line-height: 1; letter-spacing: .01em; }
            .lane-feature .f-claim { margin: 0; color: #CFC4B8; font-size: 15.5px; max-width: 34em; }
            .lane-feature .f-data { font-family: var(--font-mono); font-size: 13px; color: var(--ink-3);
                border-inline-start: 1px solid var(--hair-dark); padding-inline-start: 26px; }
            .lane-feature .f-data b { display: block; color: var(--timing-lit); font-size: 26px;
                font-weight: 700; margin-bottom: 4px; }
            @media (max-width: 860px) {
                .lane-feature { grid-template-columns: 52px 1fr; }
                .lane-feature .f-data { grid-column: 2; border-inline-start: 0; padding-inline-start: 0; }
            }

            /* download plate */
            .dl { border: 1px solid var(--hair-dark); border-radius: 10px; background: var(--board-2);
                padding: 54px 48px; display: flex; align-items: center; justify-content: space-between;
                gap: 34px; flex-wrap: wrap; position: relative; overflow: hidden; }
            .dl::after { content: ""; position: absolute; inset: 0; pointer-events: none;
                background:
                    repeating-linear-gradient(0deg, transparent 0 47px, rgba(251,248,243,.03) 47px 48px); }
            .dl > * { position: relative; z-index: 1; }
            .dl h2 { margin-bottom: 8px; }
            .dl-meta { font-family: var(--font-mono); font-size: 13px; color: var(--ink-3); margin: 0 0 24px; }
            .dl-meta b { color: var(--print); }

            /* FAQ */
            .faq-list { max-width: 780px; }
            .faq-item { border-top: 1px solid var(--hair-dark); padding: 26px 0; }
            .faq-item:last-child { border-bottom: 1px solid var(--hair-dark); }
            .faq-item h3 { margin: 0 0 10px; font-size: 17.5px; font-weight: 700; }
            .faq-item p { margin: 0; color: #CFC4B8; max-width: 62ch; }
            /* FAQ sits on the paper reversal — answers must be ink, not board-gray. */
            .paper .faq-item h3 { color: var(--ink); }
            .paper .faq-item p { color: var(--ink-2); }

            footer { border-top: 1px solid var(--hair-dark); padding: 30px 0 40px; }
            .foot-inner { display: flex; justify-content: space-between; flex-wrap: wrap; gap: 12px;
                font-family: var(--font-mono); font-size: 12px; color: var(--ink-3); }
            footer a { text-decoration: none; }
            footer a:hover { color: var(--print); }
        </style>
    </head>
    <body>
<!--
DESIGN CONTRACT — THE TIMING BOARD (code-led; seed key rrland01)
THESIS: RecipeReal is the official timing body of home cooking — recipes state
a claim, the clock states a fact. The category default (warm food-blog hero +
feature card grid) is refused; the page is an instrument board, not a brochure.
OWN-WORLD: charred-ink board #171310, cream print #FBF8F3, teal #287C78/#5FBDB1
reserved for measured time, terracotta #E86A33 reserved for action, hairline
rules #332A22, Big Shoulders condensed caps + tabular mono numerals, printed
paper #FAF7F1 for one reversal section.
STORY: the visitor sees the mechanism (claim struck, measured reality settles
on the clock), reads REAL board data from the live Reality Index, understands
halal-first + offline + community, and installs the APK.
FIRST VIEWPORT: dark board; left = H1 "RECIPES LIE ABOUT TIME. / WE KEEP THE
REAL CLOCK." (claim struck in terracotta, REAL in teal) + lede + Download /
How-it-works CTAs + three real-count proof cells; right = the timing strip
(butter-chicken demo row, claim 25:00 struck, REALLY 38:12 in segment-settle
flip with ghost cells, +13:12 delta chip, DEMO tag for honesty).
FORM: assigned direction 7 (race-telemetry timing board) raised by declined
challengers — ghost unlit cells + instant segment-swap digits (seven-segment
world), state shown by stroke pattern not hue (jackfield), one printed paper
reversal section (timetable), empty-slot honesty in the Reality Index empty
state (VHS shelf gap).
FINISH: unreviewed and undocumented is unfinished; this build ends with the
finish review, the verdict, DESIGN.md, and every shipping raster carrying its
provenance.
-->
        <div class="nav">
            <div class="wrap nav-inner">
                <a class="brand" href="/">
                    <span class="brand-tile"><img src="/img/recipereallogo.webp" alt="" width="30" height="30"></span>
                    <b>Recipe<em>Real</em></b>
                </a>
                <nav class="nav-links" aria-label="Page">
                    <a href="#board" class="hide-m">The board</a>
                    <a href="#clock" class="hide-m">How it works</a>
                    <a href="#faq" class="hide-m">FAQ</a>
                    <a href="#download" class="btn btn-accent btn-sm">Download</a>
                </nav>
            </div>
        </div>

        <header class="hero">
            <div class="wrap">
                <div>
                    <h1>
                        <span class="lie">Recipes lie</span> about time.<br>
                        We keep the <span class="real">real</span> clock.
                    </h1>
                    <p class="lede">
                        Every recipe states a claim. RecipeReal states a <b>measurement</b> —
                        clock-checked cooking across <b>20,089 recipes</b>, tuned to how
                        <b>you</b> actually cook. Halal-first. Works offline.
                    </p>
                    <div class="hero-cta">
                        <a class="btn btn-accent" href="#download">
                            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3v12"/><path d="m7 11 5 5 5-5"/><path d="M5 21h14"/></svg>
                            Download the APK
                        </a>
                        <a class="btn btn-line" href="#clock">How the clock works</a>
                    </div>
                    <div class="hero-proof" role="img" aria-label="20,089 recipes, 137,644 steps, 26,771 steps carry a parsed cook time">
                        <div><b>20,089</b><span>recipes</span></div>
                        <div><b>137,644</b><span>steps</span></div>
                        <div><b>26,771</b><span>timed steps</span></div>
                    </div>
                </div>

                <div class="strip-shell">
                    <div class="strip" aria-label="Product demonstration: a recipe timing strip">
                        <div class="strip-head">
                            <span class="live">Timing board</span>
                            <span>demo row</span>
                        </div>
                        <div class="strip-dish">
                            <span>Butter chicken</span>
                            <small>DEMO</small>
                        </div>
                        <div class="lane">
                            <small class="claimed-l">Recipe says</small>
                            <span class="claimed mono">25:00</span>
                            <small class="really-l">Really takes</small>
                            <span class="really" data-settle="38:12" aria-label="Really takes 38 minutes 12 seconds">
                                <span class="ghost">88:88</span><span class="lit">38:12</span>
                            </span>
                            <span class="who">community clock · pause-adjusted</span>
                            <span class="delta">+13:12 over claim</span>
                        </div>
                        <div class="strip-foot">Clock keeps running with the screen off</div>
                    </div>
                </div>
            </div>
        </header>

        <div class="ticker" aria-hidden="true">
            <div class="ticker-track">
                @foreach (array_merge($ticker, $ticker) as $i => $row)
                    <span class="tick-item">
                        <b>{{ $row['title'] }}</b>
                        <span class="from">{{ $row['claimed'] }}</span>
                        <span>→</span>
                        <span class="to">{{ $row['real'] }}</span>
                        <span>{{ $row['delta'] }}</span>
                    </span>
                @endforeach
            </div>
        </div>

        <section class="paper" id="clock">
            <div class="wrap">
                <h2>One clock. <br>Three ways it earns your trust.</h2>
                <p class="sec-lede">
                    Most cook times are marketing. Ours are a measurement pipeline —
                    printed here like a timing sheet, because numbers you cook against
                    should show their work.
                </p>
                <div class="sheet">
                    <div class="sheet-head">
                        <span>Procedure · RecipeReal clock</span>
                        <span>Rev 2026-08</span>
                    </div>
                    <div class="lane-row">
                        <span class="lane-no">STEP A</span>
                        <div>
                            <h3>The recipe states its claim</h3>
                            <p>Publisher minutes go on record exactly as printed — no rounding in the brand's favor, no cleanup hidden in the margins.</p>
                            <span class="lane-read">FIELD <b>claim</b> · source: publisher</span>
                        </div>
                    </div>
                    <div class="lane-row">
                        <span class="lane-no">STEP B</span>
                        <div>
                            <h3>You cook against the stopwatch</h3>
                            <p>Cook Mode runs a pause-adjusted clock across every step, with alarms that ring even on a locked phone. Each step you finish files a real measurement.</p>
                            <span class="lane-read">FIELD <b>actual</b> · source: your kitchen</span>
                        </div>
                    </div>
                    <div class="lane-row">
                        <span class="lane-no">STEP C</span>
                        <div>
                            <h3>The estimate bends toward you</h3>
                            <p>Your pace calibrates the whole library. "Really takes" stops being a promise and starts being a prediction — yours.</p>
                            <span class="lane-read">FIELD <b>really takes</b> · tuned per cook</span>
                        </div>
                    </div>
                </div>
            </div>
        </section>

        <section id="board">
            <div class="wrap">
                <div class="board-head">
                    <div>
                        <h2>The Reality <em>Index</em></h2>
                        <p class="sec-lede">Live from the library: the biggest gaps between what recipes claim and what the clock says. Tap any row to see it.</p>
                    </div>
                    <span class="board-note">refreshed every 15 min · sanity-bounded</span>
                </div>
                <div class="board-grid">
                    <div class="board">
                        <h3><b class="under">Runs long</b> — claimed vs clock</h3>
                        @forelse ($over as $row)
                            <a class="r-row" href="/r/{{ $row['id'] }}">
                                <span class="r-title">{{ $row['title'] }}</span>
                                <span class="r-nums"><s>{{ $row['claimed'] }}</s><b>{{ $row['real'] }}</b></span>
                                <span class="r-gap slow">{{ $row['delta'] }}</span>
                                <span class="r-src">{{ $row['src'] }}</span>
                            </a>
                        @empty
                            <div class="r-row"><span class="r-title">The board opens with the first published measurements.</span></div>
                        @endforelse
                        <div class="board-foot">gap = measured − claimed, pause-adjusted</div>
                    </div>
                    <div class="board">
                        <h3><b class="under">Runs fast</b> — clock vs claimed</h3>
                        @forelse ($under as $row)
                            <a class="r-row" href="/r/{{ $row['id'] }}">
                                <span class="r-title">{{ $row['title'] }}</span>
                                <span class="r-nums"><s>{{ $row['claimed'] }}</s><b>{{ $row['real'] }}</b></span>
                                <span class="r-gap fast">{{ $row['delta'] }}</span>
                                <span class="r-src">{{ $row['src'] }}</span>
                            </a>
                        @empty
                            <div class="r-row"><span class="r-title">The board opens with the first published measurements.</span></div>
                        @endforelse
                        <div class="board-foot">the clock also catches recipes that undersell</div>
                    </div>
                </div>
            </div>
        </section>

        <section>
            <div class="wrap">
                <h2>Built like it cooks.</h2>
                <p class="sec-lede">No feature exists for the screenshot. Each one survives a real evening: no signal, a locked phone, a family waiting.</p>

                <div class="lane-feature">
                    <span class="f-ico">
                        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                            <path d="M12 2 4.5 5v6c0 4.6 3.2 8.6 7.5 10 4.3-1.4 7.5-5.4 7.5-10V5L12 2Z"/>
                            <path d="M15.3 9.3a4.5 4.5 0 1 0 0 5.4 3.6 3.6 0 1 1 0-5.4Z" fill="currentColor" stroke="none"/>
                        </svg>
                    </span>
                    <div>
                        <h3>Halal-first, on record</h3>
                        <p class="f-claim">The library is screened against explicit pork and alcohol rules — the standard is written down, applied across all {{ number_format(20089) }} recipes, not sprinkled on.</p>
                    </div>
                    <div class="f-data"><b>100%</b>of the library screened</div>
                </div>

                <div class="lane-feature">
                    <span class="f-ico">
                        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                            <path d="m2 2 20 20"/>
                            <path d="M8.5 16.5a5 5 0 0 1 7 0"/>
                            <path d="M5 13a10 10 0 0 1 5.3-2.8"/>
                            <path d="M13.6 10.1A10 10 0 0 1 19 13"/>
                            <path d="M2 8.8A15 15 0 0 1 9 6.2"/>
                            <path d="M15.5 6.4A15 15 0 0 1 22 8.8"/>
                            <path d="M12 20h.01"/>
                        </svg>
                    </span>
                    <div>
                        <h3>The whole library, offline</h3>
                        <p class="f-claim">Recipes, steps and the clock all live on your phone. Cook in a kitchen with the worst signal in the house — nothing stops.</p>
                    </div>
                    <div class="f-data"><b>0 bars</b>required to finish a cook</div>
                </div>

                <div class="lane-feature">
                    <span class="f-ico">
                        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                            <circle cx="12" cy="12" r="9"/>
                            <path d="M12 7v5l3 2"/>
                            <path d="M19 5.5 21 3.5"/><path d="M5 3.5 7 5.5"/>
                        </svg>
                    </span>
                    <div>
                        <h3>Cook Mode keeps the clock honest</h3>
                        <p class="f-claim">A full-screen stopwatch with pause you can trust, step alarms that ring on a locked phone, and a persistent timer while the app sleeps.</p>
                    </div>
                    <div class="f-data"><b>250 ms</b>tick · wall-clock derived</div>
                </div>

                <div class="lane-feature">
                    <span class="f-ico">
                        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                            <path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 8.9 8.9 0 0 1-3.3-.6L3 21l1.7-4.6a8.4 8.4 0 1 1 16.3-4.9Z"/>
                            <path d="M8 10h8"/><path d="M8 13.5h5"/>
                        </svg>
                    </span>
                    <div>
                        <h3>A community that files results</h3>
                        <p class="f-claim">Post your try, follow cooks you trust, and read the notes on any recipe. Every measurement anyone files makes the board sharper.</p>
                    </div>
                    <div class="f-data"><b>Every cook</b>calibrates the next estimate</div>
                </div>
            </div>
        </section>

        <section id="download">
            <div class="wrap">
                <div class="dl">
                    <div>
                        <h2>Put the clock <em>on your phone.</em></h2>
                        <p class="dl-meta">
                            @isset($latestRelease)
                                Version <b>{{ $latestRelease->version }}</b>
                                &nbsp;·&nbsp; {{ $latestRelease->humanSize() }}
                                &nbsp;·&nbsp; {{ $latestRelease->created_at->format('M j, Y') }}
                                &nbsp;·&nbsp; Android 7.0+ · arm64
                            @else
                                First public build landing shortly · Android 7.0+ · arm64
                            @endisset
                        </p>
                        @isset($latestRelease)
                            <a class="btn btn-accent" href="{{ route('app.download') }}">
                                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3v12"/><path d="m7 11 5 5 5-5"/><path d="M5 21h14"/></svg>
                                Download APK — free
                            </a>
                            <p class="dl-meta" style="margin-top:14px">Direct install: allow "install unknown apps" when Android asks. No store account needed.</p>
                        @else
                            <span class="btn btn-line" aria-disabled="true">Coming soon</span>
                        @endisset
                    </div>
                    <div class="strip" style="min-width:250px" aria-hidden="true">
                        <div class="strip-head"><span class="live">Tonight</span><span>{{ date('D H:i') }}</span></div>
                        <div class="lane">
                            <small class="claimed-l">Dinner promised</small>
                            <span class="claimed mono">19:30</span>
                            <small class="really-l">Actually ready</small>
                            <span class="really">19:30</span>
                            <span class="who"></span>
                            <span class="delta" style="color:#9ED8CF;background:rgba(95,189,177,.12);border-color:rgba(95,189,177,.35)">ON TIME</span>
                        </div>
                        <div class="strip-foot">The only metric that matters</div>
                    </div>
                </div>
            </div>
        </section>

        <section id="faq" class="paper" style="padding-top:76px;padding-bottom:76px">
            <div class="wrap">
                <h2>Asked, answered.</h2>
                <p class="sec-lede">Short answers here; the long versions live in the app.</p>
                <div class="faq-list">
                    <div class="faq-item">
                        <h3>What is RecipeReal?</h3>
                        <p>RecipeReal is a recipe app for Android that checks cookbook claims against a stopwatch. Recipes state a time; cooks measure what actually happens in guided Cook Mode; every recipe ends up with a claim and a reality, and estimates tune themselves to your pace.</p>
                    </div>
                    <div class="faq-item">
                        <h3>Why do recipe times lie?</h3>
                        <p>Published times usually cover only the ideal case: a professional stove, prep done off-camera, and no cleanup. RecipeReal records the whole span — prep to plate — and shows the gap between claim and reality on every recipe.</p>
                    </div>
                    <div class="faq-item">
                        <h3>Are the recipes halal?</h3>
                        <p>Yes — that is the point of the product. The library is screened against explicit pork and alcohol rules before it ever reaches the app, and community posts and notes pass the same gate.</p>
                    </div>
                    <div class="faq-item">
                        <h3>Does it work without internet?</h3>
                        <p>Yes. The library downloads to your phone — recipes, steps and the cooking clock all run locally, so a dead zone in the kitchen never stops dinner.</p>
                    </div>
                    <div class="faq-item">
                        <h3>How much does it cost?</h3>
                        <p>The app is free to use with a monthly recipe allowance. Premium (US $5.99/month or $49.99/year) adds unlimited cooking and pace calibration, and is clearly marked inside the app before anything is charged.</p>
                    </div>
                    <div class="faq-item">
                        <h3>Is there an iPhone version?</h3>
                        <p>Android first — the direct APK installs on Android 7.0 and newer. An iOS build is on the roadmap once the Android experience is settled.</p>
                    </div>
                </div>
            </div>
        </section>

        <footer>
            <div class="wrap foot-inner">
                <span>© {{ date('Y') }} RecipeReal — the real clock for recipes</span>
                <span>
                    <a href="/privacy">Privacy</a>
                    &nbsp;·&nbsp;
                    <a href="/admin">Admin</a>
                </span>
            </div>
        </footer>

        <script type="application/ld+json">
        {
          "@@context": "https://schema.org",
          "@graph": [
            {
              "@type": "Organization",
              "@id": "https://recipe-real.softland.tech/#org",
              "name": "RecipeReal",
              "url": "https://recipe-real.softland.tech/",
              "logo": "https://recipe-real.softland.tech/img/recipereallogo.webp"
            },
            {
              "@type": "WebSite",
              "url": "https://recipe-real.softland.tech/",
              "name": "RecipeReal",
              "publisher": { "@id": "https://recipe-real.softland.tech/#org" }
            },
            {
              "@type": "SoftwareApplication",
              "name": "RecipeReal",
              "applicationCategory": "FoodApplication",
              "operatingSystem": "Android 7.0+",
              "url": "https://recipe-real.softland.tech/",
              "description": "Halal-first recipe app with stopwatch-verified cook times: claim vs reality on every recipe, an offline library, and guided Cook Mode with step alarms.",
              "softwareVersion": "{{ isset($latestRelease) ? $latestRelease->version : '1.0.0' }}",
              "offers": {
                "@type": "Offer",
                "price": "0",
                "priceCurrency": "USD",
                "availability": "https://schema.org/InStock"
              },
              "author": { "@id": "https://recipe-real.softland.tech/#org" }
            },
            {
              "@type": "FAQPage",
              "mainEntity": [
                { "@type": "Question", "name": "What is RecipeReal?",
                  "acceptedAnswer": { "@type": "Answer", "text": "RecipeReal is a recipe app for Android that checks cookbook claims against a stopwatch. Recipes state a time; cooks measure what actually happens in guided Cook Mode; every recipe ends up with a claim and a reality, and estimates tune themselves to your pace." } },
                { "@type": "Question", "name": "Why do recipe times lie?",
                  "acceptedAnswer": { "@type": "Answer", "text": "Published times usually cover only the ideal case: a professional stove, prep done off-camera, and no cleanup. RecipeReal records the whole span — prep to plate — and shows the gap between claim and reality on every recipe." } },
                { "@type": "Question", "name": "Are the recipes halal?",
                  "acceptedAnswer": { "@type": "Answer", "text": "Yes — that is the point of the product. The library is screened against explicit pork and alcohol rules before it ever reaches the app, and community posts and notes pass the same gate." } },
                { "@type": "Question", "name": "Does RecipeReal work without internet?",
                  "acceptedAnswer": { "@type": "Answer", "text": "Yes. The library downloads to your phone — recipes, steps and the cooking clock all run locally, so a dead zone in the kitchen never stops dinner." } },
                { "@type": "Question", "name": "How much does RecipeReal cost?",
                  "acceptedAnswer": { "@type": "Answer", "text": "The app is free to use with a monthly recipe allowance. Premium (US $5.99/month or $49.99/year) adds unlimited cooking and pace calibration, and is clearly marked inside the app before anything is charged." } },
                { "@type": "Question", "name": "Is there an iPhone version of RecipeReal?",
                  "acceptedAnswer": { "@type": "Answer", "text": "Android first — the direct APK installs on Android 7.0 and newer. An iOS build is on the roadmap once the Android experience is settled." } }
              ]
            }
          ]
        }
        </script>

        <script>
        // THE CLOCK SETTLES — signature moment. On first view, the "really
        // takes" digits flip through provisional splits (instant swaps, the
        // seven-segment way) and settle on the real community value.
        (function () {
            var target = document.querySelector(".really[data-settle]");
            if (!target || !("IntersectionObserver" in window)) return;
            var lit = target.querySelector(".lit");
            if (!lit) return;
            var final = target.getAttribute("data-settle");
            var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
            function swap(v) {
                var s = target.querySelector(".ghost");
                if (s) s.parentNode.removeChild(s);
                lit.textContent = v;
            }
            function run() {
                if (reduced) { swap(final); return; }
                var i = 0;
                var picks = ["41:07", "33:48", "52:19", "36:55", "44:02", "39:31"];
                var timer = setInterval(function () {
                    if (i < picks.length) { swap(picks[i++]); return; }
                    clearInterval(timer);
                    swap(final);
                    var chip = document.querySelector(".strip .delta");
                    if (chip) { chip.style.opacity = "0"; chip.style.transition = "opacity .3s";
                        requestAnimationFrame(function () { chip.style.opacity = "1"; }); }
                }, 90);
            }
            var seen = false;
            var io = new IntersectionObserver(function (entries) {
                entries.forEach(function (e) {
                    if (e.isIntersecting && !seen) { seen = true; run(); io.disconnect(); }
                });
            }, { threshold: 0.4 });
            io.observe(target);
        })();
        </script>
    </body>
</html>
