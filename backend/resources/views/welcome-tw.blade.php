<!DOCTYPE html>
<html lang="{{ app()->getLocale() }}" dir="{{ app()->getLocale() === 'ar' ? 'rtl' : 'ltr' }}" class="scroll-smooth motion-reduce:scroll-auto [color-scheme:light] [scrollbar-color:#D9CDBB_#FAF6EF]">
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
        <meta name="color-scheme" content="light">
        <title>{{ __('site.meta_title') }}</title>
        <meta name="description" content="{{ __('site.meta_desc') }}">
        <link rel="canonical" href="https://recipe-real.softland.tech/">
        <link rel="alternate" hreflang="en" href="https://recipe-real.softland.tech/?lang=en">
        <link rel="alternate" hreflang="ar" href="https://recipe-real.softland.tech/?lang=ar">
        <link rel="alternate" hreflang="x-default" href="https://recipe-real.softland.tech/">
        <meta name="theme-color" content="#FAF6EF">
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png">
        <link rel="preload" href="/fonts/Fraunces-latin.woff2" as="font" type="font/woff2" crossorigin>
        <link rel="preload" href="/fonts/DMSans-latin.woff2" as="font" type="font/woff2" crossorigin>
        <link rel="icon" type="image/x-icon" href="/favicon.ico">
        <link rel="apple-touch-icon" href="/apple-touch-icon.png">
        <meta property="og:type" content="website">
        <meta property="og:site_name" content="RecipeReal">
        <meta property="og:title" content="{{ __('site.og_title') }}">
        <meta property="og:description" content="{{ __('site.og_desc') }}">
        <meta property="og:url" content="https://recipe-real.softland.tech/">
        <meta property="og:image" content="https://recipe-real.softland.tech/img/recipereallogo.webp">
        <meta name="twitter:card" content="summary_large_image">
        <meta name="twitter:title" content="{{ __('site.og_title') }}">
        <meta name="twitter:description" content="{{ __('site.twitter_desc') }}">
        <meta name="twitter:image" content="https://recipe-real.softland.tech/img/recipereallogo.webp">
        @vite('resources/css/welcome-tw.css')
        <style>
            /* RTL: Arabic uses system Arabic fonts (Fraunces/DM Sans are
               latin-only), drops latin letter-spacing (it breaks Arabic
               joining), and mirrors the decorative absolute art. Layout
               flex/grid flips automatically via dir="rtl". */
            [dir="rtl"] body { font-family: "DM Sans", -apple-system, BlinkMacSystemFont,
                "Segoe UI", Tahoma, "Noto Sans Arabic", "Cairo", Roboto, sans-serif; }
            [dir="rtl"] .font-display { font-family: "DM Sans", -apple-system,
                BlinkMacSystemFont, "Segoe UI", Tahoma, "Noto Sans Arabic", "Cairo", sans-serif; }
            [dir="rtl"] h1, [dir="rtl"] h2, [dir="rtl"] h3, [dir="rtl"] h4,
            [dir="rtl"] b { letter-spacing: 0 !important; }
            [dir="rtl"] .hero-art { left: min(-28px,(1104px - 100vw)/2) !important; right: -30px !important; }
            [dir="rtl"] .hero-fade-h { background: linear-gradient(270deg,#FAF6EF 0%,rgba(250,246,239,.85) 22%,rgba(250,246,239,0) 62%) !important; }
            /* Directional icons that must point the other way in RTL. */
            [dir="rtl"] .flip-rtl { display: inline-block; transform: scaleX(-1); }
            /* Hero sparkles: physical spots mirrored. */
            .sparkle-1 { top: 6px; left: 2%; }
            .sparkle-2 { bottom: 120px; left: 6%; }
            .sparkle-3 { bottom: 56px; right: 8%; }
            [dir="rtl"] .sparkle-1 { left: auto; right: 2%; }
            [dir="rtl"] .sparkle-2 { left: auto; right: 6%; }
            [dir="rtl"] .sparkle-3 { right: auto; left: 8%; }
            [dir="rtl"] .how-arrow { right: auto !important; left: -26px; transform: scaleX(-1); }
            [dir="rtl"] .cta-side-l { left: auto !important; right: 0 !important; }
            [dir="rtl"] .cta-side-r { right: auto !important; left: 0 !important; }
            [dir="rtl"] .cta-fade-l { background: linear-gradient(270deg,rgba(242,107,29,.12) 0%,rgba(242,107,29,.35) 34%,rgba(242,107,29,.78) 68%,#F26B1D 100%) !important; }
            [dir="rtl"] .cta-fade-r { background: linear-gradient(90deg,rgba(242,107,29,.12) 0%,rgba(242,107,29,.35) 34%,rgba(242,107,29,.78) 68%,#F26B1D 100%) !important; }
        </style>
    </head>
    <body class="bg-white text-ink font-body text-[16.5px] leading-[1.65] antialiased [text-rendering:optimizeLegibility] [padding:env(safe-area-inset-top)_env(safe-area-inset-right)_env(safe-area-inset-bottom)_env(safe-area-inset-left)] selection:bg-orange selection:text-white">
<!--
DESIGN CONTRACT — WARM KITCHEN TABLE (owner-pinned comp; seed key rrland02)
TAILWIND TWIN: the exact landing rendered with Tailwind v4 utilities
(resources/css/welcome-tw.css) instead of an inline stylesheet — A/B clone
of welcome.blade.php for review. Tokens mirror the original's :root 1:1.
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
FORM: the owner's provided design image is the comp — brief-pinned beats
the direction roll. App screens inside mockups replicate the REAL app;
comp screen content that misstates the product (skill-level selector,
XP points) is replaced with real mechanisms.
FINISH: unreviewed and undocumented is unfinished; this build ends with the
finish review, the verdict, DESIGN.md, and every shipping raster carrying its
provenance.
-->
        {{-- site-nav partial, inlined + converted: this lane is home for anchors --}}
        <div class="bg-cream sticky top-0 z-50 border-b border-[rgba(239,229,214,.7)]">
            <div class="mx-auto max-w-[1160px] px-7 max-[560px]:px-3 max-[380px]:px-2 flex items-center justify-between h-[66px] max-[560px]:h-[60px] gap-[18px] max-[560px]:gap-2 max-[380px]:gap-[6px]">
                <a class="flex items-center gap-[10px] max-[560px]:gap-2 no-underline whitespace-nowrap focus-visible:outline-[2.5px] focus-visible:outline-orange focus-visible:outline-offset-[3px] focus-visible:rounded-[4px]" href="{{ url('/') }}" aria-label="{{ __('site.nav_home_aria') }}">
                    <img class="w-[34px] h-[34px] max-[380px]:w-[30px] max-[380px]:h-[30px] object-contain" src="/img/recipereallogo.webp" alt="" width="34" height="34">
                    <b class="font-body font-extrabold text-[23px] max-[380px]:text-[20px] tracking-[-.01em] text-ink">Recipe<em class="not-italic text-orange">Real</em></b>
                </a>
                <nav class="flex items-center gap-[26px] max-[1180px]:gap-[15px] max-[560px]:gap-2 max-[380px]:gap-[6px]" aria-label="{{ __('site.nav_site_label') }}">
                    <a href="{{ url('/') }}" class="no-underline text-[14.5px] font-semibold text-orange-deep py-[6px] px-[2px] relative hover:text-ink max-[860px]:hidden max-[1180px]:whitespace-nowrap focus-visible:outline-[2.5px] focus-visible:outline-orange focus-visible:outline-offset-[3px] focus-visible:rounded-[4px]">{{ __('site.nav_home') }}<span class="absolute left-1/2 translate-x-[-50%] bottom-[-4px] w-4 h-[3px] rounded-[99px] bg-orange" aria-hidden="true"></span></a>
                    <a href="#features" class="no-underline text-[14.5px] font-semibold text-muted py-[6px] px-[2px] relative hover:text-ink max-[860px]:hidden max-[1180px]:whitespace-nowrap focus-visible:outline-[2.5px] focus-visible:outline-orange focus-visible:outline-offset-[3px] focus-visible:rounded-[4px]">{{ __('site.nav_features') }}</a>
                    <a href="#how" class="no-underline text-[14.5px] font-semibold text-muted py-[6px] px-[2px] relative hover:text-ink max-[860px]:hidden max-[1180px]:whitespace-nowrap focus-visible:outline-[2.5px] focus-visible:outline-orange focus-visible:outline-offset-[3px] focus-visible:rounded-[4px]">{{ __('site.nav_how') }}</a>
                    <a href="#recipes" class="no-underline text-[14.5px] font-semibold text-muted py-[6px] px-[2px] relative hover:text-ink max-[860px]:hidden max-[1180px]:whitespace-nowrap focus-visible:outline-[2.5px] focus-visible:outline-orange focus-visible:outline-offset-[3px] focus-visible:rounded-[4px]">{{ __('site.nav_recipes') }}</a>
                    <a href="{{ route('pages.pricing') }}" class="no-underline text-[14.5px] font-semibold text-muted py-[6px] px-[2px] relative hover:text-ink max-[860px]:hidden max-[1180px]:whitespace-nowrap focus-visible:outline-[2.5px] focus-visible:outline-orange focus-visible:outline-offset-[3px] focus-visible:rounded-[4px]">{{ __('site.nav_pricing') }}</a>
                    @isset($latestRelease)
                    <a href="{{ route('app.download') }}" download data-dl-confirm data-dl-version="{{ $latestRelease->version }}" data-dl-size="{{ $latestRelease->humanSize() }}" class="inline-flex items-center justify-center gap-[10px] rounded-[999px] font-bold tracking-[.005em] no-underline whitespace-nowrap border border-transparent cursor-pointer transition duration-[.16s] [transition-timing-function:ease] active:translate-y-[1px] focus-visible:outline-[2.5px] focus-visible:outline-orange focus-visible:outline-offset-[3px] focus-visible:rounded-[4px] bg-orange text-white shadow-[0_8px_18px_-10px_rgba(242,107,29,.5)] hover:bg-orange-deep py-[11px] px-[22px] text-[14px] max-[1180px]:py-[10px] max-[1180px]:px-[17px] max-[1180px]:text-[13.5px] max-[1180px]:whitespace-nowrap max-[560px]:py-2 max-[560px]:px-3 max-[560px]:text-[12px] max-[380px]:py-[7px] max-[380px]:px-[10px] max-[380px]:text-[11.5px]">{{ __('site.nav_get_app') }}</a>
                    @else
                    <a href="#download" class="inline-flex items-center justify-center gap-[10px] rounded-[999px] font-bold tracking-[.005em] no-underline whitespace-nowrap border border-transparent cursor-pointer transition duration-[.16s] [transition-timing-function:ease] active:translate-y-[1px] focus-visible:outline-[2.5px] focus-visible:outline-orange focus-visible:outline-offset-[3px] focus-visible:rounded-[4px] bg-orange text-white shadow-[0_8px_18px_-10px_rgba(242,107,29,.5)] hover:bg-orange-deep py-[11px] px-[22px] text-[14px] max-[1180px]:py-[10px] max-[1180px]:px-[17px] max-[1180px]:text-[13.5px] max-[1180px]:whitespace-nowrap max-[560px]:py-2 max-[560px]:px-3 max-[560px]:text-[12px] max-[380px]:py-[7px] max-[380px]:px-[10px] max-[380px]:text-[11.5px]">{{ __('site.nav_get_app') }}</a>
                    @endisset
                    @include('partials.lang-switcher')
                </nav>
            </div>
        </div>

        <header class="bg-cream relative overflow-hidden">
            <div class="mx-auto max-w-[1160px] px-7 grid grid-cols-[1.02fr_.98fr] gap-[30px] items-center pt-12 pb-16 relative max-[940px]:grid-cols-1 max-[940px]:pt-9 max-[940px]:pb-0 max-[940px]:gap-0">
                <div>
                    <h1 class="font-display font-[640] [font-variation-settings:'opsz'_40] text-[clamp(2.55rem,5vw,4.1rem)] leading-[1.07] tracking-[-.012em] mt-0 mr-0 mb-5 ml-0 text-balance motion-safe:opacity-0 motion-safe:translate-y-4 motion-safe:animate-rise">
                        <span class="text-orange">{{ __('site.hero_l1_em') }}</span> {{ __('site.hero_l1_rest') }}<br>
                        <span class="text-orange">{{ __('site.hero_l2_em') }}</span> {{ __('site.hero_l2_rest') }}
                    </h1>
                    <p class="text-[17.5px] text-muted max-w-[27.5em] mt-0 mr-0 mb-[30px] ml-0 max-[940px]:max-w-none motion-safe:opacity-0 motion-safe:translate-y-4 motion-safe:animate-rise motion-safe:[animation-delay:80ms]">
                        {{ __('site.hero_sub') }}
                    </p>
                    <div class="flex flex-wrap gap-[13px] items-center max-[480px]:flex-nowrap max-[480px]:gap-[10px] motion-safe:opacity-0 motion-safe:translate-y-4 motion-safe:animate-rise motion-safe:[animation-delay:160ms]">
                        <a class="inline-flex items-center justify-center gap-[10px] rounded-[999px] font-bold text-[15.5px] tracking-[.005em] no-underline border border-transparent cursor-pointer transition duration-[.16s] [transition-timing-function:ease] active:translate-y-[1px] focus-visible:outline-[2.5px] focus-visible:outline-orange focus-visible:outline-offset-[3px] focus-visible:rounded-[4px] py-[14px] px-7 bg-orange text-white shadow-[0_10px_22px_-10px_rgba(242,107,29,.55)] hover:bg-orange-deep max-[480px]:py-3 max-[480px]:px-4 max-[480px]:text-[14px] max-[480px]:whitespace-nowrap max-[359px]:text-[13px] max-[359px]:px-3" href="#download">
                            {{ __('site.hero_get_app') }}
                        </a>
                        <a class="inline-flex items-center justify-center gap-[10px] rounded-[999px] font-bold text-[15.5px] tracking-[.005em] no-underline border border-transparent cursor-pointer transition duration-[.16s] [transition-timing-function:ease] active:translate-y-[1px] focus-visible:outline-[2.5px] focus-visible:outline-orange focus-visible:outline-offset-[3px] focus-visible:rounded-[4px] py-[14px] px-7 bg-white text-ink border-[#E8DFD2] shadow-[0_6px_16px_-10px_rgba(38,33,27,.25)] hover:border-orange hover:text-orange-deep max-[480px]:py-3 max-[480px]:px-4 max-[480px]:text-[14px] max-[480px]:whitespace-nowrap max-[359px]:text-[13px] max-[359px]:px-3" href="#how">
                            <span class="w-[26px] h-[26px] rounded-[99px] bg-orange-soft inline-flex items-center justify-center text-orange-deep shrink-0 max-[480px]:w-[22px] max-[480px]:h-[22px]" aria-hidden="true">
                                <svg class="flip-rtl" width="11" height="11" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5.5v13l11-6.5-11-6.5Z"/></svg>
                            </span>
                            {{ __('site.hero_watch_demo') }}
                        </a>
                    </div>
                </div>

                <div class="relative min-h-[700px] max-[940px]:h-[700px] max-[940px]:min-h-0 max-[940px]:mt-16 max-[420px]:h-[560px] motion-safe:opacity-0 motion-safe:translate-y-4 motion-safe:animate-rise motion-safe:[animation-delay:180ms]" aria-hidden="false">
                    <div class="hero-art absolute top-[-115px] bottom-[-70px] left-[-30px] overflow-hidden [right:min(-28px,(1104px-100vw)/2)] min-[1180px]:[right:calc(-1*((100vw-1104px)/2))] max-[940px]:top-[-70px] max-[940px]:bottom-[-50px] max-[940px]:left-[22%] max-[940px]:right-[-28px] max-[940px]:hidden" aria-hidden="true">
                        <img src="/img/landing/hero-pasta.jpg" alt="" class="w-full h-full object-cover object-[center_40%] block brightness-[1.07] saturate-[1.02]">
                        <div class="hero-fade-h absolute inset-0 bg-[linear-gradient(90deg,#FAF6EF_0%,rgba(250,246,239,.85)_22%,rgba(250,246,239,0)_62%)]" aria-hidden="true"></div>
                        <div class="absolute inset-0 bg-[linear-gradient(0deg,#FAF6EF_0%,rgba(250,246,239,.6)_18%,rgba(250,246,239,0)_46%)]" aria-hidden="true"></div>
                    </div>
                    <svg class="absolute text-orange opacity-[.85] sparkle-1" width="30" height="30" viewBox="0 0 30 30" fill="currentColor" aria-hidden="true"><path d="M15 1c1.2 7.4 4.4 11 13 14-8.6 3-11.8 6.6-13 14-1.2-7.4-4.4-11-13-14C10.6 12 13.8 8.4 15 1Z"/></svg>
                    <svg class="absolute text-orange opacity-[.85] sparkle-2" width="16" height="16" viewBox="0 0 30 30" fill="currentColor" aria-hidden="true"><path d="M15 1c1.2 7.4 4.4 11 13 14-8.6 3-11.8 6.6-13 14-1.2-7.4-4.4-11-13-14C10.6 12 13.8 8.4 15 1Z"/></svg>
                    <svg class="absolute text-orange opacity-[.85] sparkle-3" width="20" height="20" viewBox="0 0 30 30" fill="currentColor" aria-hidden="true"><path d="M15 1c1.2 7.4 4.4 11 13 14-8.6 3-11.8 6.6-13 14-1.2-7.4-4.4-11-13-14C10.6 12 13.8 8.4 15 1Z"/></svg>

                    <div class="absolute left-1/2 top-[44px] translate-x-[-54%] flex justify-center max-[940px]:top-[10px] max-[940px]:translate-x-[-50%] max-[420px]:w-full">
                        <div class="relative w-[400px] shrink-0 bg-[#101013] rounded-[54px] p-[10px] origin-top scale-[.8] shadow-[0_60px_120px_-38px_rgba(38,33,27,.5),inset_0_0_0_2px_#000] max-[420px]:scale-[.68]" role="img" aria-label="{{ __('site.hero_mock_label') }}">
                            <div class="bg-[#FDFBF7] rounded-[44px] overflow-hidden relative w-[380px] h-[780px] flex flex-col text-[#241D17]">
                                <div class="flex items-center justify-between pt-4 px-[30px] pb-[6px] shrink-0">
                                    <span class="text-[14px] font-bold">15:27</span>
                                    <span class="inline-flex items-center gap-[6px]" aria-hidden="true">
                                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="13" r="7.5"/><path d="M12 9.5V13l2.5 2"/><path d="M9.5 3.5h5"/><path d="m17.5 5.5 1.5 1.5"/><path d="m5 5.5 -1.5 1.5"/></svg>
                                        <svg width="14" height="11" viewBox="0 0 24 18" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M2 6.5C5.5 3 10 1.5 12 1.5S18.5 3 22 6.5"/><path d="M5.5 10.5C8 8.3 10.5 7.5 12 7.5s4 .8 6.5 3"/><path d="M9 14.5c1-1 2.2-1.5 3-1.5s2 .5 3 1.5"/></svg>
                                        <svg width="22" height="12" viewBox="0 0 30 14" fill="none"><rect x="0.5" y="0.5" width="24" height="13" rx="4" stroke="#2E9E5B"/><rect x="2" y="2" width="21" height="10" rx="2.6" fill="#2E9E5B"/><path d="M26.5 4.5v5a2.4 2.4 0 0 0 0-5Z" fill="#2E9E5B"/><text x="7.5" y="10.6" font-size="7.5" font-weight="800" fill="#fff" font-family="sans-serif">100</text></svg>
                                    </span>
                                </div>
                                <div class="absolute top-3 left-1/2 translate-x-[-50%] w-[13px] h-[13px] bg-black rounded-[99px]" aria-hidden="true"></div>

                                <div class="flex-1 overflow-hidden pt-[6px] px-4 pb-0">
                                    <div class="flex items-center justify-between pt-1 pb-3">
                                        <b class="text-[19px] font-extrabold tracking-[-.01em]">Recipe<em class="not-italic text-orange">Real</em></b>
                                        <span class="inline-flex items-center gap-4 text-[#241D17]">
                                            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 8-3 8h18s-3-1-3-8"/><path d="M13.7 20a2 2 0 0 1-3.4 0"/></svg>
                                            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><circle cx="12" cy="8" r="4"/><path d="M4.5 20.5c1.6-3.4 4.2-5 7.5-5s5.9 1.6 7.5 5"/></svg>
                                        </span>
                                    </div>
                                    <div class="flex items-center gap-[10px] text-faint bg-[#F3EDE3] rounded-[14px] py-[13px] px-4 text-[13.5px] mb-[14px]">
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
                                        {{ __('site.phone_search') }}
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
                                    <div class="bg-white border border-hair rounded-[18px] pt-[10px] px-[10px] pb-[14px] shadow-[0_14px_30px_-22px_rgba(38,33,27,.4)]">
                                        <div class="relative rounded-[12px] overflow-hidden">
                                            <img src="{{ $feat['img'] ?? $fallbackFeat['img'] }}" alt="" class="w-full h-[190px] object-cover block">
                                            <svg class="absolute top-3 end-3 bg-[rgba(20,14,10,.35)] rounded-[10px] p-[6px]" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21s-7.5-4.7-10-9.3C.6 8.6 2.4 5 5.7 5c2 0 3.4 1 4.3 2.5h4C14.9 6 16.3 5 18.3 5c3.3 0 5.1 3.6 3.7 6.7C19.5 16.3 12 21 12 21Z"/></svg>
                                        </div>
                                        <div class="flex flex-col pt-3 px-[6px] pb-0">
                                            <h3 class="mt-0 mr-0 mb-2 ml-0 text-[19px] font-extrabold tracking-[-.01em]">{{ $feat ? (app()->getLocale() === 'ar' ? ($feat['title_ar'] ?? $feat['title']) : $feat['title']) : $fallbackFeat['title'] }}</h3>
                                            <div class="flex items-center gap-2">
                                                <span class="inline-flex items-center gap-1 text-[11.5px] font-bold text-muted bg-[#F3EDE3] rounded-[99px] py-1 px-[10px]">
                                                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>
                                                    {{ ($feat ?? $fallbackFeat)['minutes'] }} {{ __('site.phone_min') }}
                                                </span>
                                                <span class="inline-flex items-center gap-1 text-[11.5px] font-bold text-[#241D17] bg-[#FDF3E4] rounded-[99px] py-1 px-[10px]">★ {{ ($feat ?? $fallbackFeat)['rating'] }}</span>
                                            </div>
                                            <span class="mt-[10px] text-[12px] text-muted">
                                                {{ __('site.phone_really') }}
                                                <b class="block text-[26px] font-extrabold text-teal leading-[1.2]">{{ ($feat['really'] ?? null) !== null ? $feat['really'].__('site.phone_min') : ($feat ?? $fallbackFeat)['minutes'].__('site.phone_min') }}</b>
                                            </span>
                                            <span class="block text-center bg-orange text-white font-extrabold text-[15px] rounded-[999px] py-[13px] px-0 mt-[10px]">{{ __('site.phone_start') }}</span>
                                        </div>
                                    </div>

                                    <div class="flex items-baseline justify-between mt-4 mx-2 mb-[10px]">
                                        <b class="text-[16.5px] font-extrabold">{{ __('site.phone_quick') }}</b>
                                        <span class="text-[12.5px] font-bold text-orange-deep">{{ __('site.phone_see_all') }}</span>
                                    </div>
                                    <div class="flex gap-[10px] overflow-hidden">
                                        @foreach (($feat ? $rail : $fallbackRail) as $row)
                                            <div class="shrink-0 w-[150px] bg-white border border-hair rounded-[12px] overflow-hidden pb-[10px]">
                                                <img src="{{ $row['img'] }}" alt="" loading="lazy" class="w-full h-[88px] object-cover block">
                                                <b class="block text-[12.5px] leading-[1.3] pt-2 px-[9px] pb-[6px]">{{ \Illuminate\Support\Str::limit(app()->getLocale() === 'ar' ? ($row['title_ar'] ?? $row['title']) : $row['title'], 24) }}</b>
                                                <span class="inline-flex items-center gap-1 text-[10.5px] font-bold text-muted bg-[#F3EDE3] rounded-[99px] py-[3px] px-2 mt-0 mr-[3px] mb-[3px] ml-[9px]">
                                                    <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>
                                                    {{ $row['minutes'] }} {{ __('site.phone_min') }}
                                                </span>
                                            </div>
                                        @endforeach
                                    </div>
                                </div>

                                <div class="shrink-0 flex border-t border-hair bg-[#FDFBF7] pt-[9px] px-2 pb-1">
                                    <span class="flex-1 flex flex-col items-center gap-[3px] text-[10px] font-bold text-orange-deep">
                                        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="m3 10.5 9-7.5 9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1v-9.5Z"/></svg>
                                        {{ __('site.phone_home') }}
                                    </span>
                                    <span class="flex-1 flex flex-col items-center gap-[3px] text-[10px] font-bold text-faint">
                                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
                                        {{ __('site.phone_browse') }}
                                    </span>
                                    <span class="flex-1 flex flex-col items-center gap-[3px] text-[10px] font-bold text-faint">
                                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21s-7.5-4.7-10-9.3C.6 8.6 2.4 5 5.7 5c2 0 3.4 1 4.3 2.5h4C14.9 6 16.3 5 18.3 5c3.3 0 5.1 3.6 3.7 6.7C19.5 16.3 12 21 12 21Z"/></svg>
                                        {{ __('site.phone_favorites') }}
                                    </span>
                                    <span class="flex-1 flex flex-col items-center gap-[3px] text-[10px] font-bold text-faint">
                                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="8" r="3.2"/><path d="M2.5 19c1.2-2.8 3.6-4.2 6.5-4.2s5.3 1.4 6.5 4.2"/><circle cx="17" cy="9" r="2.6"/><path d="M16.5 14.6c2.4.2 4.2 1.5 5 3.9"/></svg>
                                        {{ __('site.phone_community') }}
                                    </span>
                                    <span class="flex-1 flex flex-col items-center gap-[3px] text-[10px] font-bold text-faint">
                                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="3"/><path d="M19 12a7 7 0 0 0-.14-1.4l2-1.55-2-3.46-2.35.95a7 7 0 0 0-2.42-1.4L13.7 2.6h-3.4l-.4 2.54a7 7 0 0 0-2.4 1.4l-2.36-.94-2 3.45 2 1.55A7 7 0 0 0 5 12c0 .48.05.94.14 1.4l-2 1.55 2 3.46 2.35-.95a7 7 0 0 0 2.42 1.4l.39 2.54h3.4l.4-2.54a7 7 0 0 0 2.4-1.4l2.36.95 2-3.45-2-1.55c.09-.46.14-.92.14-1.4Z"/></svg>
                                        {{ __('site.phone_settings') }}
                                    </span>
                                </div>
                                <div class="shrink-0 w-[120px] h-[5px] rounded-[99px] bg-[rgba(36,29,23,.85)] mt-[5px] mb-2 mx-auto" aria-hidden="true"></div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </header>

        <section class="bg-white border-y border-hair py-[64px]" id="features" aria-label="{{ __('site.features_label') }}">
            <div class="mx-auto max-w-[1160px] px-7">
                <div class="grid grid-cols-4 max-[980px]:grid-cols-2 max-[980px]:gap-y-[34px] max-[980px]:gap-x-0 max-[520px]:grid-cols-1">
                    <div class="text-center pt-[10px] px-[30px] pb-[10px] border-s border-hair first:border-s-0 max-[980px]:[&:nth-child(3)]:border-s-0 max-[520px]:border-s-0 max-[520px]:pt-1 max-[520px]:pb-1 max-[520px]:px-2">
                        <span class="w-[62px] h-[62px] rounded-[99px] bg-orange-soft text-orange-deep inline-flex items-center justify-center mb-4">
                            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>
                        </span>
                        <h3 class="mt-0 mr-0 mb-2 ml-0 text-[17.5px] font-extrabold tracking-[-.005em]">{{ __('site.feat1_t') }}</h3>
                        <p class="mt-0 mr-0 mb-0 ml-0 text-[14.5px] text-muted leading-[1.6]">{{ __('site.feat1_d') }}</p>
                    </div>
                    <div class="text-center pt-[10px] px-[30px] pb-[10px] border-s border-hair first:border-s-0 max-[980px]:[&:nth-child(3)]:border-s-0 max-[520px]:border-s-0 max-[520px]:pt-1 max-[520px]:pb-1 max-[520px]:px-2">
                        <span class="w-[62px] h-[62px] rounded-[99px] bg-orange-soft text-orange-deep inline-flex items-center justify-center mb-4">
                            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4.5 12.5 3.6 9.2a3.4 3.4 0 0 1 4.6-4l1 .4a4.6 4.6 0 0 1 5.6 0l1-.4a3.4 3.4 0 0 1 4.6 4l-.9 3.3"/><path d="M4.5 12.5h15v2.6a3 3 0 0 1-3 3h-9a3 3 0 0 1-3-3v-2.6Z"/><path d="M12 3.5v2"/></svg>
                        </span>
                        <h3 class="mt-0 mr-0 mb-2 ml-0 text-[17.5px] font-extrabold tracking-[-.005em]">{{ __('site.feat2_t') }}</h3>
                        <p class="mt-0 mr-0 mb-0 ml-0 text-[14.5px] text-muted leading-[1.6]">{{ __('site.feat2_d') }}</p>
                    </div>
                    <div class="text-center pt-[10px] px-[30px] pb-[10px] border-s border-hair first:border-s-0 max-[980px]:[&:nth-child(3)]:border-s-0 max-[520px]:border-s-0 max-[520px]:pt-1 max-[520px]:pb-1 max-[520px]:px-2">
                        <span class="w-[62px] h-[62px] rounded-[99px] bg-orange-soft text-orange-deep inline-flex items-center justify-center mb-4">
                            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 4h8a2 2 0 0 1 2 2v14l-6-3-6 3V6a2 2 0 0 1 2-2Z"/><path d="M9.5 9.5h5"/><path d="M9.5 13h3"/></svg>
                        </span>
                        <h3 class="mt-0 mr-0 mb-2 ml-0 text-[17.5px] font-extrabold tracking-[-.005em]">{{ __('site.feat3_t') }}</h3>
                        <p class="mt-0 mr-0 mb-0 ml-0 text-[14.5px] text-muted leading-[1.6]">{{ __('site.feat3_d') }}</p>
                    </div>
                    <div class="text-center pt-[10px] px-[30px] pb-[10px] border-s border-hair first:border-s-0 max-[980px]:[&:nth-child(3)]:border-s-0 max-[520px]:border-s-0 max-[520px]:pt-1 max-[520px]:pb-1 max-[520px]:px-2">
                        <span class="w-[62px] h-[62px] rounded-[99px] bg-orange-soft text-orange-deep inline-flex items-center justify-center mb-4">
                            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 20h16"/><path d="M6.5 20v-6"/><path d="M11.5 20V9"/><path d="M16.5 20v-8.5"/><path d="M21 20V4.5"/></svg>
                        </span>
                        <h3 class="mt-0 mr-0 mb-2 ml-0 text-[17.5px] font-extrabold tracking-[-.005em]">{{ __('site.feat4_t') }}</h3>
                        <p class="mt-0 mr-0 mb-0 ml-0 text-[14.5px] text-muted leading-[1.6]">{{ __('site.feat4_d') }}</p>
                    </div>
                </div>
            </div>
        </section>

        <section class="bg-cream py-[86px]" id="how">
            <div class="mx-auto max-w-[1160px] px-7">
                <div class="text-center max-w-[640px] mx-auto mt-0 mr-auto mb-[52px] ml-auto">
                    <h2 class="font-display font-[640] [font-variation-settings:'opsz'_30] text-[clamp(1.85rem,3.3vw,2.65rem)] leading-[1.14] tracking-[-.01em] mt-0 mr-0 mb-[10px] ml-0 text-balance">{{ __('site.how_title_a') }}<span class="text-orange">{{ __('site.how_title_em') }}</span> {{ __('site.how_title_b') }}</h2>
                    <div class="w-[54px] h-[5px] rounded-[99px] bg-orange mt-[14px] mx-auto" aria-hidden="true"></div>
                </div>
                <div class="grid grid-cols-5 gap-5 max-[1020px]:grid-cols-3 max-[1020px]:gap-y-[34px] max-[1020px]:gap-x-5 max-[640px]:grid-cols-2 max-[430px]:gap-x-3 max-[430px]:gap-y-6">
                    <div class="text-center relative px-[6px]">
                        <svg class="how-arrow absolute top-[34px] right-[-26px] w-[34px] h-3 max-[1020px]:hidden" viewBox="0 0 34 12" fill="none" aria-hidden="true"><path d="M1 6h26" stroke="#F26B1D" stroke-width="2.4" stroke-linecap="round" stroke-dasharray="1 7"/><path d="m27 1.5 6 4.5-6 4.5" stroke="#F26B1D" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>
                        <span class="w-[78px] h-[78px] mx-auto mb-4 rounded-[99px] bg-white text-orange-deep flex items-center justify-center shadow-[0_14px_30px_-18px_rgba(38,33,27,.35),inset_0_0_0_1px_#F3E7D6] max-[430px]:w-14 max-[430px]:h-14 max-[430px]:mb-2">
                            <svg class="max-[430px]:w-6 max-[430px]:h-6" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 6.5C10.4 5 8.2 4.5 5.5 4.5c-.8 0-1.5.7-1.5 1.5v11c0 .8.7 1.5 1.5 1.5 2.7 0 4.9.5 6.5 2 1.6-1.5 3.8-2 6.5-2 .8 0 1.5-.7 1.5-1.5v-11c0-.8-.7-1.5-1.5-1.5-2.7 0-4.9.5-6.5 2Z"/><path d="M12 6.5v14"/></svg>
                        </span>
                        <h3 class="mt-0 mr-0 mb-[6px] ml-0 text-[16.5px] font-extrabold max-[430px]:text-[14px]"><i class="not-italic text-orange-deep">1.</i> {{ __('site.how1_t') }}</h3>
                        <p class="mt-0 mr-auto mb-0 ml-auto text-[13.8px] text-muted leading-[1.55] max-w-[21em] max-[430px]:text-[12.5px]">{{ __('site.how1_d') }}</p>
                    </div>
                    <div class="text-center relative px-[6px]">
                        <svg class="how-arrow absolute top-[34px] right-[-26px] w-[34px] h-3 max-[1020px]:hidden" viewBox="0 0 34 12" fill="none" aria-hidden="true"><path d="M1 6h26" stroke="#F26B1D" stroke-width="2.4" stroke-linecap="round" stroke-dasharray="1 7"/><path d="m27 1.5 6 4.5-6 4.5" stroke="#F26B1D" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>
                        <span class="w-[78px] h-[78px] mx-auto mb-4 rounded-[99px] bg-white text-orange-deep flex items-center justify-center shadow-[0_14px_30px_-18px_rgba(38,33,27,.35),inset_0_0_0_1px_#F3E7D6] max-[430px]:w-14 max-[430px]:h-14 max-[430px]:mb-2">
                            <svg class="max-[430px]:w-6 max-[430px]:h-6" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 7h16"/><path d="M4 12h16"/><path d="M4 17h10"/><circle cx="19" cy="17" r="2.4"/></svg>
                        </span>
                        <h3 class="mt-0 mr-0 mb-[6px] ml-0 text-[16.5px] font-extrabold max-[430px]:text-[14px]"><i class="not-italic text-orange-deep">2.</i> {{ __('site.how2_t') }}</h3>
                        <p class="mt-0 mr-auto mb-0 ml-auto text-[13.8px] text-muted leading-[1.55] max-w-[21em] max-[430px]:text-[12.5px]">{{ __('site.how2_d') }}</p>
                    </div>
                    <div class="text-center relative px-[6px]">
                        <svg class="how-arrow absolute top-[34px] right-[-26px] w-[34px] h-3 max-[1020px]:hidden" viewBox="0 0 34 12" fill="none" aria-hidden="true"><path d="M1 6h26" stroke="#F26B1D" stroke-width="2.4" stroke-linecap="round" stroke-dasharray="1 7"/><path d="m27 1.5 6 4.5-6 4.5" stroke="#F26B1D" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>
                        <span class="w-[78px] h-[78px] mx-auto mb-4 rounded-[99px] bg-white text-orange-deep flex items-center justify-center shadow-[0_14px_30px_-18px_rgba(38,33,27,.35),inset_0_0_0_1px_#F3E7D6] max-[430px]:w-14 max-[430px]:h-14 max-[430px]:mb-2">
                            <svg class="max-[430px]:w-6 max-[430px]:h-6" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="13" r="8"/><path d="M12 9.5V13l2.5 2"/><path d="M9.5 2.5h5"/><path d="m18.5 4.5 1.5 1.5"/><path d="m5.5 4.5 -1.5 1.5"/></svg>
                        </span>
                        <h3 class="mt-0 mr-0 mb-[6px] ml-0 text-[16.5px] font-extrabold max-[430px]:text-[14px]"><i class="not-italic text-orange-deep">3.</i> {{ __('site.how3_t') }}</h3>
                        <p class="mt-0 mr-auto mb-0 ml-auto text-[13.8px] text-muted leading-[1.55] max-w-[21em] max-[430px]:text-[12.5px]">{{ __('site.how3_d') }}</p>
                    </div>
                    <div class="text-center relative px-[6px]">
                        <svg class="how-arrow absolute top-[34px] right-[-26px] w-[34px] h-3 max-[1020px]:hidden" viewBox="0 0 34 12" fill="none" aria-hidden="true"><path d="M1 6h26" stroke="#F26B1D" stroke-width="2.4" stroke-linecap="round" stroke-dasharray="1 7"/><path d="m27 1.5 6 4.5-6 4.5" stroke="#F26B1D" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>
                        <span class="w-[78px] h-[78px] mx-auto mb-4 rounded-[99px] bg-white text-orange-deep flex items-center justify-center shadow-[0_14px_30px_-18px_rgba(38,33,27,.35),inset_0_0_0_1px_#F3E7D6] max-[430px]:w-14 max-[430px]:h-14 max-[430px]:mb-2">
                            <svg class="max-[430px]:w-6 max-[430px]:h-6" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 6h11a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2Z"/><path d="M8 2.5h11a2 2 0 0 1 2 2V17"/><path d="M8.5 12l2.5 2.5 4.5-4.5"/></svg>
                        </span>
                        <h3 class="mt-0 mr-0 mb-[6px] ml-0 text-[16.5px] font-extrabold max-[430px]:text-[14px]"><i class="not-italic text-orange-deep">4.</i> {{ __('site.how4_t') }}</h3>
                        <p class="mt-0 mr-auto mb-0 ml-auto text-[13.8px] text-muted leading-[1.55] max-w-[21em] max-[430px]:text-[12.5px]">{{ __('site.how4_d') }}</p>
                    </div>
                    <div class="text-center relative px-[6px]">
                        <span class="w-[78px] h-[78px] mx-auto mb-4 rounded-[99px] bg-white text-orange-deep flex items-center justify-center shadow-[0_14px_30px_-18px_rgba(38,33,27,.35),inset_0_0_0_1px_#F3E7D6] max-[430px]:w-14 max-[430px]:h-14 max-[430px]:mb-2">
                            <svg class="max-[430px]:w-6 max-[430px]:h-6" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 12a8 8 0 1 1-2.34-5.66"/><path d="M20 3v4h-4"/></svg>
                        </span>
                        <h3 class="mt-0 mr-0 mb-[6px] ml-0 text-[16.5px] font-extrabold max-[430px]:text-[14px]"><i class="not-italic text-orange-deep">5.</i> {{ __('site.how5_t') }}</h3>
                        <p class="mt-0 mr-auto mb-0 ml-auto text-[13.8px] text-muted leading-[1.55] max-w-[21em] max-[430px]:text-[12.5px]">{{ __('site.how5_d') }}</p>
                    </div>
                </div>
            </div>
        </section>

        <section class="bg-white py-[86px]" id="recipes">
            <div class="mx-auto max-w-[1240px] px-7">
                <div class="text-center mx-auto mt-0 mr-auto mb-10 ml-auto max-w-none flex items-baseline justify-between gap-4 relative max-[640px]:flex-col max-[640px]:gap-[6px]">
                    <div class="text-center max-w-[640px] mx-auto mt-0 mr-0 mb-0 ml-0">
                        <h2 class="font-display font-[640] [font-variation-settings:'opsz'_30] text-[clamp(1.85rem,3.3vw,2.65rem)] leading-[1.14] tracking-[-.01em] mt-0 mr-0 mb-[10px] ml-0 text-balance">{{ __('site.pop_title') }}</h2>
                        <div class="w-[54px] h-[5px] rounded-[99px] bg-orange mt-[14px] mx-auto" aria-hidden="true"></div>
                    </div>
                    <a class="text-[14.5px] font-bold text-orange-deep no-underline whitespace-nowrap absolute end-0 top-[14px] hover:text-orange max-[640px]:static focus-visible:outline-[2.5px] focus-visible:outline-orange focus-visible:outline-offset-[3px] focus-visible:rounded-[4px]" href="{{ route('app.download') }}" title="{{ __('site.pop_view_all_title') }}">
                        {{ __('site.pop_view_all') }}
                        <svg class="inline flip-rtl" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="vertical-align:-2px"><path d="M4 12h15"/><path d="m13 6 6 6-6 6"/></svg>
                    </a>
                </div>
                <div class="grid grid-cols-5 gap-[18px] max-[1080px]:grid-cols-3 max-[700px]:grid-cols-2">
                    @if (count($popular) > 0)
                        @foreach ($popular as $row)
                            <a class="bg-white border border-hair rounded-[18px] overflow-hidden no-underline flex flex-col shadow-[0_12px_28px_-22px_rgba(38,33,27,.4)] transition-[translate,box-shadow] duration-[.16s] [transition-timing-function:ease] hover:translate-y-[-4px] hover:shadow-[0_22px_40px_-24px_rgba(38,33,27,.5)] focus-visible:outline-[2.5px] focus-visible:outline-orange focus-visible:outline-offset-[3px] focus-visible:rounded-[4px] max-[700px]:last:hidden" href="/r/{{ $row['id'] }}">
                                <img src="{{ $row['img'] }}" alt="{{ app()->getLocale() === 'ar' ? ($row['title_ar'] ?? $row['title']) : $row['title'] }}" loading="lazy" class="w-full aspect-[4/3] object-cover block">
                                <span class="pt-[13px] px-[14px] pb-[14px] flex flex-col gap-[9px]">
                                    <h3 class="mt-0 mr-0 mb-0 ml-0 text-[15.5px] font-extrabold tracking-[-.005em] whitespace-nowrap overflow-hidden text-ellipsis max-[700px]:whitespace-normal max-[700px]:line-clamp-2 max-[700px]:leading-[1.3]">{{ app()->getLocale() === 'ar' ? ($row['title_ar'] ?? $row['title']) : $row['title'] }}</h3>
                                    <span class="flex items-center justify-between gap-2 text-[13px] font-bold text-muted">
                                        <span class="inline-flex items-center gap-[5px]">
                                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>
                                            {{ $row['minutes'] }} {{ __('site.phone_min') }}
                                        </span>
                                        <span class="inline-flex items-center gap-1 text-ink">
                                            <svg class="text-orange" width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="m12 2.5 2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4l-5.9 3.1 1.2-6.5L2.5 9.4l6.6-.9 2.9-6Z"/></svg>
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
                            <a class="bg-white border border-hair rounded-[18px] overflow-hidden no-underline flex flex-col shadow-[0_12px_28px_-22px_rgba(38,33,27,.4)] transition-[translate,box-shadow] duration-[.16s] [transition-timing-function:ease] hover:translate-y-[-4px] hover:shadow-[0_22px_40px_-24px_rgba(38,33,27,.5)] focus-visible:outline-[2.5px] focus-visible:outline-orange focus-visible:outline-offset-[3px] focus-visible:rounded-[4px] max-[700px]:last:hidden" href="{{ route('app.download') }}" title="{{ __('site.pop_fallback_title') }}">
                                <img src="{{ $row['img'] }}" alt="{{ $row['title'] }}" loading="lazy" class="w-full aspect-[4/3] object-cover block">
                                <span class="pt-[13px] px-[14px] pb-[14px] flex flex-col gap-[9px]">
                                    <h3 class="mt-0 mr-0 mb-0 ml-0 text-[15.5px] font-extrabold tracking-[-.005em] whitespace-nowrap overflow-hidden text-ellipsis max-[700px]:whitespace-normal max-[700px]:line-clamp-2 max-[700px]:leading-[1.3]">{{ $row['title'] }}</h3>
                                    <span class="flex items-center justify-between gap-2 text-[13px] font-bold text-muted">
                                        <span class="inline-flex items-center gap-[5px]">
                                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>
                                            {{ $row['minutes'] }} {{ __('site.phone_min') }}
                                        </span>
                                        <span class="inline-flex items-center gap-1 text-ink">
                                            <svg class="text-orange" width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="m12 2.5 2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4l-5.9 3.1 1.2-6.5L2.5 9.4l6.6-.9 2.9-6Z"/></svg>
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

        <section class="bg-dark text-white overflow-hidden py-[86px]" id="download">
            <div class="mx-auto max-w-[1160px] px-7 grid grid-cols-[.92fr_1.08fr] gap-10 items-center max-[980px]:grid-cols-1 max-[980px]:gap-[54px]">
                <div>
                    <h2 class="font-display font-[640] [font-variation-settings:'opsz'_30] text-[clamp(1.85rem,3.3vw,2.65rem)] leading-[1.14] tracking-[-.01em] mt-0 mr-0 mb-4 ml-0 text-balance text-white">{{ __('site.dl_title') }}</h2>
                    <p class="text-dark-muted text-[16.5px] max-w-[26em] mt-0 mr-0 mb-[30px] ml-0">
                        {{ __('site.dl_text') }}
                    </p>
                    <div class="flex flex-wrap gap-[13px] max-[980px]:flex-nowrap">
                        @isset($latestRelease)
                            <a class="inline-flex items-center gap-[11px] no-underline bg-[#0E1117] text-white border border-[#39404E] rounded-[12px] pt-[10px] pr-[20px] pb-[10px] pl-[16px] max-[980px]:pt-2 max-[980px]:pb-2 max-[980px]:pl-[11px] max-[980px]:pr-[13px] max-[980px]:gap-2 max-[359px]:pl-2 max-[359px]:pr-[9px] max-[359px]:gap-[6px] transition-[border-color,background-color] duration-[.16s] [transition-timing-function:ease] hover:border-[#5A6375] hover:bg-[#171C26] focus-visible:outline-[2.5px] focus-visible:outline-orange focus-visible:outline-offset-[3px] focus-visible:rounded-[4px]" href="{{ route('app.download') }}">
                                <svg class="shrink-0" width="25" height="25" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" aria-hidden="true"><path d="M5.5 18v-6.5a6.5 6.5 0 0 1 13 0V18Z" fill="currentColor" stroke-linejoin="round"/><path d="m8.6 4.2-1.3-2.1M15.4 4.2l1.3-2.1"/><circle cx="9.7" cy="10.4" r="1.1" fill="#0E1117" stroke="none"/><circle cx="14.3" cy="10.4" r="1.1" fill="#0E1117" stroke="none"/></svg>
                                <span><small class="block text-[10.5px] font-semibold tracking-[.06em] uppercase text-[#AEB5C2] leading-[1.3] max-[980px]:text-[9px] max-[980px]:tracking-[.04em] max-[359px]:text-[8px]">{{ __('site.dl_on') }}</small><b class="block text-[16.5px] font-bold leading-[1.25] max-[980px]:text-[14.5px] max-[359px]:text-[13px]">{{ __('site.dl_android') }}</b></span>
                            </a>
                        @else
                            <span class="inline-flex items-center gap-[11px] no-underline bg-[#0E1117] text-white border border-[#39404E] rounded-[12px] pt-[10px] pr-[20px] pb-[10px] pl-[16px] max-[980px]:pt-2 max-[980px]:pb-2 max-[980px]:pl-[11px] max-[980px]:pr-[13px] max-[980px]:gap-2 max-[359px]:pl-2 max-[359px]:pr-[9px] max-[359px]:gap-[6px] transition-[border-color,background-color] duration-[.16s] [transition-timing-function:ease] hover:border-[#5A6375] hover:bg-[#171C26]" aria-disabled="true">
                                <svg class="shrink-0" width="25" height="25" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" aria-hidden="true"><path d="M5.5 18v-6.5a6.5 6.5 0 0 1 13 0V18Z" fill="currentColor" stroke-linejoin="round"/><path d="m8.6 4.2-1.3-2.1M15.4 4.2l1.3-2.1"/><circle cx="9.7" cy="10.4" r="1.1" fill="#0E1117" stroke="none"/><circle cx="14.3" cy="10.4" r="1.1" fill="#0E1117" stroke="none"/></svg>
                                <span><small class="block text-[10.5px] font-semibold tracking-[.06em] uppercase text-[#AEB5C2] leading-[1.3] max-[980px]:text-[9px] max-[980px]:tracking-[.04em] max-[359px]:text-[8px]">{{ __('site.dl_on') }}</small><b class="block text-[16.5px] font-bold leading-[1.25] max-[980px]:text-[14.5px] max-[359px]:text-[13px]">{{ __('site.dl_android') }}</b></span>
                            </span>
                        @endisset
                        <span class="inline-flex items-center gap-[11px] no-underline bg-[#0E1117] text-white border border-[#39404E] rounded-[12px] pt-[10px] pr-[20px] pb-[10px] pl-[16px] max-[980px]:pt-2 max-[980px]:pb-2 max-[980px]:pl-[11px] max-[980px]:pr-[13px] max-[980px]:gap-2 max-[359px]:pl-2 max-[359px]:pr-[9px] max-[359px]:gap-[6px] transition-[border-color,background-color] duration-[.16s] [transition-timing-function:ease] hover:border-[#5A6375] hover:bg-[#171C26] opacity-[.62]" aria-disabled="true" title="{{ __('site.dl_ios_title') }}">
                            <svg class="shrink-0" width="26" height="26" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M17.05 12.54c-.03-2.89 2.36-4.27 2.47-4.34-1.35-1.97-3.44-2.24-4.18-2.27-1.78-.18-3.47 1.05-4.37 1.05-.9 0-2.29-1.02-3.77-1-1.94.03-3.72 1.13-4.72 2.86-2.01 3.49-.51 8.66 1.45 11.49.96 1.39 2.11 2.95 3.62 2.89 1.45-.06 2-.94 3.75-.94s2.25.94 3.78.91c1.56-.03 2.55-1.42 3.5-2.81 1.1-1.61 1.56-3.17 1.58-3.25-.03-.02-3.06-1.17-3.11-4.59ZM14.16 4.06c.8-.97 1.34-2.32 1.19-3.66-1.15.05-2.55.77-3.38 1.73-.74.86-1.39 2.23-1.22 3.55 1.29.1 2.6-.65 3.41-1.62Z"/></svg>
                            <span><small class="block text-[10.5px] font-semibold tracking-[.06em] uppercase text-[#AEB5C2] leading-[1.3] max-[980px]:text-[9px] max-[980px]:tracking-[.04em] max-[359px]:text-[8px]">{{ __('site.dl_on') }}</small><b class="block text-[16.5px] font-bold leading-[1.25] max-[980px]:text-[14.5px] max-[359px]:text-[13px]">{{ __('site.dl_ios') }}<span class="font-semibold text-[#8B93A3]"> {{ __('site.dl_soon') }}</span></b></span>
                        </span>
                    </div>
                    <p class="mt-[18px] mb-0 text-[13px] text-[#8B93A3]">
                        @isset($latestRelease)
                            {{ __('site.dl_version') }} <b class="text-[#D6DBE4] font-bold">{{ $latestRelease->version }}</b>
                            &nbsp;·&nbsp; {{ $latestRelease->humanSize() }}
                            &nbsp;·&nbsp; {{ __('site.dl_meta') }}
                        @else
                            {{ __('site.dl_first') }}
                        @endisset
                    </p>
                </div>

                {{-- Three representative app screens: real mechanisms
                    (Cook Mode stopwatch, claim-vs-reality card, community
                    "try"), styled like the app. Not live UI. --}}
                <div id="phones" class="relative h-[560px] max-[980px]:hidden" aria-label="{{ __('site.pm_phones_label') }}">
                    <div class="absolute w-[226px] h-[470px] bg-[#0B0D12] rounded-[34px] p-[7px] shadow-[0_34px_70px_-28px_rgba(0,0,0,.8),inset_0_0_0_1.5px_#000] left-0 top-[60px] rotate-[-5deg] z-[1] max-[980px]:static max-[980px]:translate-x-0 max-[980px]:rotate-0 max-[980px]:scale-100 max-[980px]:shrink-0 max-[980px]:[scroll-snap-align:center]" role="img" aria-label="{{ __('site.pm_cook_label') }}">
                        <div class="bg-[#FDFBF7] rounded-[27px] overflow-hidden text-[#241D17] pt-5 px-[13px] pb-[14px] h-full flex flex-col">
                            <span class="absolute top-[9px] left-1/2 translate-x-[-50%] w-16 h-[6px] rounded-[99px] bg-[#0B0D12]" aria-hidden="true"></span>
                            <p class="text-[10px] font-extrabold tracking-[.12em] uppercase text-faint mt-0 mr-0 mb-[10px] ml-0">{{ __('site.pm_cook') }}</p>
                            <span class="inline-block text-[10.5px] font-extrabold text-orange-deep bg-orange-soft rounded-[99px] py-[3px] px-[9px] mb-2">{{ __('site.pm_step') }}</span>
                            <p class="text-[16px] font-extrabold tracking-[-.01em] mt-0 mr-0 mb-3 ml-0">{{ __('site.pm_dish') }}</p>
                            <p class="font-mono tabular-nums text-[34px] font-bold tracking-[.01em] text-center mt-[2px] mr-0 mb-[10px] ml-0">02:30</p>
                            <div class="h-[7px] rounded-[99px] bg-[#F3EDE3] overflow-hidden mb-3"><i class="block h-full w-[62%] rounded-[99px] bg-[linear-gradient(90deg,#F26B1D,#F79A5C)]"></i></div>
                            <div class="flex gap-2">
                                <span class="flex-1 text-center text-[11.5px] font-extrabold rounded-[99px] py-[9px] px-0 bg-orange text-white"><svg class="inline" width="10" height="10" viewBox="0 0 24 24" fill="currentColor" style="vertical-align:-1px" aria-hidden="true"><path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z"/></svg> {{ __('site.pm_pause') }}</span>
                                <span class="flex-1 text-center text-[11.5px] font-extrabold rounded-[99px] py-[9px] px-0 bg-[#F3EDE3] text-muted">{{ __('site.pm_skip') }}</span>
                            </div>
                        </div>
                    </div>
                    <div class="absolute w-[240px] h-[500px] bg-[#0B0D12] rounded-[34px] p-[7px] shadow-[0_34px_70px_-28px_rgba(0,0,0,.8),inset_0_0_0_1.5px_#000] left-1/2 top-4 translate-x-[-50%] scale-[1.06] z-[3] max-[980px]:static max-[980px]:translate-x-0 max-[980px]:scale-100 max-[980px]:shrink-0 max-[980px]:[scroll-snap-align:center]" role="img" aria-label="{{ __('site.pm_claim_label') }}">
                        <div class="bg-[#FDFBF7] rounded-[27px] overflow-hidden text-[#241D17] pt-5 px-[13px] pb-[14px] h-full flex flex-col">
                            <span class="absolute top-[9px] left-1/2 translate-x-[-50%] w-16 h-[6px] rounded-[99px] bg-[#0B0D12]" aria-hidden="true"></span>
                            <div class="bg-white border border-hair rounded-[14px] overflow-hidden mb-[10px] shadow-[0_10px_22px_-18px_rgba(38,33,27,.4)]">
                                <img src="/img/landing/card-biryani.jpg" alt="" loading="lazy" class="w-full h-[96px] object-cover block">
                                <div class="pt-[10px] pr-[11px] pb-[11px] pl-[11px]">
                                    <h4 class="mt-0 mr-0 mb-[7px] ml-0 text-[14.5px] font-extrabold">Chicken Biryani</h4>
                                    <span class="text-[11.5px] font-bold text-faint">{{ __('site.pm_claim') }} <s class="[text-decoration-color:#F26B1D] [text-decoration-thickness:1.5px]">60 {{ __('site.phone_min') }}</s></span>
                                    <span class="text-[22px] font-extrabold text-teal leading-[1.25]">{{ __('site.pm_really') }} 74{{ __('site.phone_min') }}</span>
                                </div>
                            </div>
                            <p class="text-[11px] text-muted leading-[1.5] mt-0 mr-0 mb-3 ml-0">{{ __('site.pm_measured') }}</p>
                            <span class="block text-center bg-orange text-white text-[12px] font-extrabold rounded-[99px] py-[10px] px-0 mt-auto">{{ __('site.pm_start') }}</span>
                        </div>
                    </div>
                    <div class="absolute w-[226px] h-[470px] bg-[#0B0D12] rounded-[34px] p-[7px] shadow-[0_34px_70px_-28px_rgba(0,0,0,.8),inset_0_0_0_1.5px_#000] right-0 top-[60px] rotate-[5deg] z-[2] max-[980px]:static max-[980px]:rotate-0 max-[980px]:shrink-0 max-[980px]:[scroll-snap-align:center]" role="img" aria-label="{{ __('site.pm_community_label') }}">
                        <div class="bg-[#FDFBF7] rounded-[27px] overflow-hidden text-[#241D17] pt-5 px-[13px] pb-[14px] h-full flex flex-col">
                            <span class="absolute top-[9px] left-1/2 translate-x-[-50%] w-16 h-[6px] rounded-[99px] bg-[#0B0D12]" aria-hidden="true"></span>
                            <p class="text-[10px] font-extrabold tracking-[.12em] uppercase text-faint mt-0 mr-0 mb-[10px] ml-0">{{ __('site.pm_community') }}</p>
                            <div class="flex items-center gap-[9px] mt-0 mr-0 mb-3 ml-0">
                                <span class="w-[34px] h-[34px] rounded-[99px] bg-[#C96F4A] text-white inline-flex items-center justify-center text-[12px] font-extrabold shrink-0">A</span>
                                <span><b class="block text-[12.5px] leading-[1.25]">{{ __('site.pm_shared') }}</b><span class="text-[10.5px] text-faint">{{ __('site.pm_shared_sub') }}</span></span>
                            </div>
                            <div class="flex items-end gap-[7px] h-[74px] mt-1 mr-0 mb-[6px] ml-0" aria-hidden="true">
                                <i class="flex-1 rounded-t-[6px] rounded-b-[3px] bg-[#F3E7D6]" style="height:34%"></i><i class="flex-1 rounded-t-[6px] rounded-b-[3px] bg-[#F3E7D6]" style="height:52%"></i><i class="flex-1 rounded-t-[6px] rounded-b-[3px] bg-[linear-gradient(180deg,#F79A5C,#F26B1D)]" style="height:88%"></i><i class="flex-1 rounded-t-[6px] rounded-b-[3px] bg-[#F3E7D6]" style="height:46%"></i><i class="flex-1 rounded-t-[6px] rounded-b-[3px] bg-[#F3E7D6]" style="height:64%"></i>
                            </div>
                            <div class="flex justify-between text-[8.5px] font-bold tracking-[.06em] uppercase text-faint mb-3"><span>{{ __('site.pm_claim_axis') }}</span><span>{{ __('site.pm_pace_axis') }}</span></div>
                            <p class="text-[11px] text-muted leading-[1.5] mt-0 mr-0 mb-3 ml-0">{{ __('site.pm_quote') }}</p>
                            <span class="block text-center bg-orange text-white text-[12px] font-extrabold rounded-[99px] py-[10px] px-0 mt-auto">{{ __('site.pm_read') }}</span>
                        </div>
                    </div>
                </div>
            </div>
        </section>

        <section class="bg-orange text-white relative overflow-hidden py-[74px]">
            <div class="cta-side-l absolute top-0 bottom-0 w-[460px] overflow-hidden pointer-events-none hidden min-[1220px]:block left-0" aria-hidden="true">
                <img src="/img/hero-dish.jpg" alt="" loading="lazy" class="w-full h-full object-cover">
                <div class="cta-fade-l absolute inset-0 bg-[linear-gradient(90deg,rgba(242,107,29,.12)_0%,rgba(242,107,29,.35)_34%,rgba(242,107,29,.78)_68%,#F26B1D_100%)]" aria-hidden="true"></div>
            </div>
            <div class="cta-side-r absolute top-0 bottom-0 w-[460px] overflow-hidden pointer-events-none hidden min-[1220px]:block right-0" aria-hidden="true">
                <img src="/img/landing/card-pizza.jpg" alt="" loading="lazy" class="w-full h-full object-cover">
                <div class="cta-fade-r absolute inset-0 bg-[linear-gradient(270deg,rgba(242,107,29,.12)_0%,rgba(242,107,29,.35)_34%,rgba(242,107,29,.78)_68%,#F26B1D_100%)]" aria-hidden="true"></div>
            </div>
            <div class="mx-auto max-w-[1160px] px-7">
                <div class="relative text-center max-w-[620px] mx-auto">
                    <h2 class="font-display font-[640] [font-variation-settings:'opsz'_30] text-[clamp(1.9rem,3.6vw,2.8rem)] leading-[1.14] tracking-[-.01em] mt-0 mr-0 mb-[10px] ml-0 text-balance text-white">{{ __('site.cta_title') }}</h2>
                    <p class="mt-0 mr-0 mb-7 ml-0 text-[#FFE3CE] text-[16px]">{{ __('site.cta_text') }}</p>
                    {{-- Placeholder wiring: there is no email backend yet —
                        the button routes to the APK download. --}}
                    <form class="flex gap-[10px] bg-white rounded-[999px] p-[7px] max-w-[480px] mx-auto shadow-[0_20px_44px_-20px_rgba(112,40,0,.5)] max-[480px]:flex-col max-[480px]:rounded-[24px] max-[480px]:p-[10px]" action="{{ route('app.download') }}" method="get">
                        <input type="email" name="email" placeholder="{{ __('site.cta_email_ph') }}" aria-label="{{ __('site.cta_email_label') }}" class="flex-1 min-w-0 border border-[#E8DFD2] rounded-[14px] outline-none bg-transparent pt-[10px] pr-[10px] pb-[10px] pl-[18px] text-[15px] text-ink caret-orange placeholder:text-muted max-[480px]:pt-[10px] max-[480px]:pr-3 max-[480px]:pb-[10px] max-[480px]:pl-3 max-[480px]:text-center focus-visible:outline-[2.5px] focus-visible:outline-orange focus-visible:outline-offset-[3px] focus-visible:rounded-[4px]">
                        <button class="inline-flex items-center justify-center gap-[10px] rounded-[999px] font-bold tracking-[.005em] no-underline border border-transparent cursor-pointer transition duration-[.16s] [transition-timing-function:ease] active:translate-y-[1px] focus-visible:outline-[2.5px] focus-visible:outline-orange focus-visible:outline-offset-[3px] focus-visible:rounded-[4px] py-3 px-6 text-[14.5px] leading-[normal] shrink-0 bg-dark text-white hover:bg-[#2E3545]" type="submit">{{ __('site.cta_btn') }}</button>
                    </form>
                </div>
            </div>
        </section>

        {{-- site-footer partial, inlined + converted --}}
        <footer class="bg-dark-2 text-dark-muted pt-[62px] pb-[34px]">
            <div class="mx-auto max-w-[1160px] px-7">
                <div class="grid grid-cols-[1.5fr_1fr_1fr_1fr] gap-[34px] max-[940px]:grid-cols-2 max-[480px]:grid-cols-1">
                    <div>
                        <a class="flex items-center gap-[10px] no-underline focus-visible:outline-[2.5px] focus-visible:outline-orange focus-visible:outline-offset-[3px] focus-visible:rounded-[4px]" href="{{ url('/') }}">
                            <img class="w-[34px] h-[34px] object-contain" src="/img/recipereallogo.webp" alt="" width="34" height="34">
                            <b class="font-body font-extrabold text-[23px] tracking-[-.01em] text-white">Recipe<em class="not-italic text-orange">Real</em></b>
                        </a>
                        <p class="mt-[14px] mr-0 mb-0 ml-0 text-[14px] leading-[1.65] max-w-[15em]">{{ __('site.foot_tag') }}</p>
                    </div>
                    <nav aria-label="{{ __('site.foot_explore') }}">
                        <h4 class="mt-1 mr-0 mb-4 ml-0 text-[13px] font-extrabold tracking-[.1em] uppercase text-white">{{ __('site.foot_explore') }}</h4>
                        <a class="block no-underline text-[14px] text-dark-muted py-[4.5px] px-0 hover:text-white focus-visible:outline-[2.5px] focus-visible:outline-orange focus-visible:outline-offset-[3px] focus-visible:rounded-[4px]" href="#recipes">{{ __('site.nav_recipes') }}</a>
                        <a class="block no-underline text-[14px] text-dark-muted py-[4.5px] px-0 hover:text-white focus-visible:outline-[2.5px] focus-visible:outline-orange focus-visible:outline-offset-[3px] focus-visible:rounded-[4px]" href="#how">{{ __('site.nav_how') }}</a>
                        <a class="block no-underline text-[14px] text-dark-muted py-[4.5px] px-0 hover:text-white focus-visible:outline-[2.5px] focus-visible:outline-orange focus-visible:outline-offset-[3px] focus-visible:rounded-[4px]" href="#features">{{ __('site.nav_features') }}</a>
                        <a class="block no-underline text-[14px] text-dark-muted py-[4.5px] px-0 hover:text-white focus-visible:outline-[2.5px] focus-visible:outline-orange focus-visible:outline-offset-[3px] focus-visible:rounded-[4px]" href="{{ route('pages.pricing') }}">{{ __('site.nav_pricing') }}</a>
                        <a class="block no-underline text-[14px] text-dark-muted py-[4.5px] px-0 hover:text-white focus-visible:outline-[2.5px] focus-visible:outline-orange focus-visible:outline-offset-[3px] focus-visible:rounded-[4px]" href="{{ route('pages.blog') }}">{{ __('site.foot_blog') }}</a>
                    </nav>
                    <nav aria-label="{{ __('site.foot_resources') }}">
                        <h4 class="mt-1 mr-0 mb-4 ml-0 text-[13px] font-extrabold tracking-[.1em] uppercase text-white">{{ __('site.foot_resources') }}</h4>
                        <a class="block no-underline text-[14px] text-dark-muted py-[4.5px] px-0 hover:text-white focus-visible:outline-[2.5px] focus-visible:outline-orange focus-visible:outline-offset-[3px] focus-visible:rounded-[4px]" href="{{ route('pages.tips') }}">{{ __('site.foot_tips') }}</a>
                        <a class="block no-underline text-[14px] text-dark-muted py-[4.5px] px-0 hover:text-white focus-visible:outline-[2.5px] focus-visible:outline-orange focus-visible:outline-offset-[3px] focus-visible:rounded-[4px]" href="{{ route('pages.help') }}">{{ __('site.foot_help') }}</a>
                        <a class="block no-underline text-[14px] text-dark-muted py-[4.5px] px-0 hover:text-white focus-visible:outline-[2.5px] focus-visible:outline-orange focus-visible:outline-offset-[3px] focus-visible:rounded-[4px]" href="{{ route('pages.contact') }}">{{ __('site.foot_contact') }}</a>
                        <a class="block no-underline text-[14px] text-dark-muted py-[4.5px] px-0 hover:text-white focus-visible:outline-[2.5px] focus-visible:outline-orange focus-visible:outline-offset-[3px] focus-visible:rounded-[4px]" href="{{ url('/privacy') }}">{{ __('site.foot_privacy') }}</a>
                        <a class="block no-underline text-[14px] text-dark-muted py-[4.5px] px-0 hover:text-white focus-visible:outline-[2.5px] focus-visible:outline-orange focus-visible:outline-offset-[3px] focus-visible:rounded-[4px]" href="{{ route('pages.terms') }}">{{ __('site.foot_terms') }}</a>
                    </nav>
                    <nav aria-label="{{ __('site.foot_company') }}">
                        <h4 class="mt-1 mr-0 mb-4 ml-0 text-[13px] font-extrabold tracking-[.1em] uppercase text-white">{{ __('site.foot_company') }}</h4>
                        <a class="block no-underline text-[14px] text-dark-muted py-[4.5px] px-0 hover:text-white focus-visible:outline-[2.5px] focus-visible:outline-orange focus-visible:outline-offset-[3px] focus-visible:rounded-[4px]" href="{{ route('pages.about') }}">{{ __('site.foot_about') }}</a>
                        <a class="block no-underline text-[14px] text-dark-muted py-[4.5px] px-0 hover:text-white focus-visible:outline-[2.5px] focus-visible:outline-orange focus-visible:outline-offset-[3px] focus-visible:rounded-[4px]" href="{{ route('pages.careers') }}">{{ __('site.foot_careers') }}</a>
                        <a class="block no-underline text-[14px] text-dark-muted py-[4.5px] px-0 hover:text-white focus-visible:outline-[2.5px] focus-visible:outline-orange focus-visible:outline-offset-[3px] focus-visible:rounded-[4px]" href="{{ route('pages.press') }}">{{ __('site.foot_press') }}</a>
                    </nav>
                </div>
                <div class="border-t border-[#2C3342] mt-[46px] pt-[22px] flex justify-between items-center gap-[10px] flex-wrap text-[13px] text-[#8B93A3]">
                    <span>© {{ date('Y') }} RecipeReal. {{ __('site.foot_rights') }}</span>
                    <span class="inline-flex items-center gap-3"><a class="text-inherit no-underline hover:text-white focus-visible:outline-[2.5px] focus-visible:outline-orange focus-visible:outline-offset-[3px] focus-visible:rounded-[4px]" href="{{ url('/privacy') }}">{{ __('site.foot_privacy_short') }}</a> @include('partials.lang-switcher')</span>
                </div>
            </div>
        </footer>

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
              "description": "{{ __('site.jsonld_desc') }}",
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

    </body>
</html>
