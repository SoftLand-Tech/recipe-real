<!DOCTYPE html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}">
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>RecipeReal — Honest cook-time estimates, before you start chopping.</title>
        <meta name="description" content="3-skill estimates with cleanup included, stopwatch-verified, and personalized to your pace.">
        <style>
            /* Scoped landing styles — system fonts, no external deps. */
            .rr-root,
            .rr-root * {
                box-sizing: border-box;
            }
            .rr-root {
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto,
                    Helvetica, Arial, sans-serif, "Apple Color Emoji",
                    "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji";
                color: #1b1b18;
                background: #fdfdfc;
                margin: 0;
                line-height: 1.5;
                -webkit-font-smoothing: antialiased;
                -moz-osx-font-smoothing: grayscale;
            }
            .rr-container {
                width: 100%;
                max-width: 1080px;
                margin: 0 auto;
                padding: 0 20px;
            }
            .rr-nav {
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 20px 0;
            }
            .rr-brand {
                font-weight: 700;
                font-size: 1.25rem;
                letter-spacing: -0.02em;
            }
            .rr-nav-links {
                display: flex;
                gap: 12px;
                align-items: center;
            }
            .rr-btn {
                display: inline-block;
                padding: 12px 22px;
                border-radius: 10px;
                font-weight: 600;
                font-size: 0.95rem;
                text-decoration: none;
                cursor: pointer;
                border: 1px solid transparent;
                transition: background-color 0.15s ease, border-color 0.15s ease, color 0.15s ease;
            }
            .rr-btn-primary {
                background: #f53003;
                color: #fff;
            }
            .rr-btn-primary:hover {
                background: #e02a01;
            }
            .rr-btn-outline {
                background: transparent;
                color: #1b1b18;
                border-color: #d7d7d2;
            }
            .rr-btn-outline:hover {
                border-color: #1b1b18;
            }
            .rr-hero {
                padding: 70px 0 50px;
                text-align: center;
            }
            .rr-hero h1 {
                font-size: clamp(2.1rem, 5vw, 3.4rem);
                line-height: 1.1;
                font-weight: 800;
                letter-spacing: -0.03em;
                margin: 0 auto 18px;
                max-width: 820px;
            }
            .rr-hero p {
                font-size: clamp(1.05rem, 2vw, 1.25rem);
                color: #5a5a55;
                max-width: 660px;
                margin: 0 auto 30px;
            }
            .rr-hero-cta {
                display: flex;
                gap: 12px;
                justify-content: center;
                flex-wrap: wrap;
            }
            .rr-section {
                padding: 56px 0;
            }
            .rr-section-alt {
                background: #f6f6f4;
            }
            .rr-section h2 {
                font-size: clamp(1.6rem, 3.5vw, 2.2rem);
                font-weight: 700;
                letter-spacing: -0.02em;
                text-align: center;
                margin: 0 0 8px;
            }
            .rr-section-sub {
                text-align: center;
                color: #5a5a55;
                margin: 0 auto 40px;
                max-width: 560px;
            }
            .rr-steps {
                display: flex;
                gap: 24px;
                flex-wrap: wrap;
                justify-content: center;
            }
            .rr-step {
                flex: 1 1 260px;
                max-width: 320px;
                background: #fff;
                border: 1px solid #ececea;
                border-radius: 14px;
                padding: 28px 24px;
            }
            .rr-step-num {
                display: inline-flex;
                align-items: center;
                justify-content: center;
                width: 36px;
                height: 36px;
                border-radius: 50%;
                background: #fff2f2;
                color: #f53003;
                font-weight: 700;
                margin-bottom: 14px;
            }
            .rr-step h3 {
                font-size: 1.15rem;
                margin: 0 0 8px;
                font-weight: 700;
            }
            .rr-step p {
                color: #5a5a55;
                margin: 0;
                font-size: 0.97rem;
            }
            .rr-pricing {
                display: flex;
                gap: 24px;
                flex-wrap: wrap;
                justify-content: center;
                align-items: stretch;
            }
            .rr-card {
                flex: 1 1 280px;
                max-width: 380px;
                background: #fff;
                border: 1px solid #ececea;
                border-radius: 16px;
                padding: 30px 26px;
                display: flex;
                flex-direction: column;
            }
            .rr-card-featured {
                border-color: #f53003;
                box-shadow: 0 8px 30px rgba(245, 48, 3, 0.08);
            }
            .rr-card h3 {
                font-size: 1.25rem;
                margin: 0 0 6px;
                font-weight: 700;
            }
            .rr-card-price {
                font-size: 2rem;
                font-weight: 800;
                letter-spacing: -0.02em;
                margin: 8px 0 4px;
            }
            .rr-card-price span {
                font-size: 0.95rem;
                font-weight: 500;
                color: #5a5a55;
            }
            .rr-card ul {
                list-style: none;
                padding: 0;
                margin: 18px 0 24px;
                display: flex;
                flex-direction: column;
                gap: 10px;
                color: #3a3a36;
                font-size: 0.97rem;
            }
            .rr-card ul li::before {
                content: "✓ ";
                color: #f53003;
                font-weight: 700;
            }
            .rr-card .rr-btn {
                margin-top: auto;
                text-align: center;
            }
            .rr-badge {
                display: inline-block;
                background: #fff2f2;
                color: #f53003;
                font-size: 0.78rem;
                font-weight: 700;
                padding: 4px 10px;
                border-radius: 999px;
                margin-bottom: 10px;
                text-transform: uppercase;
                letter-spacing: 0.04em;
            }
            .rr-footer {
                padding: 30px 0 40px;
                border-top: 1px solid #ececea;
                color: #5a5a55;
                font-size: 0.9rem;
            }
            .rr-footer-inner {
                display: flex;
                align-items: center;
                justify-content: space-between;
                flex-wrap: wrap;
                gap: 12px;
            }
            .rr-footer a {
                color: #5a5a55;
                text-decoration: none;
            }
            .rr-footer a:hover {
                color: #1b1b18;
                text-decoration: underline;
            }
            @media (max-width: 600px) {
                .rr-nav-links .rr-btn-outline {
                    display: none;
                }
                .rr-hero {
                    padding: 40px 0 30px;
                }
            }
        </style>
    </head>
    <body class="rr-root">
        <div class="rr-container">
            <nav class="rr-nav">
                <div class="rr-brand">RecipeReal</div>
                <div class="rr-nav-links">
                    <a href="#how" class="rr-btn rr-btn-outline">How it works</a>
                    <a href="#download" class="rr-btn rr-btn-primary">Get the app</a>
                </div>
            </nav>
        </div>

        <header class="rr-hero">
            <div class="rr-container">
                <h1>Honest cook-time estimates, before you start chopping.</h1>
                <p>3-skill estimates with cleanup included · stopwatch-verified · personalized to your pace.</p>
                <div class="rr-hero-cta">
                    <a href="#download" class="rr-btn rr-btn-primary">Download — Free</a>
                    <a href="#pricing" class="rr-btn rr-btn-outline">See pricing</a>
                </div>
            </div>
        </header>

        <section id="how" class="rr-section rr-section-alt">
            <div class="rr-container">
                <h2>How it works</h2>
                <p class="rr-section-sub">From recipe to real cook time in three steps.</p>
                <div class="rr-steps">
                    <div class="rr-step">
                        <div class="rr-step-num">1</div>
                        <h3>Pick a recipe</h3>
                        <p>Browse recipes and instantly see an honest cook-time estimate tuned to your skill level.</p>
                    </div>
                    <div class="rr-step">
                        <div class="rr-step-num">2</div>
                        <h3>Cook in guided Cook Mode</h3>
                        <p>Step through the recipe with a built-in timer that captures exactly how long each step really takes.</p>
                    </div>
                    <div class="rr-step">
                        <div class="rr-step-num">3</div>
                        <h3>See your personal pace</h3>
                        <p>RecipeReal calibrates to your pace over time, so every next estimate gets more accurate for you.</p>
                    </div>
                </div>
            </div>
        </section>

        <section id="pricing" class="rr-section">
            <div class="rr-container">
                <h2>Simple pricing</h2>
                <p class="rr-section-sub">Start free. Upgrade when you want pace calibration and cleanup estimates.</p>
                <div class="rr-pricing">
                    <div class="rr-card">
                        <h3>Free</h3>
                        <div class="rr-card-price">$0<span> / forever</span></div>
                        <ul>
                            <li>5 recipes / month</li>
                            <li>Basic cook-time estimates</li>
                            <li>Guided Cook Mode</li>
                        </ul>
                        <a href="#download" class="rr-btn rr-btn-outline">Get started</a>
                    </div>
                    <div class="rr-card rr-card-featured">
                        <span class="rr-badge">Most popular</span>
                        <h3>Premium</h3>
                        <div class="rr-card-price">$5.99<span> / mo · or $49.99 / yr</span></div>
                        <ul>
                            <li>Unlimited recipes</li>
                            <li>Pace calibration personalized to you</li>
                            <li>Cleanup time estimates included</li>
                            <li>3-skill accuracy on every estimate</li>
                        </ul>
                        <a href="/upgrade" class="rr-btn rr-btn-primary">Go Premium</a>
                    </div>
                </div>
            </div>
        </section>

        <footer class="rr-footer">
            <div class="rr-container rr-footer-inner">
                <div>© RecipeReal</div>
                <div><a href="#">Privacy Policy</a></div>
            </div>
        </footer>
    </body>
</html>
