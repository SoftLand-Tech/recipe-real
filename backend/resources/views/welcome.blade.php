<!DOCTYPE html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}">
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>RecipeReal — Honest cook times, before you start chopping.</title>
        <meta name="description" content="Stopwatch-verified cook times, an offline recipe library, and guided Cook Mode. Free Android app.">
        <meta property="og:title" content="RecipeReal — Honest cook times">
        <meta property="og:description" content="Stopwatch-verified cook times, offline recipe library, guided Cook Mode. Free Android app.">
        <meta property="og:image" content="{{ asset('img/recipereallogo.webp') }}">
        <style>
            /* RecipeReal landing — mirrors the mobile design system:
               warm canvas, terracotta accent, timing-teal for time data. */
            *, *::before, *::after { box-sizing: border-box; }
            html { scroll-behavior: smooth; }
            body {
                margin: 0;
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto,
                    Helvetica, Arial, sans-serif;
                background: #FAF8F5;
                color: #241D17;
                line-height: 1.6;
                -webkit-font-smoothing: antialiased;
            }
            a { color: inherit; }
            .wrap { max-width: 1040px; margin: 0 auto; padding: 0 22px; }

            /* ---- buttons ---- */
            .btn {
                display: inline-flex; align-items: center; gap: 9px;
                padding: 13px 26px; border-radius: 999px;
                font-weight: 700; font-size: 15px; text-decoration: none;
                border: 1px solid transparent; cursor: pointer;
                transition: transform .12s ease, background .15s ease, border-color .15s ease;
            }
            .btn-primary { background: #E86A33; color: #fff; }
            .btn-primary:hover { background: #C95222; }
            .btn-ghost { background: #F1EBE4; color: #241D17; border-color: #E8E1DC; }
            .btn-ghost:hover { border-color: #D5CCC3; }
            .btn-sm { padding: 9px 18px; font-size: 13.5px; }

            /* ---- nav ---- */
            nav { padding: 18px 0; }
            .nav-inner { display: flex; align-items: center; justify-content: space-between; gap: 14px; }
            .brand { display: flex; align-items: center; gap: 10px; text-decoration: none; }
            .brand img { width: 34px; height: 34px; border-radius: 9px; }
            .brand b { font-size: 19px; letter-spacing: -0.02em; }
            .brand b span { color: #BF5523; }
            .nav-links { display: flex; align-items: center; gap: 8px; }

            /* ---- hero ---- */
            .hero { padding: 64px 0 58px; }
            .hero-grid { display: grid; grid-template-columns: 1.15fr .85fr; gap: 48px; align-items: center; }
            .kicker {
                display: inline-flex; align-items: center; gap: 8px;
                background: #FBE9DE; color: #BF5523;
                font-size: 12.5px; font-weight: 700; letter-spacing: .04em;
                text-transform: uppercase;
                border-radius: 999px; padding: 7px 14px; margin-bottom: 18px;
            }
            h1 {
                font-size: clamp(2.1rem, 4.6vw, 3.3rem); line-height: 1.12;
                letter-spacing: -0.025em; font-weight: 800; margin: 0 0 18px;
            }
            h1 em { font-style: normal; color: #BF5523; }
            .sub { font-size: 18px; color: #6E6357; margin: 0 0 30px; max-width: 32em; }
            .hero-cta { display: flex; flex-wrap: wrap; gap: 12px; align-items: center; }

            /* CSS "app card" — the two-stat Reality pair from the app */
            .phone-card {
                background: #fff; border: 1px solid #E8E1DC; border-radius: 24px;
                padding: 26px 26px 22px; max-width: 360px; margin: 0 auto;
                box-shadow: 0 24px 60px -28px rgba(36,29,23,.25);
            }
            .phone-card .dish { width: 100%; height: 168px; border-radius: 16px;
                background:
                  radial-gradient(circle at 30% 25%, #F3D9C4 0 18%, transparent 19%),
                  radial-gradient(circle at 68% 40%, #E8B58C 0 22%, transparent 23%),
                  radial-gradient(circle at 45% 75%, #F3D9C4 0 15%, transparent 16%),
                  linear-gradient(140deg, #FBE9DE, #F6E7D8);
                margin-bottom: 18px; }
            .stat-pair { display: flex; gap: 12px; }
            .stat { flex: 1; border-radius: 14px; padding: 12px 14px; }
            .stat small { display: block; font-size: 11px; font-weight: 700;
                letter-spacing: .05em; text-transform: uppercase; opacity: .75; }
            .stat b { font-size: 26px; font-weight: 800; letter-spacing: -0.02em; }
            .stat-claim { background: #F5F0EA; color: #6E6357; }
            .stat-real { background: #E4F0EF; color: #287C78; }
            .stat-cap { margin-top: 12px; font-size: 12.5px; color: #A99E92; text-align: center; }
            .stat-cap b { color: #287C78; }

            /* ---- sections ---- */
            section { padding: 64px 0; }
            section.alt { background: #F4EFE9; border-block: 1px solid #EFE7DE; }
            .sec-head { text-align: center; max-width: 620px; margin: 0 auto 40px; }
            h2 { font-size: clamp(1.55rem, 3vw, 2.1rem); letter-spacing: -0.02em;
                 font-weight: 800; margin: 0 0 10px; }
            .sec-sub { color: #6E6357; font-size: 16.5px; margin: 0; }

            .steps { display: grid; grid-template-columns: repeat(3, 1fr); gap: 18px; }
            .step { background: #fff; border: 1px solid #E8E1DC; border-radius: 18px; padding: 24px; }
            .step-num { width: 34px; height: 34px; border-radius: 999px; background: #FBE9DE;
                color: #BF5523; font-weight: 800; display: flex; align-items: center;
                justify-content: center; margin-bottom: 14px; }
            .step h3 { margin: 0 0 6px; font-size: 17px; letter-spacing: -0.01em; }
            .step p { margin: 0; color: #6E6357; font-size: 14.5px; }

            .feats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 18px; }
            .feat { background: #fff; border: 1px solid #E8E1DC; border-radius: 18px; padding: 22px; }
            .feat .ico { font-size: 22px; margin-bottom: 10px; display: block; }
            .feat h3 { margin: 0 0 6px; font-size: 16.5px; }
            .feat p { margin: 0; color: #6E6357; font-size: 14.5px; }

            /* ---- download ---- */
            .dl-card {
                background: linear-gradient(150deg, #241D17, #3A2E22);
                color: #FBF8F3; border-radius: 26px; padding: 46px 40px;
                display: flex; align-items: center; gap: 36px; justify-content: space-between;
                flex-wrap: wrap;
            }
            .dl-brand { display: flex; align-items: center; gap: 20px; }
            .dl-brand img { width: 84px; height: 84px; border-radius: 22px;
                box-shadow: 0 10px 30px rgba(0,0,0,.35); }
            .dl-brand h3 { margin: 0 0 4px; font-size: 24px; letter-spacing: -0.02em; }
            .dl-brand p { margin: 0; color: #CFC4B8; font-size: 14px; }
            .dl-meta { text-align: right; }
            .dl-ver { font-size: 13px; color: #CFC4B8; margin-bottom: 12px; }
            .dl-ver b { color: #FBF8F3; }
            .dl-note { margin-top: 10px; font-size: 12px; color: #9C9084; }

            /* ---- pricing ---- */
            .plans { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 18px; max-width: 760px; margin: 0 auto; }
            .plan { background: #fff; border: 1px solid #E8E1DC; border-radius: 20px; padding: 28px; position: relative; }
            .plan.featured { border: 2px solid #E86A33; }
            .plan .tag { position: absolute; top: -12px; inset-inline-start: 24px; background: #E86A33;
                color: #fff; font-size: 11.5px; font-weight: 800; letter-spacing: .05em;
                text-transform: uppercase; border-radius: 999px; padding: 5px 12px; }
            .plan h3 { margin: 0; font-size: 17px; color: #6E6357; }
            .plan .price { font-size: 34px; font-weight: 800; letter-spacing: -0.02em; margin: 6px 0 14px; }
            .plan .price span { font-size: 14px; font-weight: 600; color: #A99E92; }
            .plan ul { margin: 0 0 20px; padding: 0; list-style: none; }
            .plan li { padding: 7px 0; font-size: 14.5px; color: #4A4038;
                border-bottom: 1px solid #F4EFE9; }
            .plan li:last-child { border-bottom: 0; }
            .plan li::before { content: "✓"; color: #3D8B5A; font-weight: 800; margin-inline-end: 9px; }

            footer { border-top: 1px solid #EFE7DE; padding: 26px 0 34px; color: #A99E92; font-size: 13.5px; }
            .foot-inner { display: flex; justify-content: space-between; flex-wrap: wrap; gap: 10px; }
            footer a { text-decoration: none; }
            footer a:hover { color: #BF5523; }

            @media (max-width: 860px) {
                .hero-grid { grid-template-columns: 1fr; gap: 36px; }
                .steps, .feats { grid-template-columns: 1fr; }
                .plans { grid-template-columns: 1fr; }
                .nav-links a[href="#how"], .nav-links a[href="#features"] { display: none; }
                .dl-card { padding: 34px 26px; }
                .dl-meta { text-align: start; }
            }
        </style>
    </head>
    <body>
        <nav>
            <div class="wrap nav-inner">
                <a class="brand" href="/">
                    <img src="{{ asset('img/recipereallogo.webp') }}" alt="RecipeReal logo">
                    <b>Recipe<span>Real</span></b>
                </a>
                <div class="nav-links">
                    <a href="#how" class="btn btn-ghost btn-sm">How it works</a>
                    <a href="#download" class="btn btn-primary btn-sm">Get the app</a>
                </div>
            </div>
        </nav>

        <header class="hero">
            <div class="wrap hero-grid">
                <div>
                    <span class="kicker">⏱ Reality-checked recipes</span>
                    <h1>Honest cook times, <em>before</em> you start chopping.</h1>
                    <p class="sub">
                        RecipeReal shows what a recipe <b>claims</b> — and what cooks
                        <b>actually</b> measured with a stopwatch. Browse thousands of recipes,
                        cook with a guided timer, and build your offline library.
                    </p>
                    <div class="hero-cta">
                        <a href="#download" class="btn btn-primary">Download for Android</a>
                        <a href="#how" class="btn btn-ghost">See how it works</a>
                    </div>
                </div>
                <div class="phone-card" aria-hidden="true">
                    <div class="dish"></div>
                    <div class="stat-pair">
                        <div class="stat stat-claim"><small>Recipe says</small><b>25m</b></div>
                        <div class="stat stat-real"><small>Really takes</small><b>38m</b></div>
                    </div>
                    <div class="stat-cap">Measured by <b>real cooks</b> in guided Cook Mode</div>
                </div>
            </div>
        </header>

        <section id="how" class="alt">
            <div class="wrap">
                <div class="sec-head">
                    <h2>How it works</h2>
                    <p class="sec-sub">From recipe to real cook time in three steps.</p>
                </div>
                <div class="steps">
                    <div class="step">
                        <div class="step-num">1</div>
                        <h3>Pick a recipe</h3>
                        <p>Browse and instantly see the honest estimate — the claim next to the community-measured reality, tuned to your pace.</p>
                    </div>
                    <div class="step">
                        <div class="step-num">2</div>
                        <h3>Cook in guided Cook Mode</h3>
                        <p>Step through with a built-in stopwatch and step alarms that ring even when your phone is locked.</p>
                    </div>
                    <div class="step">
                        <div class="step-num">3</div>
                        <h3>See your personal pace</h3>
                        <p>Every cook calibrates the estimates to you, so each next recipe gets more accurate for how YOU cook.</p>
                    </div>
                </div>
            </div>
        </section>

        <section id="features">
            <div class="wrap">
                <div class="sec-head">
                    <h2>Made for real kitchens</h2>
                    <p class="sec-sub">Everything the app does serves one goal: dinner at the time it promised.</p>
                </div>
                <div class="feats">
                    <div class="feat">
                        <span class="ico">🌙</span>
                        <h3>Halal-first library</h3>
                        <p>Every recipe screened against explicit pork &amp; alcohol rules — built by and for our tables.</p>
                    </div>
                    <div class="feat">
                        <span class="ico">📶</span>
                        <h3>Works offline</h3>
                        <p>Save the library to your phone and cook with no signal — recipes, steps and timers all local.</p>
                    </div>
                    <div class="feat">
                        <span class="ico">🫱</span>
                        <h3>Community tries</h3>
                        <p>Share photos of your attempt, follow other cooks, and see how their timings compared.</p>
                    </div>
                </div>
            </div>
        </section>

        <section id="download" class="alt">
            <div class="wrap">
                <div class="dl-card">
                    <div class="dl-brand">
                        <img src="{{ asset('img/recipereallogo.webp') }}" alt="RecipeReal app icon">
                        <div>
                            <h3>Get RecipeReal</h3>
                            <p>Free · Android{{ isset($latestRelease) ? ' · direct APK install' : ' · coming soon' }}</p>
                        </div>
                    </div>
                    <div class="dl-meta">
                        @isset($latestRelease)
                            <div class="dl-ver">Version <b>{{ $latestRelease->version }}</b> · {{ $latestRelease->humanSize() }} · {{ $latestRelease->created_at->format('M j, Y') }}</div>
                            <a href="{{ route('app.download') }}" class="btn btn-primary">⬇ Download APK</a>
                            <div class="dl-note">arm64 · Android 7.0+ · installs directly — allow "install unknown apps" when asked</div>
                        @else
                            <div class="dl-ver">The first public build is being prepared.</div>
                            <span class="btn btn-ghost" aria-disabled="true">Coming soon</span>
                        @endisset
                    </div>
                </div>
            </div>
        </section>

        <section id="pricing">
            <div class="wrap">
                <div class="sec-head">
                    <h2>Simple pricing</h2>
                    <p class="sec-sub">Start free. Upgrade when you want pace calibration and cleanup estimates.</p>
                </div>
                <div class="plans">
                    <div class="plan">
                        <h3>Free</h3>
                        <div class="price">$0<span> / forever</span></div>
                        <ul>
                            <li>5 recipes / month</li>
                            <li>Basic cook-time estimates</li>
                            <li>Guided Cook Mode</li>
                        </ul>
                        <a href="#download" class="btn btn-ghost">Get started</a>
                    </div>
                    <div class="plan featured">
                        <span class="tag">Most popular</span>
                        <h3>Premium</h3>
                        <div class="price">$5.99<span> / mo · or $49.99 / yr</span></div>
                        <ul>
                            <li>Unlimited recipes</li>
                            <li>Pace calibration personalized to you</li>
                            <li>Cleanup time estimates included</li>
                            <li>Accuracy that improves the more you cook</li>
                        </ul>
                        <a href="#download" class="btn btn-primary">Go Premium</a>
                    </div>
                </div>
            </div>
        </section>

        <footer>
            <div class="wrap foot-inner">
                <div>© {{ date('Y') }} RecipeReal</div>
                <div>
                    <a href="/privacy">Privacy Policy</a>
                    &nbsp;·&nbsp;
                    <a href="/admin">Admin</a>
                </div>
            </div>
        </footer>
    </body>
</html>
