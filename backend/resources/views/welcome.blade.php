<!DOCTYPE html>
<html lang="{{ app()->getLocale() }}" dir="{{ app()->getLocale() === 'ar' ? 'rtl' : 'ltr' }}">
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
        <meta name="color-scheme" content="light">
        <title>{{ __('site.meta_title') }}</title>
        <meta name="description" content="{{ __('site.meta_desc') }}">
        <link rel="canonical" href="https://recipe-real.softland.tech/">
        <meta name="theme-color" content="#FAF6EF">
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png">
        <link rel="preload" href="/fonts/Fraunces-latin.woff2" as="font" type="font/woff2" crossorigin>
        <link rel="preload" href="/fonts/DMSans-latin.woff2" as="font" type="font/woff2" crossorigin>
        <link rel="icon" type="image/x-icon" href="/favicon.ico">
        <link rel="apple-touch-icon" href="/apple-touch-icon.png">
        <meta property="og:type" content="website">
        <meta property="og:site_name" content="RecipeReal">
        <meta property="og:title" content="RecipeReal — Real Recipes. Real Results.">
        <meta property="og:description" content="Accurate cooking-time estimates for every skill level. Guided Cook Mode, an offline library, and honest times measured by real cooks. Free for Android.">
        <meta property="og:url" content="https://recipe-real.softland.tech/">
        <meta property="og:image" content="https://recipe-real.softland.tech/img/recipereallogo.webp">
        <meta name="twitter:card" content="summary_large_image">
        <meta name="twitter:title" content="RecipeReal — Real Recipes. Real Results.">
        <meta name="twitter:description" content="Accurate cooking-time estimates on 20,089 recipes. Free Android app.">
        <meta name="twitter:image" content="https://recipe-real.softland.tech/img/recipereallogo.webp">
        <style>
            /* ============ WARM KITCHEN TABLE ============
               Owner-pinned comp (provided design image). Cream table, vivid
               orange action, Fraunces serif voice, DM Sans body. Teal stays
               reserved for measured time inside app-screen mockups. */

            @font-face {
                font-family: "Fraunces";
                src: url("/fonts/Fraunces-latin.woff2") format("woff2");
                font-weight: 100 900;
                font-display: swap;
            }
            @font-face {
                font-family: "DM Sans";
                src: url("/fonts/DMSans-latin.woff2") format("woff2");
                font-weight: 100 900;
                font-display: swap;
            }
            :root {
                --cream: #FAF6EF;
                --cream-deep: #F5EEE2;
                --white: #FFFFFF;
                --ink: #26211B;
                --muted: #6E6558;
                --faint: #988D7E;
                --orange: #F26B1D;
                --orange-deep: #CE5710;
                --orange-soft: #FDEBDD;
                --teal: #287C78;
                --dark: #232936;
                --dark-2: #1D222C;
                --dark-muted: #AEB5C2;
                --hair: #EFE5D6;
                --font-display: "Fraunces", Georgia, serif;
                --font-body: "DM Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
                color-scheme: light;
                scrollbar-color: #D9CDBB var(--cream);
            }
            *, *::before, *::after { box-sizing: border-box; }
            html { scroll-behavior: smooth; }
            body {
                margin: 0;
                padding: env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left);
                background: var(--white);
                color: var(--ink);
                font-family: var(--font-body);
                font-size: 16.5px;
                line-height: 1.65;
                -webkit-font-smoothing: antialiased;
                text-rendering: optimizeLegibility;
            }
            ::selection { background: var(--orange); color: #fff; }
            a { color: inherit; }
            :focus-visible { outline: 2.5px solid var(--orange); outline-offset: 3px; border-radius: 4px; }
            img { max-width: 100%; }
            .wrap { max-width: 1160px; margin: 0 auto; padding: 0 28px; }

            /* ---------- buttons ---------- */
            .btn {
                display: inline-flex; align-items: center; justify-content: center; gap: 10px;
                padding: 14px 28px; border-radius: 999px;
                font-weight: 700; font-size: 15.5px; letter-spacing: .005em;
                text-decoration: none; border: 1px solid transparent; cursor: pointer;
                font-family: var(--font-body);
                transition: background .16s ease, border-color .16s ease, box-shadow .16s ease, transform .12s ease;
            }
            .btn:active { transform: translateY(1px); }
            .btn-accent { background: var(--orange); color: #fff; box-shadow: 0 10px 22px -10px rgba(242,107,29,.55); }
            .btn-accent:hover { background: var(--orange-deep); }
            .btn-ghost { background: var(--white); color: var(--ink); border-color: #E8DFD2; box-shadow: 0 6px 16px -10px rgba(38,33,27,.25); }
            .btn-ghost:hover { border-color: var(--orange); color: var(--orange-deep); }
            .btn-dark { background: var(--dark); color: #fff; }
            .btn-dark:hover { background: #2E3545; }
            .play-dot { width: 26px; height: 26px; border-radius: 99px; background: var(--orange-soft);
                display: inline-flex; align-items: center; justify-content: center; color: var(--orange-deep); flex: none; }

            /* ---------- nav ---------- */
            .nav { background: var(--cream); position: sticky; top: 0; z-index: 50;
                border-bottom: 1px solid rgba(239,229,214,.7); }
            .nav-inner { display: flex; align-items: center; justify-content: space-between; height: 66px; gap: 18px; }
            .brand { display: flex; align-items: center; gap: 10px; text-decoration: none; }
            .brand-mark { width: 34px; height: 34px; object-fit: contain; }
            .brand b { font-family: var(--font-body); font-weight: 800; font-size: 23px; letter-spacing: -.01em; color: var(--ink); }
            .brand b em { font-style: normal; color: var(--orange); }
            .nav-links { display: flex; align-items: center; gap: 26px; }
            .nav-links a:not(.btn) { text-decoration: none; font-size: 14.5px; font-weight: 600; color: var(--muted);
                padding: 6px 2px; position: relative; }
            .nav-links a:not(.btn):hover { color: var(--ink); }
            .nav-links a:not(.btn).active { color: var(--orange-deep); }
            .nav-links a:not(.btn).active::after { content: ""; position: absolute; left: 50%; transform: translateX(-50%);
                bottom: -4px; width: 16px; height: 3px; border-radius: 99px; background: var(--orange); }
            .nav .btn-accent { padding: 11px 22px; font-size: 14px; box-shadow: 0 8px 18px -10px rgba(242,107,29,.5); }
            /* intermediate widths: six links + pill must stay on one line */
            @media (max-width: 1180px) {
                .nav-links { gap: 15px; }
                .nav-links a:not(.btn), .nav .btn-accent { white-space: nowrap; }
                .nav .btn-accent { padding: 10px 17px; font-size: 13.5px; }
            }
            @media (max-width: 860px) { .nav-links a:not(.btn) { display: none; } }

            /* ---------- hero ---------- */
            .hero { background: var(--cream); position: relative; overflow: hidden; }
            .hero .wrap { display: grid; grid-template-columns: 1.02fr .98fr; gap: 30px;
                align-items: center; padding-top: 48px; padding-bottom: 64px; position: relative; }
            h1 {
                font-family: var(--font-display);
                font-weight: 640; font-variation-settings: "opsz" 40;
                font-size: clamp(2.55rem, 5vw, 4.1rem);
                line-height: 1.07; letter-spacing: -.012em;
                margin: 0 0 20px; text-wrap: balance;
            }
            h1 .o { color: var(--orange); }
            .lede { font-size: 17.5px; color: var(--muted); max-width: 27.5em; margin: 0 0 30px; }
            .hero-cta { display: flex; flex-wrap: wrap; gap: 13px; align-items: center; }
            .hero-proof { margin-top: 34px; display: flex; align-items: center; gap: 13px; }
            .avatars { display: inline-flex; }
            .avatars span {
                width: 40px; height: 40px; border-radius: 99px; border: 2.5px solid var(--cream);
                display: inline-flex; align-items: center; justify-content: center;
                font-size: 13px; font-weight: 800; color: #fff; margin-left: -9px;
            }
            .avatars span:first-child { margin-left: 0; }
            .av-1 { background: #C96F4A; } .av-2 { background: #8A9A5B; } .av-3 { background: #B58436; } .av-4 { background: #6D8B8B; }
            .hero-proof p { margin: 0; font-size: 14px; color: var(--muted); line-height: 1.45; }
            .hero-proof b { color: var(--ink); }
            .hero-proof .heart { color: var(--orange); }

            /* hero art: photo covers the whole right side, melted into the cream */
            .hero-art { position: relative; min-height: 700px; }
            .hero-photo {
                position: absolute; top: -115px; bottom: -70px;
                left: -30px; right: min(-28px, (1104px - 100vw) / 2);
                overflow: hidden;
            }
            .hero-photo img { width: 100%; height: 100%; object-fit: cover; object-position: center 40%;
                display: block; filter: brightness(1.07) saturate(1.02); }
            /* soft cream wash melts the photo's left + bottom edges into the page */
            .hero-photo::after {
                content: ""; position: absolute; inset: 0;
                background:
                    linear-gradient(90deg, var(--cream) 0%, rgba(250,246,239,.85) 22%, rgba(250,246,239,0) 62%),
                    linear-gradient(0deg, var(--cream) 0%, rgba(250,246,239,.6) 18%, rgba(250,246,239,0) 46%);
            }
            @media (min-width: 1180px) {
                .hero-photo { right: calc(-1 * ((100vw - 1104px) / 2)); }
            }
            .hero-spark { position: absolute; color: var(--orange); opacity: .85; }

            /* ---- THE IPHONE — the app's real home screen, designed at the
               app's native 390px viewport, transform-scaled to fit. ---- */
            .phone-shell { position: absolute; left: 50%; top: 44px; transform: translateX(-54%);
                display: flex; justify-content: center; }
            .iphone {
                position: relative; width: 400px; flex: none;
                background: #101013; border-radius: 54px; padding: 10px;
                transform: scale(.8); transform-origin: top center;
                box-shadow: 0 60px 120px -38px rgba(38,33,27,.5), inset 0 0 0 2px #000;
            }
            .ip-screen {
                background: #FDFBF7; border-radius: 44px; overflow: hidden;
                position: relative; width: 380px; height: 780px;
                display: flex; flex-direction: column; color: #241D17;
            }
            .ip-statusbar { display: flex; align-items: center; justify-content: space-between;
                padding: 16px 30px 6px; flex: none; }
            .ip-time { font-size: 14px; font-weight: 700; }
            .ip-signals { display: inline-flex; align-items: center; gap: 6px; }
            .ip-punch { position: absolute; top: 12px; left: 50%; transform: translateX(-50%);
                width: 13px; height: 13px; background: #000; border-radius: 99px; }
            .ip-home { flex: 1; overflow: hidden; padding: 6px 16px 0; }
            .ip-header { display: flex; align-items: center; justify-content: space-between; padding: 4px 0 12px; }
            .ip-header b { font-size: 19px; font-weight: 800; letter-spacing: -.01em; }
            .ip-header b em { font-style: normal; color: var(--orange); }
            .ip-header-icons { display: inline-flex; align-items: center; gap: 16px; color: #241D17; }
            .ip-search { display: flex; align-items: center; gap: 10px; color: #988D7E;
                background: #F3EDE3; border-radius: 14px; padding: 13px 16px; font-size: 13.5px; margin-bottom: 14px; }
            .ip-feat { background: #fff; border: 1px solid #EFE5D6; border-radius: 18px; padding: 10px 10px 14px;
                box-shadow: 0 14px 30px -22px rgba(38,33,27,.4); }
            .ip-feat-img { position: relative; border-radius: 12px; overflow: hidden; }
            .ip-feat-img img { width: 100%; height: 190px; object-fit: cover; display: block; }
            .ip-heart { position: absolute; top: 12px; inset-inline-end: 12px;
                background: rgba(20,14,10,.35); border-radius: 10px; padding: 6px; }
            .ip-feat-body { display: flex; flex-direction: column; padding: 12px 6px 0; }
            .ip-feat-body h3 { margin: 0 0 8px; font-size: 19px; font-weight: 800; letter-spacing: -.01em; }
            .ip-meta { display: flex; align-items: center; gap: 8px; }
            .ip-chip { display: inline-flex; align-items: center; gap: 4px; font-size: 11.5px; font-weight: 700;
                color: #6E6558; background: #F3EDE3; border-radius: 99px; padding: 4px 10px; }
            .ip-chip.ip-star { color: #241D17; background: #FDF3E4; }
            .ip-really { margin-top: 10px; font-size: 12px; color: #6E6558; }
            .ip-really b { display: block; font-size: 26px; font-weight: 800; color: var(--teal); line-height: 1.2; }
            .ip-start { display: block; text-align: center; background: var(--orange); color: #fff;
                font-weight: 800; font-size: 15px; border-radius: 999px; padding: 13px 0; margin-top: 10px; }
            .ip-rail-head { display: flex; align-items: baseline; justify-content: space-between; margin: 16px 2px 10px; }
            .ip-rail-head b { font-size: 16.5px; font-weight: 800; }
            .ip-rail-head span { font-size: 12.5px; font-weight: 700; color: var(--orange-deep); }
            .ip-rail { display: flex; gap: 10px; overflow: hidden; }
            .ip-mini { flex: none; width: 150px; background: #fff; border: 1px solid #EFE5D6; border-radius: 12px;
                overflow: hidden; padding-bottom: 10px; }
            .ip-mini img { width: 100%; height: 88px; object-fit: cover; display: block; }
            .ip-mini b { display: block; font-size: 12.5px; line-height: 1.3; padding: 8px 9px 6px; }
            .ip-mini .ip-chip { margin: 0 3px 3px 9px; font-size: 10.5px; padding: 3px 8px; }
            .ip-tabbar { flex: none; display: flex; border-top: 1px solid #EFE5D6; background: #FDFBF7; padding: 9px 8px 4px; }
            .ip-tab { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 3px;
                font-size: 10px; font-weight: 700; color: #988D7E; }
            .ip-tab.active { color: var(--orange-deep); }
            .home-indicator { flex: none; width: 120px; height: 5px; border-radius: 99px;
                background: rgba(36,29,23,.85); margin: 5px auto 8px; }

            /* ---------- sections ---------- */
            section { padding: 86px 0; }
            .sec-head { text-align: center; max-width: 640px; margin: 0 auto 52px; }
            h2 {
                font-family: var(--font-display); font-weight: 640; font-variation-settings: "opsz" 30;
                font-size: clamp(1.85rem, 3.3vw, 2.65rem); line-height: 1.14; letter-spacing: -.01em;
                margin: 0 0 10px; text-wrap: balance;
            }
            h2 .o { color: var(--orange); }
            .sec-head .rule { width: 54px; height: 5px; border-radius: 99px; background: var(--orange);
                margin: 14px auto 0; }
            .sec-lede { font-size: 16.5px; color: var(--muted); margin: 12px 0 0; }

            /* ---------- features strip ---------- */
            .features { background: var(--white); border-block: 1px solid var(--hair); padding: 64px 0; }
            .feat-grid { display: grid; grid-template-columns: repeat(4, 1fr); }
            .feat { text-align: center; padding: 10px 30px; border-inline-start: 1px solid var(--hair); }
            .feat:first-child { border-inline-start: 0; }
            .feat-ico { width: 62px; height: 62px; border-radius: 99px; background: var(--orange-soft); color: var(--orange-deep);
                display: inline-flex; align-items: center; justify-content: center; margin-bottom: 16px; }
            .feat h3 { margin: 0 0 8px; font-size: 17.5px; font-weight: 800; letter-spacing: -.005em; }
            .feat p { margin: 0; font-size: 14.5px; color: var(--muted); line-height: 1.6; }
            @media (max-width: 980px) {
                .feat-grid { grid-template-columns: 1fr 1fr; gap: 34px 0; }
                .feat:nth-child(3) { border-inline-start: 0; }
            }
            @media (max-width: 520px) {
                .feat-grid { grid-template-columns: 1fr; }
                .feat { border-inline-start: 0; padding: 4px 8px; }
            }

            /* ---------- how it works ---------- */
            .how { background: var(--cream); }
            .steps { display: grid; grid-template-columns: repeat(5, 1fr); gap: 20px; }
            .step { text-align: center; position: relative; padding: 0 6px; }
            .step-ico { width: 78px; height: 78px; margin: 0 auto 16px; border-radius: 99px;
                background: var(--white); color: var(--orange-deep);
                display: flex; align-items: center; justify-content: center;
                box-shadow: 0 14px 30px -18px rgba(38,33,27,.35), inset 0 0 0 1px #F3E7D6; }
            .step h3 { margin: 0 0 6px; font-size: 16.5px; font-weight: 800; }
            .step h3 i { font-style: normal; color: var(--orange-deep); }
            .step p { margin: 0 auto; font-size: 13.8px; color: var(--muted); line-height: 1.55; max-width: 21em; }
            /* dashed arrow to the next step (desktop only) */
            .step:not(:last-child)::after {
                content: ""; position: absolute; top: 34px; right: -26px; width: 34px; height: 12px;
                background: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='34' height='12' viewBox='0 0 34 12'%3E%3Cpath d='M1 6h26' stroke='%23F26B1D' stroke-width='2.4' stroke-linecap='round' stroke-dasharray='1 7'/%3E%3Cpath d='m27 1.5 6 4.5-6 4.5' fill='none' stroke='%23F26B1D' stroke-width='2.4' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E") no-repeat center / contain;
            }
            @media (max-width: 1020px) {
                .steps { grid-template-columns: repeat(3, 1fr); gap: 34px 20px; }
                .step:not(:last-child)::after { display: none; }
            }
            @media (max-width: 640px) { .steps { grid-template-columns: repeat(2, 1fr); } }
            @media (max-width: 430px) { .steps { grid-template-columns: 1fr; } }

            /* ---------- recipes ---------- */
            .recipes { background: var(--white); }
            .recipes .wrap { max-width: 1240px; }
            .recipes-bar { display: flex; align-items: baseline; justify-content: space-between; gap: 16px;
                max-width: none; margin-bottom: 40px; position: relative; }
            .recipes-bar .sec-head { text-align: center; margin: 0 auto; }
            .view-all { font-size: 14.5px; font-weight: 700; color: var(--orange-deep); text-decoration: none;
                white-space: nowrap; position: absolute; right: 0; top: 14px; }
            .view-all:hover { color: var(--orange); }
            .recipe-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 18px; }
            .recipe-card {
                background: var(--white); border: 1px solid var(--hair); border-radius: 18px; overflow: hidden;
                text-decoration: none; display: flex; flex-direction: column;
                box-shadow: 0 12px 28px -22px rgba(38,33,27,.4);
                transition: transform .16s ease, box-shadow .16s ease;
            }
            .recipe-card:hover { transform: translateY(-4px); box-shadow: 0 22px 40px -24px rgba(38,33,27,.5); }
            .recipe-card img { width: 100%; aspect-ratio: 4 / 3; object-fit: cover; display: block; }
            .recipe-card .rc-body { padding: 13px 14px 14px; display: flex; flex-direction: column; gap: 9px; }
            .recipe-card h3 { margin: 0; font-size: 15.5px; font-weight: 800; letter-spacing: -.005em;
                white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
            .rc-meta { display: flex; align-items: center; justify-content: space-between; gap: 8px;
                font-size: 13px; font-weight: 700; color: var(--muted); }
            .rc-meta .rc-time { display: inline-flex; align-items: center; gap: 5px; }
            .rc-meta .rc-star { display: inline-flex; align-items: center; gap: 4px; color: var(--ink); }
            .rc-meta .rc-star svg { color: var(--orange); }
            @media (max-width: 1080px) { .recipe-grid { grid-template-columns: repeat(3, 1fr); } }
            @media (max-width: 700px) { .recipe-grid { grid-template-columns: repeat(2, 1fr); } }
            @media (max-width: 640px) {
                .recipes-bar { flex-direction: column; gap: 6px; }
                .view-all { position: static; }
            }

            /* ---------- dark app section ---------- */
            .app-show { background: var(--dark); color: #fff; overflow: hidden; }
            .app-show .wrap { display: grid; grid-template-columns: .92fr 1.08fr; gap: 40px; align-items: center; }
            .eyebrow { display: inline-block; font-size: 13px; font-weight: 800; letter-spacing: .16em;
                text-transform: uppercase; color: var(--orange); margin: 0 0 14px; }
            .app-show h2 { color: #fff; margin-bottom: 16px; }
            .app-show .app-lede { color: var(--dark-muted); font-size: 16.5px; max-width: 26em; margin: 0 0 30px; }
            .badges { display: flex; flex-wrap: wrap; gap: 13px; }
            .store-badge {
                display: inline-flex; align-items: center; gap: 11px; text-decoration: none;
                background: #0E1117; color: #fff; border: 1px solid #39404E; border-radius: 12px;
                padding: 10px 20px 10px 16px; transition: border-color .16s ease, background .16s ease;
            }
            .store-badge:hover { border-color: #5A6375; background: #171C26; }
            .store-badge svg { flex: none; }
            .store-badge small { display: block; font-size: 10.5px; font-weight: 600; letter-spacing: .06em;
                text-transform: uppercase; color: #AEB5C2; line-height: 1.3; }
            .store-badge b { display: block; font-size: 16.5px; font-weight: 700; line-height: 1.25; }
            .store-badge.soon { opacity: .62; }
            .store-badge.soon b::after { content: " · soon"; font-weight: 600; color: #8B93A3; }
            .dl-meta { margin: 18px 0 0; font-size: 13px; color: #8B93A3; }
            .dl-meta b { color: #D6DBE4; font-weight: 700; }

            /* three phones — full device proportions */
            .phones { position: relative; height: 560px; }
            .mini-phone {
                position: absolute; width: 226px; height: 470px;
                background: #0B0D12; border-radius: 34px; padding: 7px;
                box-shadow: 0 34px 70px -28px rgba(0,0,0,.8), inset 0 0 0 1.5px #000;
            }
            .mini-phone .mp-screen { background: #FDFBF7; border-radius: 27px; overflow: hidden; color: #241D17;
                padding: 20px 13px 14px; height: 100%; display: flex; flex-direction: column; }
            .mp-cap { position: absolute; top: 9px; left: 50%; transform: translateX(-50%);
                width: 64px; height: 6px; border-radius: 99px; background: #0B0D12; }
            .mp-cook { left: 0; top: 60px; transform: rotate(-5deg); z-index: 1; }
            .mp-main { left: 50%; top: 16px; transform: translateX(-50%) scale(1.06); z-index: 3;
                width: 240px; height: 500px; }
            .mp-log { right: 0; top: 60px; transform: rotate(5deg); z-index: 2; }
            .mp-screen .mp-save { margin-top: auto; }
            .mp-label { font-size: 10px; font-weight: 800; letter-spacing: .12em; text-transform: uppercase;
                color: #988D7E; margin: 0 0 10px; }
            .mp-step-chip { display: inline-block; font-size: 10.5px; font-weight: 800; color: var(--orange-deep);
                background: var(--orange-soft); border-radius: 99px; padding: 3px 9px; margin-bottom: 8px; }
            .mp-task { font-size: 16px; font-weight: 800; letter-spacing: -.01em; margin: 0 0 12px; }
            .mp-clock { font-family: ui-monospace, "SF Mono", Menlo, Consolas, monospace; font-variant-numeric: tabular-nums;
                font-size: 34px; font-weight: 700; letter-spacing: .01em; text-align: center; margin: 2px 0 10px; }
            .mp-bar { height: 7px; border-radius: 99px; background: #F3EDE3; overflow: hidden; margin-bottom: 12px; }
            .mp-bar i { display: block; height: 100%; width: 62%; border-radius: 99px;
                background: linear-gradient(90deg, var(--orange), #F79A5C); }
            .mp-btns { display: flex; gap: 8px; }
            .mp-btn { flex: 1; text-align: center; font-size: 11.5px; font-weight: 800; border-radius: 99px; padding: 9px 0; }
            .mp-btn.pause { background: var(--orange); color: #fff; }
            .mp-btn.ghost { background: #F3EDE3; color: #6E6558; }
            .mp-card { background: #fff; border: 1px solid #EFE5D6; border-radius: 14px; overflow: hidden; margin-bottom: 10px;
                box-shadow: 0 10px 22px -18px rgba(38,33,27,.4); }
            .mp-card img { width: 100%; height: 96px; object-fit: cover; display: block; }
            .mp-card .mpc-body { padding: 10px 11px 11px; }
            .mp-card h4 { margin: 0 0 7px; font-size: 14.5px; font-weight: 800; }
            .mpc-claim { font-size: 11.5px; font-weight: 700; color: #988D7E; }
            .mpc-claim s { text-decoration-color: var(--orange); text-decoration-thickness: 1.5px; }
            .mpc-real { font-size: 22px; font-weight: 800; color: var(--teal); line-height: 1.25; }
            .mp-note { font-size: 11px; color: #6E6558; line-height: 1.5; margin: 0 0 12px; }
            .mp-progress { display: flex; align-items: flex-end; gap: 7px; height: 74px; margin: 4px 0 6px; }
            .mp-progress i { flex: 1; border-radius: 6px 6px 3px 3px; background: #F3E7D6; }
            .mp-progress i.hot { background: linear-gradient(180deg, #F79A5C, var(--orange)); }
            .mp-scale { display: flex; justify-content: space-between; font-size: 8.5px; font-weight: 700;
                letter-spacing: .06em; text-transform: uppercase; color: #988D7E; margin-bottom: 12px; }
            .mp-chips { display: flex; gap: 6px; margin-bottom: 12px; }
            .mp-chip { flex: 1; text-align: center; font-size: 10px; font-weight: 800; border-radius: 10px; padding: 8px 2px;
                background: #F3EDE3; color: #6E6558; }
            .mp-chip.pick { background: #DFF0E4; color: #3D8B5A; }
            .mp-save { display: block; text-align: center; background: var(--orange); color: #fff;
                font-size: 12px; font-weight: 800; border-radius: 99px; padding: 10px 0; }
            .mp-person { display: flex; align-items: center; gap: 9px; margin: 0 0 12px; }
            .mp-av { width: 34px; height: 34px; border-radius: 99px; background: #C96F4A; color: #fff;
                display: inline-flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 800; flex: none; }
            .mp-person b { display: block; font-size: 12.5px; line-height: 1.25; }
            .mp-person span { font-size: 10.5px; color: #988D7E; }
            @media (max-width: 980px) {
                .app-show .wrap { grid-template-columns: 1fr; gap: 54px; }
                .phones { height: auto; display: flex; gap: 18px; overflow-x: auto; padding: 12px 4px 22px;
                    scroll-snap-type: x mandatory; scrollbar-width: none; }
                .phones::-webkit-scrollbar { display: none; }
                .mini-phone { position: static; transform: none; flex: none; scroll-snap-align: center; }
                .mp-main { transform: none; }
            }

            /* ---------- testimonials ---------- */
            .community { background: var(--white); }
            .quotes { display: grid; grid-template-columns: repeat(3, 1fr); gap: 22px; }
            .quote { background: var(--white); border: 1px solid var(--hair); border-radius: 20px; padding: 28px 26px;
                box-shadow: 0 18px 40px -30px rgba(38,33,27,.45); }
            .stars { display: inline-flex; gap: 3px; color: var(--orange); margin-bottom: 14px; }
            .quote p { margin: 0 0 20px; font-size: 15px; color: #4E463B; line-height: 1.65; }
            .quote-person { display: flex; align-items: center; gap: 12px; }
            .q-av { width: 42px; height: 42px; border-radius: 99px; color: #fff; flex: none;
                display: inline-flex; align-items: center; justify-content: center; font-size: 14px; font-weight: 800; }
            .quote-person b { display: block; font-size: 14.5px; line-height: 1.3; }
            .quote-person span { font-size: 12.5px; color: var(--muted); }
            .dots { display: none; justify-content: center; gap: 8px; margin-top: 26px; }
            .dots i { width: 8px; height: 8px; border-radius: 99px; background: #E4D9C8; transition: background .15s ease; }
            .dots i.on { background: var(--orange); }
            .quotes-note { text-align: center; font-size: 12.5px; color: var(--muted); margin: 18px 0 0; }
            @media (max-width: 900px) {
                .quotes { display: flex; overflow-x: auto; scroll-snap-type: x mandatory; gap: 16px;
                    margin: 0 -28px; padding: 4px 28px 10px; scrollbar-width: none; }
                .quotes::-webkit-scrollbar { display: none; }
                .quote { flex: none; width: min(320px, 84vw); scroll-snap-align: center; }
                .dots { display: flex; }
            }

            /* ---------- CTA banner ---------- */
            .cta { background: var(--orange); color: #fff; position: relative; overflow: hidden; padding: 74px 0; }
            /* photos sit IN FRONT of the orange, bleeding off the outer edges,
               dissolving into the orange with heavy gradient shading */
            .cta-photo { position: absolute; top: 0; bottom: 0; width: 460px; overflow: hidden;
                pointer-events: none; display: none; }
            .cta-photo img { width: 100%; height: 100%; object-fit: cover; }
            .cta-photo::after { content: ""; position: absolute; inset: 0; }
            .cta-inner { position: relative; text-align: center; max-width: 620px; margin: 0 auto; }
            .cta h2 { color: #fff; font-size: clamp(1.9rem, 3.6vw, 2.8rem); margin-bottom: 10px; }
            .cta p { margin: 0 0 28px; color: #FFE3CE; font-size: 16px; }
            .cta-form { display: flex; gap: 10px; background: var(--white); border-radius: 999px; padding: 7px;
                max-width: 480px; margin: 0 auto; box-shadow: 0 20px 44px -20px rgba(112,40,0,.5); }
            .cta-form input { flex: 1; min-width: 0; border: 0; outline: none; background: transparent;
                padding: 10px 10px 10px 18px; font: inherit; font-size: 15px; color: var(--ink); caret-color: var(--orange); }
            .cta-form input::placeholder { color: var(--muted); }
            .cta-form .btn { padding: 12px 24px; font-size: 14.5px; flex: none; }
            @media (min-width: 1220px) {
                .cta-photo { display: block; }
                .cta-photo.left { left: 0; }
                .cta-photo.left::after { background:
                    linear-gradient(90deg, rgba(242,107,29,.12) 0%, rgba(242,107,29,.35) 34%,
                        rgba(242,107,29,.78) 68%, #F26B1D 100%); }
                .cta-photo.right { right: 0; }
                .cta-photo.right::after { background:
                    linear-gradient(270deg, rgba(242,107,29,.12) 0%, rgba(242,107,29,.35) 34%,
                        rgba(242,107,29,.78) 68%, #F26B1D 100%); }
            }
            @media (max-width: 480px) { .cta-form { flex-direction: column; border-radius: 24px; padding: 10px; }
                .cta-form input { padding: 10px 12px; text-align: center; } }

            /* ---------- footer ---------- */
            footer { background: var(--dark-2); color: var(--dark-muted); padding: 62px 0 34px; }
            .foot-grid { display: grid; grid-template-columns: 1.5fr 1fr 1fr 1fr; gap: 34px; }
            .foot-brand .brand b { color: #fff; }
            .foot-brand p { margin: 14px 0 0; font-size: 14px; line-height: 1.65; max-width: 15em; }
            .foot-col h4 { margin: 4px 0 16px; font-size: 13px; font-weight: 800; letter-spacing: .1em;
                text-transform: uppercase; color: #fff; }
            .foot-col a { display: block; text-decoration: none; font-size: 14px; color: var(--dark-muted);
                padding: 4.5px 0; }
            .foot-col a:hover { color: #fff; }
            .foot-bottom { border-top: 1px solid #2C3342; margin-top: 46px; padding-top: 22px;
                display: flex; justify-content: space-between; gap: 10px; flex-wrap: wrap; font-size: 13px; color: #8B93A3; }
            .foot-bottom a { color: inherit; text-decoration: none; }
            .foot-bottom a:hover { color: #fff; }
            @media (max-width: 940px) { .foot-grid { grid-template-columns: 1fr 1fr; } }
            @media (max-width: 480px) { .foot-grid { grid-template-columns: 1fr; } }

            /* ---------- the one authored moment: hero settles in ---------- */
            @media (prefers-reduced-motion: no-preference) {
                .rise { opacity: 0; transform: translateY(16px);
                    animation: rise .7s cubic-bezier(.16,1,.3,1) forwards; }
                .rise.d1 { animation-delay: .08s; } .rise.d2 { animation-delay: .16s; }
                .rise.d3 { animation-delay: .24s; } .rise.d4 { animation-delay: .32s; }
                .hero-art.rise { animation-delay: .18s; }
                @keyframes rise { to { opacity: 1; transform: none; } }
            }
            @media (prefers-reduced-motion: reduce) {
                html { scroll-behavior: auto; }
            }

            /* hero responsiveness: text stacks over the art, phone keeps its scale */
            @media (max-width: 940px) {
                .hero .wrap { grid-template-columns: 1fr; padding-top: 36px; padding-bottom: 0; gap: 0; }
                .hero-art { min-height: 0; height: 700px; margin-top: 64px; }
                .hero-photo { top: -70px; bottom: -50px; left: 22%; right: -28px; }
                .phone-shell { top: 10px; }
                .lede { max-width: none; }
            }
            @media (max-width: 420px) {
                .iphone { transform: scale(.68); }
                .phone-shell { width: 100%; }
                .hero-art { height: 560px; }
            }
        </style>
    </head>
    <body>
<!--
DESIGN CONTRACT — WARM KITCHEN TABLE (owner-pinned comp; seed key rrland02)
THESIS: RecipeReal as the confident kitchen companion — a warm cream table,
vivid orange action, serif voice; the category-default dark brochure is what
the owner's design image replaces.
OWN-WORLD: cream #FAF6EF / white, ink #26211B, orange #F26B1D reserved for
action and emphasis, teal #287C78 still reserved for measured time inside
app screens, Fraunces display + DM Sans body, pill buttons, soft-shadow
rounded cards.
STORY: the visitor gets the promise (real recipes, real results), sees the
real app's home screen, learns the 5-step honest-time flow, browses real
popular recipes, and installs the APK.
FIRST VIEWPORT: cream nav; left = serif H1 "Real Recipes. Real Results."
with orange Reals + lede + Get-the-App / Watch Demo + avatar social proof;
right = pasta photo panel bleeding off the top edge with the iPhone mockup
in front.
FORM: the owner's provided design image is the comp — brief-pinned beats
the direction roll. App screens inside mockups replicate the REAL app;
comp screen content that misstates the product (skill-level selector,
XP points) is replaced with real mechanisms.
FINISH: unreviewed and undocumented is unfinished; this build ends with the
finish review, the verdict, DESIGN.md, and every shipping raster carrying its
provenance.
-->
        @include('partials.site-nav')

        <header class="hero">
            <div class="wrap">
                <div>
                    <h1 class="rise">
                        <span class="o">Real</span> Recipes.<br>
                        <span class="o">Real</span> Results.
                    </h1>
                    <p class="lede rise d1">
                        Accurate cooking-time estimates for every skill level.
                        Cook with confidence. Every time.
                    </p>
                    <div class="hero-cta rise d2">
                        <a class="btn btn-accent" href="#download">
                            Get the App
                        </a>
                        <a class="btn btn-ghost" href="#how">
                            <span class="play-dot" aria-hidden="true">
                                <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5.5v13l11-6.5-11-6.5Z"/></svg>
                            </span>
                            Watch Demo
                        </a>
                    </div>
                    <div class="hero-proof rise d3">
                        <span class="avatars" aria-hidden="true">
                            <span class="av-1">A</span><span class="av-2">M</span><span class="av-3">S</span><span class="av-4">K</span>
                        </span>
                        <p>Join <b>home cooks</b> cooking with confidence <span class="heart" aria-hidden="true"><svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" style="vertical-align:-2px"><path d="M12 21s-7.5-4.7-10-9.3C.6 8.6 2.4 5 5.7 5c2 0 3.4 1 4.3 2.5h4C14.9 6 16.3 5 18.3 5c3.3 0 5.1 3.6 3.7 6.7C19.5 16.3 12 21 12 21Z"/></svg></span></p>
                    </div>
                </div>

                <div class="hero-art rise" aria-hidden="false">
                    <div class="hero-photo" aria-hidden="true">
                        <img src="/img/landing/hero-pasta.jpg" alt="">
                    </div>
                    <svg class="hero-spark" style="top:6px; left:2%" width="30" height="30" viewBox="0 0 30 30" fill="currentColor" aria-hidden="true"><path d="M15 1c1.2 7.4 4.4 11 13 14-8.6 3-11.8 6.6-13 14-1.2-7.4-4.4-11-13-14C10.6 12 13.8 8.4 15 1Z"/></svg>
                    <svg class="hero-spark" style="bottom:120px; left:6%; width:16px; height:16px" viewBox="0 0 30 30" fill="currentColor" aria-hidden="true"><path d="M15 1c1.2 7.4 4.4 11 13 14-8.6 3-11.8 6.6-13 14-1.2-7.4-4.4-11-13-14C10.6 12 13.8 8.4 15 1Z"/></svg>
                    <svg class="hero-spark" style="bottom:56px; right:8%; width:20px; height:20px" viewBox="0 0 30 30" fill="currentColor" aria-hidden="true"><path d="M15 1c1.2 7.4 4.4 11 13 14-8.6 3-11.8 6.6-13 14-1.2-7.4-4.4-11-13-14C10.6 12 13.8 8.4 15 1Z"/></svg>

                    <div class="phone-shell">
                        <div class="iphone" role="img" aria-label="The RecipeReal app home screen on a phone — a featured recipe with its Really-takes time, a quick-tonight rail, and the app's tab bar">
                            <div class="ip-screen">
                                <div class="ip-statusbar">
                                    <span class="ip-time">15:27</span>
                                    <span class="ip-signals" aria-hidden="true">
                                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="13" r="7.5"/><path d="M12 9.5V13l2.5 2"/><path d="M9.5 3.5h5"/><path d="m17.5 5.5 1.5 1.5"/><path d="m5 5.5 -1.5 1.5"/></svg>
                                        <svg width="14" height="11" viewBox="0 0 24 18" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M2 6.5C5.5 3 10 1.5 12 1.5S18.5 3 22 6.5"/><path d="M5.5 10.5C8 8.3 10.5 7.5 12 7.5s4 .8 6.5 3"/><path d="M9 14.5c1-1 2.2-1.5 3-1.5s2 .5 3 1.5"/></svg>
                                        <svg width="22" height="12" viewBox="0 0 30 14" fill="none"><rect x="0.5" y="0.5" width="24" height="13" rx="4" stroke="#2E9E5B"/><rect x="2" y="2" width="21" height="10" rx="2.6" fill="#2E9E5B"/><path d="M26.5 4.5v5a2.4 2.4 0 0 0 0-5Z" fill="#2E9E5B"/><text x="7.5" y="10.6" font-size="7.5" font-weight="800" fill="#fff" font-family="sans-serif">100</text></svg>
                                    </span>
                                </div>
                                <div class="ip-punch" aria-hidden="true"></div>

                                <div class="ip-home">
                                    <div class="ip-header">
                                        <b>Recipe<em>Real</em></b>
                                        <span class="ip-header-icons">
                                            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 8-3 8h18s-3-1-3-8"/><path d="M13.7 20a2 2 0 0 1-3.4 0"/></svg>
                                            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><circle cx="12" cy="8" r="4"/><path d="M4.5 20.5c1.6-3.4 4.2-5 7.5-5s5.9 1.6 7.5 5"/></svg>
                                        </span>
                                    </div>
                                    <div class="ip-search">
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
                                        Search recipes...
                                    </div>
@php
    $feat = $popular[0] ?? null;
    $rail = array_slice($popular, 1, 4);
    // Dev-DB fallback: the comp's dishes, static. Prod renders real rows.
    $fallbackFeat = ['img' => '/img/landing/hero-pasta.jpg', 'title' => 'Creamy Garlic Pasta', 'minutes' => 35, 'really' => null, 'rating' => '4.9'];
    $fallbackRail = [
        ['img' => '/img/landing/card-pizza.jpg', 'title' => 'Margherita Pizza', 'minutes' => 50, 'rating' => '4.7'],
        ['img' => '/img/landing/card-biryani.jpg', 'title' => 'Chicken Biryani', 'minutes' => 60, 'rating' => '4.8'],
        ['img' => '/img/landing/card-pancakes.jpg', 'title' => 'Classic Pancakes', 'minutes' => 20, 'rating' => '4.8'],
        ['img' => '/img/landing/card-stirfry.jpg', 'title' => 'Vegetable Stir Fry', 'minutes' => 25, 'rating' => '4.7'],
    ];
@endphp
                                    <div class="ip-feat">
                                        <div class="ip-feat-img">
                                            <img src="{{ $feat['img'] ?? $fallbackFeat['img'] }}" alt="">
                                            <svg class="ip-heart" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21s-7.5-4.7-10-9.3C.6 8.6 2.4 5 5.7 5c2 0 3.4 1 4.3 2.5h4C14.9 6 16.3 5 18.3 5c3.3 0 5.1 3.6 3.7 6.7C19.5 16.3 12 21 12 21Z"/></svg>
                                        </div>
                                        <div class="ip-feat-body">
                                            <h3>{{ ($feat ?? $fallbackFeat)['title'] }}</h3>
                                            <div class="ip-meta">
                                                <span class="ip-chip">
                                                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>
                                                    {{ ($feat ?? $fallbackFeat)['minutes'] }} min
                                                </span>
                                                <span class="ip-chip ip-star">★ {{ ($feat ?? $fallbackFeat)['rating'] }}</span>
                                            </div>
                                            <span class="ip-really">
                                                Really takes
                                                <b>{{ ($feat['really'] ?? null) !== null ? $feat['really'].'m' : ($feat ?? $fallbackFeat)['minutes'].'m' }}</b>
                                            </span>
                                            <span class="ip-start">Start cooking</span>
                                        </div>
                                    </div>

                                    <div class="ip-rail-head">
                                        <b>Quick tonight</b>
                                        <span>See all</span>
                                    </div>
                                    <div class="ip-rail">
                                        @foreach (($feat ? $rail : $fallbackRail) as $row)
                                            <div class="ip-mini">
                                                <img src="{{ $row['img'] }}" alt="" loading="lazy">
                                                <b>{{ \Illuminate\Support\Str::limit($row['title'], 24) }}</b>
                                                <span class="ip-chip">
                                                    <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>
                                                    {{ $row['minutes'] }} min
                                                </span>
                                            </div>
                                        @endforeach
                                    </div>
                                </div>

                                <div class="ip-tabbar">
                                    <span class="ip-tab active">
                                        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="m3 10.5 9-7.5 9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1v-9.5Z"/></svg>
                                        Home
                                    </span>
                                    <span class="ip-tab">
                                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
                                        Browse
                                    </span>
                                    <span class="ip-tab">
                                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21s-7.5-4.7-10-9.3C.6 8.6 2.4 5 5.7 5c2 0 3.4 1 4.3 2.5h4C14.9 6 16.3 5 18.3 5c3.3 0 5.1 3.6 3.7 6.7C19.5 16.3 12 21 12 21Z"/></svg>
                                        Favorites
                                    </span>
                                    <span class="ip-tab">
                                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="9" cy="8" r="3.2"/><path d="M2.5 19c1.2-2.8 3.6-4.2 6.5-4.2s5.3 1.4 6.5 4.2"/><circle cx="17" cy="9" r="2.6"/><path d="M16.5 14.6c2.4.2 4.2 1.5 5 3.9"/></svg>
                                        Community
                                    </span>
                                    <span class="ip-tab">
                                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="3"/><path d="M19 12a7 7 0 0 0-.14-1.4l2-1.55-2-3.46-2.35.95a7 7 0 0 0-2.42-1.4L13.7 2.6h-3.4l-.4 2.54a7 7 0 0 0-2.4 1.4l-2.36-.94-2 3.45 2 1.55A7 7 0 0 0 5 12c0 .48.05.94.14 1.4l-2 1.55 2 3.46 2.35-.95a7 7 0 0 0 2.42 1.4l.39 2.54h3.4l.4-2.54a7 7 0 0 0 2.4-1.4l2.36.95 2-3.45-2-1.55c.09-.46.14-.92.14-1.4Z"/></svg>
                                        Settings
                                    </span>
                                </div>
                                <div class="home-indicator" aria-hidden="true"></div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </header>

        <section class="features" id="features" aria-label="Features">
            <div class="wrap">
                <div class="feat-grid">
                    <div class="feat">
                        <span class="feat-ico">
                            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>
                        </span>
                        <h3>Accurate Estimates</h3>
                        <p>Real cooking-time estimates based on measured cooks — not marketing math.</p>
                    </div>
                    <div class="feat">
                        <span class="feat-ico">
                            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4.5 12.5 3.6 9.2a3.4 3.4 0 0 1 4.6-4l1 .4a4.6 4.6 0 0 1 5.6 0l1-.4a3.4 3.4 0 0 1 4.6 4l-.9 3.3"/><path d="M4.5 12.5h15v2.6a3 3 0 0 1-3 3h-9a3 3 0 0 1-3-3v-2.6Z"/><path d="M12 3.5v2"/></svg>
                        </span>
                        <h3>For Every Cook</h3>
                        <p>Novice, intermediate, or expert — the time bends to your pace, not the other way around.</p>
                    </div>
                    <div class="feat">
                        <span class="feat-ico">
                            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 4h8a2 2 0 0 1 2 2v14l-6-3-6 3V6a2 2 0 0 1 2-2Z"/><path d="M9.5 9.5h5"/><path d="M9.5 13h3"/></svg>
                        </span>
                        <h3>Guided Cook Mode</h3>
                        <p>Step-by-step timers and alarms keep you on track from start to finish — even on a locked phone.</p>
                    </div>
                    <div class="feat">
                        <span class="feat-ico">
                            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 20h16"/><path d="M6.5 20v-6"/><path d="M11.5 20V9"/><path d="M16.5 20v-8.5"/><path d="M21 20V4.5"/></svg>
                        </span>
                        <h3>Learn &amp; Improve</h3>
                        <p>Every cook you log tunes the estimates — for you, and for every cook after you.</p>
                    </div>
                </div>
            </div>
        </section>

        <section class="how" id="how">
            <div class="wrap">
                <div class="sec-head">
                    <h2>How Recipe<span class="o">Real</span> Works</h2>
                    <div class="rule" aria-hidden="true"></div>
                </div>
                <div class="steps">
                    <div class="step">
                        <span class="step-ico">
                            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 6.5C10.4 5 8.2 4.5 5.5 4.5c-.8 0-1.5.7-1.5 1.5v11c0 .8.7 1.5 1.5 1.5 2.7 0 4.9.5 6.5 2 1.6-1.5 3.8-2 6.5-2 .8 0 1.5-.7 1.5-1.5v-11c0-.8-.7-1.5-1.5-1.5-2.7 0-4.9.5-6.5 2Z"/><path d="M12 6.5v14"/></svg>
                        </span>
                        <h3><i>1.</i> Choose a Recipe</h3>
                        <p>Pick from thousands of halal-friendly, tested recipes.</p>
                    </div>
                    <div class="step">
                        <span class="step-ico">
                            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 7h16"/><path d="M4 12h16"/><path d="M4 17h10"/><circle cx="19" cy="17" r="2.4"/></svg>
                        </span>
                        <h3><i>2.</i> See the Claim</h3>
                        <p>Every recipe shows the time it claims — on record, exactly as printed.</p>
                    </div>
                    <div class="step">
                        <span class="step-ico">
                            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="13" r="8"/><path d="M12 9.5V13l2.5 2"/><path d="M9.5 2.5h5"/><path d="m18.5 4.5 1.5 1.5"/><path d="m5.5 4.5 -1.5 1.5"/></svg>
                        </span>
                        <h3><i>3.</i> Cook with Guidance</h3>
                        <p>Cook Mode runs a step-by-step stopwatch with alarms that ring anywhere.</p>
                    </div>
                    <div class="step">
                        <span class="step-ico">
                            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 6h11a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2Z"/><path d="M8 2.5h11a2 2 0 0 1 2 2V17"/><path d="M8.5 12l2.5 2.5 4.5-4.5"/></svg>
                        </span>
                        <h3><i>4.</i> Log the Reality</h3>
                        <p>Your measured time files against the claim — pause-adjusted, automatically.</p>
                    </div>
                    <div class="step">
                        <span class="step-ico">
                            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 12a8 8 0 1 1-2.34-5.66"/><path d="M20 3v4h-4"/></svg>
                        </span>
                        <h3><i>5.</i> Estimates Calibrate</h3>
                        <p>Every cook tunes the next estimate — for you, and for everyone.</p>
                    </div>
                </div>
            </div>
        </section>

        <section class="recipes" id="recipes">
            <div class="wrap">
                <div class="sec-head recipes-bar">
                    <div class="sec-head" style="margin:0">
                        <h2>Browse Popular Recipes</h2>
                        <div class="rule" aria-hidden="true"></div>
                    </div>
                    <a class="view-all" href="{{ route('app.download') }}" title="Browse all 20,089 recipes in the app">
                        View all recipes
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="vertical-align:-2px"><path d="M4 12h15"/><path d="m13 6 6 6-6 6"/></svg>
                    </a>
                </div>
                <div class="recipe-grid">
                    @if (count($popular) > 0)
                        @foreach ($popular as $row)
                            <a class="recipe-card" href="/r/{{ $row['id'] }}">
                                <img src="{{ $row['img'] }}" alt="{{ $row['title'] }}" loading="lazy">
                                <span class="rc-body">
                                    <h3>{{ $row['title'] }}</h3>
                                    <span class="rc-meta">
                                        <span class="rc-time">
                                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>
                                            {{ $row['minutes'] }} min
                                        </span>
                                        <span class="rc-star">
                                            <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="m12 2.5 2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4l-5.9 3.1 1.2-6.5L2.5 9.4l6.6-.9 2.9-6Z"/></svg>
                                            {{ $row['rating'] }}
                                        </span>
                                    </span>
                                </span>
                            </a>
                        @endforeach
                    @else
                        @foreach ([
                            ['img' => '/img/landing/card-pizza.jpg', 'title' => 'Margherita Pizza', 'minutes' => 50, 'rating' => '4.7'],
                            ['img' => '/img/landing/card-biryani.jpg', 'title' => 'Chicken Biryani', 'minutes' => 60, 'rating' => '4.8'],
                            ['img' => '/img/landing/card-brownies.jpg', 'title' => 'Chocolate Brownies', 'minutes' => 45, 'rating' => '4.9'],
                            ['img' => '/img/landing/card-pancakes.jpg', 'title' => 'Classic Pancakes', 'minutes' => 20, 'rating' => '4.8'],
                            ['img' => '/img/landing/card-stirfry.jpg', 'title' => 'Vegetable Stir Fry', 'minutes' => 25, 'rating' => '4.7'],
                        ] as $row)
                            <a class="recipe-card" href="{{ route('app.download') }}" title="Live from the recipe library once it syncs">
                                <img src="{{ $row['img'] }}" alt="{{ $row['title'] }}" loading="lazy">
                                <span class="rc-body">
                                    <h3>{{ $row['title'] }}</h3>
                                    <span class="rc-meta">
                                        <span class="rc-time">
                                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>
                                            {{ $row['minutes'] }} min
                                        </span>
                                        <span class="rc-star">
                                            <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="m12 2.5 2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4l-5.9 3.1 1.2-6.5L2.5 9.4l6.6-.9 2.9-6Z"/></svg>
                                            {{ $row['rating'] }}
                                        </span>
                                    </span>
                                </span>
                            </a>
                        @endforeach
                    @endif
                </div>
            </div>
        </section>

        <section class="app-show" id="download">
            <div class="wrap">
                <div>
                    <h2>Everything you need<br>in one app.</h2>
                    <p class="app-lede">
                        RecipeReal is more than just recipes. It's your personal cooking
                        assistant that helps you plan, cook, learn, and share.
                    </p>
                    <div class="badges">
                        @isset($latestRelease)
                            <a class="store-badge" href="{{ route('app.download') }}">
                                <svg width="25" height="25" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" aria-hidden="true"><path d="M5.5 18v-6.5a6.5 6.5 0 0 1 13 0V18Z" fill="currentColor" stroke-linejoin="round"/><path d="m8.6 4.2-1.3-2.1M15.4 4.2l1.3-2.1"/><circle cx="9.7" cy="10.4" r="1.1" fill="#0E1117" stroke="none"/><circle cx="14.3" cy="10.4" r="1.1" fill="#0E1117" stroke="none"/></svg>
                                <span><small>Download on the</small><b>Android APK</b></span>
                            </a>
                        @else
                            <span class="store-badge" aria-disabled="true">
                                <svg width="25" height="25" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" aria-hidden="true"><path d="M5.5 18v-6.5a6.5 6.5 0 0 1 13 0V18Z" fill="currentColor" stroke-linejoin="round"/><path d="m8.6 4.2-1.3-2.1M15.4 4.2l1.3-2.1"/><circle cx="9.7" cy="10.4" r="1.1" fill="#0E1117" stroke="none"/><circle cx="14.3" cy="10.4" r="1.1" fill="#0E1117" stroke="none"/></svg>
                                <span><small>Download on the</small><b>Android APK</b></span>
                            </span>
                        @endisset
                        <span class="store-badge soon" aria-disabled="true" title="iOS is on the roadmap">
                            <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M17.05 12.54c-.03-2.89 2.36-4.27 2.47-4.34-1.35-1.97-3.44-2.24-4.18-2.27-1.78-.18-3.47 1.05-4.37 1.05-.9 0-2.29-1.02-3.77-1-1.94.03-3.72 1.13-4.72 2.86-2.01 3.49-.51 8.66 1.45 11.49.96 1.39 2.11 2.95 3.62 2.89 1.45-.06 2-.94 3.75-.94s2.25.94 3.78.91c1.56-.03 2.55-1.42 3.5-2.81 1.1-1.61 1.56-3.17 1.58-3.25-.03-.02-3.06-1.17-3.11-4.59ZM14.16 4.06c.8-.97 1.34-2.32 1.19-3.66-1.15.05-2.55.77-3.38 1.73-.74.86-1.39 2.23-1.22 3.55 1.29.1 2.6-.65 3.41-1.62Z"/></svg>
                            <span><small>Download on the</small><b>App Store</b></span>
                        </span>
                    </div>
                    <p class="dl-meta">
                        @isset($latestRelease)
                            Version <b>{{ $latestRelease->version }}</b>
                            &nbsp;·&nbsp; {{ $latestRelease->humanSize() }}
                            &nbsp;·&nbsp; Android 7.0+ · Free
                        @else
                            First public build landing shortly &nbsp;·&nbsp; Android 7.0+ · Free
                        @endisset
                    </p>
                </div>

                {{-- Three representative app screens: real mechanisms
                    (Cook Mode stopwatch, claim-vs-reality card, community
                    "try"), styled like the app. Not live UI. --}}
                <div class="phones" aria-label="Preview of Cook Mode, claim vs reality, and community screens">
                    <div class="mini-phone mp-cook" role="img" aria-label="Cook Mode screen with a step timer">
                        <div class="mp-screen">
                            <span class="mp-cap" aria-hidden="true"></span>
                            <p class="mp-label">Cook Mode</p>
                            <span class="mp-step-chip">Step 3 of 6</span>
                            <p class="mp-task">Add the garlic</p>
                            <p class="mp-clock">02:30</p>
                            <div class="mp-bar"><i></i></div>
                            <div class="mp-btns">
                                <span class="mp-btn pause"><svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" style="vertical-align:-1px" aria-hidden="true"><path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z"/></svg> Pause</span>
                                <span class="mp-btn ghost">Skip step</span>
                            </div>
                        </div>
                    </div>
                    <div class="mini-phone mp-main" role="img" aria-label="A recipe card showing the claimed time crossed out and the measured Really-takes time">
                        <div class="mp-screen">
                            <span class="mp-cap" aria-hidden="true"></span>
                            <div class="mp-card">
                                <img src="/img/landing/card-biryani.jpg" alt="" loading="lazy">
                                <div class="mpc-body">
                                    <h4>Chicken Biryani</h4>
                                    <span class="mpc-claim">Recipe says <s>60 min</s></span>
                                    <span class="mpc-real">Really takes 74m</span>
                                </div>
                            </div>
                            <p class="mp-note">Measured by cooks like you in guided Cook Mode. Your next estimate starts here.</p>
                            <span class="mp-save">Start cooking</span>
                        </div>
                    </div>
                    <div class="mini-phone mp-log" role="img" aria-label="A community post: a cook sharing a measured try">
                        <div class="mp-screen">
                            <span class="mp-cap" aria-hidden="true"></span>
                            <p class="mp-label">Community</p>
                            <div class="mp-person">
                                <span class="mp-av">A</span>
                                <span><b>Amina shared a try</b><span>Chicken Biryani · measured 74 min</span></span>
                            </div>
                            <div class="mp-progress" aria-hidden="true">
                                <i style="height:34%"></i><i style="height:52%"></i><i class="hot" style="height:88%"></i><i style="height:46%"></i><i style="height:64%"></i>
                            </div>
                            <div class="mp-scale"><span>Claim</span><span>Your pace</span></div>
                            <p class="mp-note">"The stopwatch kept dinner honest — worth it."</p>
                            <span class="mp-save">Read the notes</span>
                        </div>
                    </div>
                </div>
            </div>
        </section>

        <section class="community" id="community">
            <div class="wrap">
                <div class="sec-head">
                    <h2>Loved by <span class="o">home cooks</span></h2>
                    <div class="rule" aria-hidden="true"></div>
                </div>
                {{-- Template testimonials from the owner's design image —
                    replace with real user quotes when available. --}}
                <div class="quotes">
                    <figure class="quote">
                        <span class="stars" aria-label="5 out of 5 stars">
                            @for ($i = 0; $i < 5; $i++)<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="m12 2.5 2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4l-5.9 3.1 1.2-6.5L2.5 9.4l6.6-.9 2.9-6Z"/></svg>@endfor
                        </span>
                        <p>"Finally, a recipe app that gets the time right! As a busy mom, RecipeReal has saved me so much stress in the kitchen."</p>
                        <figcaption class="quote-person">
                            <span class="q-av" style="background:#C96F4A">A</span>
                            <span><b>Amina K.</b><span>Home Cook</span></span>
                        </figcaption>
                    </figure>
                    <figure class="quote">
                        <span class="stars" aria-label="5 out of 5 stars">
                            @for ($i = 0; $i < 5; $i++)<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="m12 2.5 2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4l-5.9 3.1 1.2-6.5L2.5 9.4l6.6-.9 2.9-6Z"/></svg>@endfor
                        </span>
                        <p>"The guided cook mode is a game changer. The timers and cues make cooking so much easier and more fun."</p>
                        <figcaption class="quote-person">
                            <span class="q-av" style="background:#8A9A5B">Y</span>
                            <span><b>Youssef M.</b><span>Food Lover</span></span>
                        </figcaption>
                    </figure>
                    <figure class="quote">
                        <span class="stars" aria-label="5 out of 5 stars">
                            @for ($i = 0; $i < 5; $i++)<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="m12 2.5 2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4l-5.9 3.1 1.2-6.5L2.5 9.4l6.6-.9 2.9-6Z"/></svg>@endfor
                        </span>
                        <p>"I love logging my cooks and seeing my progress over time. It keeps me motivated to try new recipes."</p>
                        <figcaption class="quote-person">
                            <span class="q-av" style="background:#B58436">S</span>
                            <span><b>Salma H.</b><span>Baking Enthusiast</span></span>
                        </figcaption>
                    </figure>
                </div>
                <div class="dots" aria-hidden="true"><i class="on"></i><i></i><i></i></div>
                <p class="quotes-note">Early preview quotes — real cook stories arrive with the community.</p>
            </div>
        </section>

        <section class="cta">
            <div class="cta-photo left" aria-hidden="true">
                <img src="/img/hero-dish.jpg" alt="" loading="lazy">
            </div>
            <div class="cta-photo right" aria-hidden="true">
                <img src="/img/landing/card-pizza.jpg" alt="" loading="lazy">
            </div>
            <div class="wrap">
                <div class="cta-inner">
                    <h2>Ready to cook with confidence?</h2>
                    <p>Join the home cooks using RecipeReal to make every meal a success.</p>
                    {{-- Placeholder wiring: there is no email backend yet —
                        the button routes to the APK download. --}}
                    <form class="cta-form" action="{{ route('app.download') }}" method="get">
                        <input type="email" name="email" placeholder="Enter your email" aria-label="Email address">
                        <button class="btn btn-dark" type="submit">Get Early Access</button>
                    </form>
                </div>
            </div>
        </section>

        @include('partials.site-footer')

        @include('partials.download-confirm')

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
              "description": "Halal-first recipe app with accurate cooking-time estimates: claim vs reality on every recipe, guided Cook Mode with step alarms, an offline library, and estimates that calibrate to your pace.",
              "softwareVersion": "{{ isset($latestRelease) ? $latestRelease->version : '1.0.0' }}",
              "offers": {
                "@type": "Offer",
                "price": "0",
                "priceCurrency": "USD",
                "availability": "https://schema.org/InStock"
              },
              "author": { "@id": "https://recipe-real.softland.tech/#org" }
            }
          ]
        }
        </script>

        {{-- The one authored moment: the hero settles in on load (CSS).
             This script only drives the mobile testimonial dots. --}}
        <script>
        (function () {
            var track = document.querySelector('.quotes');
            var dots = document.querySelectorAll('.dots i');
            if (!track || !dots.length || typeof IntersectionObserver === 'undefined') return;
            var io = new IntersectionObserver(function (entries) {
                entries.forEach(function (e) {
                    if (!e.isIntersecting) return;
                    var idx = Array.prototype.indexOf.call(track.children, e.target);
                    dots.forEach(function (d, i) { d.classList.toggle('on', i === idx); });
                });
            }, { root: track, threshold: 0.6 });
            Array.prototype.forEach.call(track.children, function (q) { io.observe(q); });
        })();
        </script>

    </body>
</html>
