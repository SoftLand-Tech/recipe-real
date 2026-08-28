<!DOCTYPE html>
<html lang="en">
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
        <meta name="color-scheme" content="light">
        <title>@yield('title', 'RecipeReal')</title>
        <meta name="description" content="@yield('description', 'Accurate cooking-time estimates for every skill level. Halal-friendly, offline, honest times measured by real cooks. Free Android app.')">
        <meta name="theme-color" content="#FAF6EF">
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png">
        <link rel="preload" href="/fonts/Fraunces-latin.woff2" as="font" type="font/woff2" crossorigin>
        <link rel="preload" href="/fonts/DMSans-latin.woff2" as="font" type="font/woff2" crossorigin>
        <link rel="icon" type="image/x-icon" href="/favicon.ico">
        <link rel="apple-touch-icon" href="/apple-touch-icon.png">
        @yield('head')
        <style>
            /* Shared chrome for RecipeReal content pages: same tokens, nav,
               footer and button language as the landing. Page bodies use the
               .page prose styles. */
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
                --cream: #FAF6EF; --cream-deep: #F5EEE2; --white: #FFFFFF;
                --ink: #26211B; --muted: #6E6558; --faint: #988D7E;
                --orange: #F26B1D; --orange-deep: #CE5710; --orange-soft: #FDEBDD;
                --teal: #287C78; --dark: #232936; --dark-2: #1D222C;
                --dark-muted: #AEB5C2; --hair: #EFE5D6;
                --font-display: "Fraunces", Georgia, serif;
                --font-body: "DM Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
                color-scheme: light;
                scrollbar-color: #D9CDBB var(--cream);
            }
            *, *::before, *::after { box-sizing: border-box; }
            html { scroll-behavior: smooth; }
            body {
                margin: 0; background: var(--white); color: var(--ink);
                font-family: var(--font-body); font-size: 16.5px; line-height: 1.65;
                -webkit-font-smoothing: antialiased; text-rendering: optimizeLegibility;
            }
            ::selection { background: var(--orange); color: #fff; }
            a { color: inherit; }
            :focus-visible { outline: 2.5px solid var(--orange); outline-offset: 3px; border-radius: 4px; }
            img { max-width: 100%; }
            .wrap { max-width: 1160px; margin: 0 auto; padding: 0 28px; }

            /* buttons */
            .btn {
                display: inline-flex; align-items: center; justify-content: center; gap: 10px;
                padding: 13px 26px; border-radius: 999px;
                font-weight: 700; font-size: 15px; text-decoration: none;
                border: 1px solid transparent; cursor: pointer; font-family: var(--font-body);
                transition: background .16s ease, border-color .16s ease, transform .12s ease;
            }
            .btn:active { transform: translateY(1px); }
            .btn-accent { background: var(--orange); color: #fff; box-shadow: 0 10px 22px -10px rgba(242,107,29,.55); }
            .btn-accent:hover { background: var(--orange-deep); }
            .btn-ghost { background: var(--white); color: var(--ink); border-color: #E8DFD2; }
            .btn-ghost:hover { border-color: var(--orange); color: var(--orange-deep); }

            /* nav */
            .nav { background: var(--cream); position: sticky; top: 0; z-index: 50;
                border-bottom: 1px solid rgba(239,229,214,.7); }
            .nav-inner { display: flex; align-items: center; justify-content: space-between; height: 66px; gap: 18px; }
            .brand { display: flex; align-items: center; gap: 10px; text-decoration: none; }
            .brand-mark { width: 34px; height: 34px; object-fit: contain; }
            .brand b { font-family: var(--font-body); font-weight: 800; font-size: 23px; letter-spacing: -.01em; color: var(--ink); }
            .brand b em { font-style: normal; color: var(--orange); }
            .nav-links { display: flex; align-items: center; gap: 26px; }
            .nav-links a:not(.btn) { text-decoration: none; font-size: 14.5px; font-weight: 600; color: var(--muted); padding: 6px 2px; position: relative; }
            .nav-links a:not(.btn):hover { color: var(--ink); }
            .nav-links a:not(.btn).active { color: var(--orange-deep); }
            .nav-links a:not(.btn).active::after { content: ""; position: absolute; left: 50%; transform: translateX(-50%);
                bottom: -4px; width: 16px; height: 3px; border-radius: 99px; background: var(--orange); }
            .nav .btn-accent { padding: 11px 22px; font-size: 14px; }
            @media (max-width: 1180px) {
                .nav-links { gap: 15px; }
                .nav-links a:not(.btn), .nav .btn-accent { white-space: nowrap; }
                .nav .btn-accent { padding: 10px 17px; font-size: 13.5px; }
            }
            @media (max-width: 860px) { .nav-links a:not(.btn) { display: none; } }

            /* page body */
            .page { max-width: 760px; margin: 0 auto; padding: 56px 28px 80px; }
            .page h1 {
                font-family: var(--font-display); font-weight: 640; font-variation-settings: "opsz" 40;
                font-size: clamp(2.1rem, 4.4vw, 3.1rem); line-height: 1.1; letter-spacing: -.012em;
                margin: 0 0 8px; text-wrap: balance;
            }
            .page h1 .o { color: var(--orange); }
            .page .rule { width: 54px; height: 5px; border-radius: 99px; background: var(--orange); margin: 16px 0 22px; }
            .page .lede { font-size: 17.5px; color: var(--muted); margin: 0 0 30px; max-width: 40em; }
            .page h2 {
                font-family: var(--font-display); font-weight: 640; font-variation-settings: "opsz" 30;
                font-size: 1.55rem; line-height: 1.2; margin: 40px 0 10px; letter-spacing: -.008em;
            }
            .page h3 { font-size: 17px; font-weight: 800; margin: 28px 0 6px; }
            .page p { margin: 0 0 16px; color: #4E463B; }
            .page ul, .page ol { margin: 0 0 18px; padding-inline-start: 22px; color: #4E463B; }
            .page li { margin-bottom: 8px; }
            .page li::marker { color: var(--orange-deep); font-weight: 700; }
            .page strong { color: var(--ink); }
            .page a:not(.btn) { color: var(--orange-deep); font-weight: 600; text-decoration: underline; text-underline-offset: 3px; }
            .page a:not(.btn):hover { color: var(--orange); }
            .page blockquote { margin: 20px 0; padding: 14px 20px; border-inline-start: 3px solid var(--orange);
                background: var(--cream); border-radius: 0 14px 14px 0; color: var(--ink); font-style: italic; }
            .card { background: var(--white); border: 1px solid var(--hair); border-radius: 18px; padding: 24px 26px;
                box-shadow: 0 14px 30px -24px rgba(38,33,27,.4); margin: 0 0 18px; }
            .card h2, .card h3 { margin-top: 0; }
            .band { background: var(--cream); border-block: 1px solid var(--hair); }
            .grid { display: grid; gap: 18px; }
            .grid.g2 { grid-template-columns: 1fr 1fr; }
            .grid.g3 { grid-template-columns: repeat(3, 1fr); }
            @media (max-width: 760px) { .grid.g2, .grid.g3 { grid-template-columns: 1fr; } }
            .pill { display: inline-flex; align-items: center; gap: 7px; font-size: 13px; font-weight: 700;
                color: var(--orange-deep); background: var(--orange-soft); border-radius: 999px; padding: 5px 14px; }
            .pill.teal { color: var(--teal); background: #E7F1EF; }
            .page table { width: 100%; border-collapse: collapse; margin: 0 0 18px; font-size: 15px; }
            .page th, .page td { text-align: start; padding: 11px 14px; border-bottom: 1px solid var(--hair); }
            .page th { font-size: 12.5px; letter-spacing: .08em; text-transform: uppercase; color: var(--muted); }
            .page td b { color: var(--ink); }
            .ar { direction: rtl; text-align: right; font-size: 15.5px; color: #4E463B; }
            .ar h2 { direction: rtl; }

            /* forms */
            .field { margin: 0 0 16px; }
            .field label { display: block; font-size: 13.5px; font-weight: 700; margin-bottom: 6px; color: var(--ink); }
            .field input, .field textarea {
                width: 100%; border: 1px solid #E4D9C8; border-radius: 14px; background: var(--white);
                padding: 12px 16px; font: inherit; font-size: 15px; color: var(--ink); caret-color: var(--orange);
            }
            .field input:focus, .field textarea:focus { outline: 2.5px solid var(--orange); outline-offset: 1px; }
            .notice { background: #E9F3EC; color: #2C6E45; border: 1px solid #CBE3D3; border-radius: 14px;
                padding: 14px 18px; margin: 0 0 20px; font-weight: 600; }

            /* footer */
            footer { background: var(--dark-2); color: var(--dark-muted); padding: 62px 0 34px; margin-top: 40px; }
            .foot-grid { display: grid; grid-template-columns: 1.5fr 1fr 1fr 1fr; gap: 34px; }
            .foot-brand p { margin: 14px 0 0; font-size: 14px; line-height: 1.65; max-width: 15em; color: var(--dark-muted); }
            .foot-col h4 { margin: 4px 0 16px; font-size: 13px; font-weight: 800; letter-spacing: .1em; text-transform: uppercase; color: #fff; }
            .foot-col a { display: block; text-decoration: none; font-size: 14px; color: var(--dark-muted); padding: 4.5px 0; }
            .foot-col a:hover { color: #fff; }
            .foot-bottom { border-top: 1px solid #2C3342; margin-top: 46px; padding-top: 22px;
                display: flex; justify-content: space-between; gap: 10px; flex-wrap: wrap; font-size: 13px; color: #8B93A3; }
            .foot-bottom a { color: inherit; text-decoration: none; }
            .foot-bottom a:hover { color: #fff; }
            @media (max-width: 940px) { .foot-grid { grid-template-columns: 1fr 1fr; } }
            @media (max-width: 480px) { .foot-grid { grid-template-columns: 1fr; } }
        </style>
    </head>
    <body>
        @include('partials.site-nav')
        <main>
            @yield('content')
        </main>
        @include('partials.site-footer')
        @yield('jsonld')
    </body>
</html>
