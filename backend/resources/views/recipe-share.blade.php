<!DOCTYPE html>
<html lang="{{ app()->getLocale() }}" dir="{{ app()->getLocale() === 'ar' ? 'rtl' : 'ltr' }}">
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
@php
    // Display figures: the claim (publisher) and the honest reality
    // (reality_minutes ?? community_avg — the same precedence the app's
    // "Really takes" stat uses; NO publisher fallback: when no reality
    // exists only the claim line renders).
    $claim   = $recipe->publisher_time_minutes !== null
        ? (int) round((float) $recipe->publisher_time_minutes)
        : null;
    $reality = ($recipe->reality_minutes ?? $recipe->community_avg_minutes) !== null
        ? (int) round((float) ($recipe->reality_minutes ?? $recipe->community_avg_minutes))
        : null;
    $steps = $recipe->steps_count !== null ? (int) $recipe->steps_count : null;

    $shareUrl   = url('/r/' . $recipe->id);
    // Device language first: Arabic visitors see the Arabic title when it
    // exists (and vice-versa); the other title still renders below.
    $pageTitle  = app()->getLocale() === 'ar'
        ? ($recipe->title_ar ?? $recipe->title ?? __('site.share_fallback_recipe'))
        : ($recipe->title ?? $recipe->title_ar ?? __('site.share_fallback_recipe'));
    $image      = $recipe->image_url;

    // og:description mirrors the badge + steps line, localized, e.g.
    // "Recipe says 25 min · Really takes 40 min · 12 steps".
    $descParts = [];
    if ($claim !== null) {
        $descParts[] = __('site.share_says')." {$claim} ".__('site.share_min');
    }
    if ($reality !== null) {
        $descParts[] = __('site.share_takes')." {$reality} ".__('site.share_min');
    }
    if ($steps !== null) {
        $descParts[] = "{$steps} ".($steps === 1 ? __('site.share_step') : __('site.share_steps'));
    }
    $description = implode(' · ', $descParts);

    // Attribution: imported rows keep the original Food.com recipe URL in
    // source_url; every share page also links the copyright/takedown page.
    $sourceUrl = trim((string) $recipe->source_url);
    $sourceHost = $sourceUrl !== '' ? (string) parse_url($sourceUrl, PHP_URL_HOST) : '';
    $sourceLabel = $sourceHost !== '' && str_contains($sourceHost, 'food.com')
        ? 'Food.com'
        : $sourceHost;
    if ($sourceLabel !== '') {
        // og:text can't carry a link — name the source instead, localized.
        $description .= app()->getLocale() === 'ar'
            ? ' · المصدر: '.$sourceLabel
            : ' · Source: '.$sourceLabel;
    }
@endphp
        <title>{{ $pageTitle }} — RecipeReal</title>
        <meta name="description" content="{{ $description }}">
        {{-- OpenGraph (WhatsApp / social preview) --}}
        <meta property="og:title" content="{{ $pageTitle }}">
        <meta property="og:description" content="{{ $description }}">
        <meta property="og:type" content="website">
        <meta property="og:site_name" content="RecipeReal">
        <meta property="og:url" content="{{ $shareUrl }}">
@if ($image)
        <meta property="og:image" content="{{ $image }}">
@endif
        <style>
            /* Scoped, self-contained page — warm palette matching the privacy
               policy page (system fonts, no external deps). */
            * {
                box-sizing: border-box;
            }
            body {
                margin: 0;
                background: #FBF8F3;
                color: #241D17;
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto,
                    Helvetica, Arial, sans-serif, "Apple Color Emoji",
                    "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji";
                line-height: 1.65;
                -webkit-font-smoothing: antialiased;
                -moz-osx-font-smoothing: grayscale;
            }
            [dir="rtl"] body {
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Tahoma,
                    "Noto Sans Arabic", "Cairo", Roboto, Helvetica, Arial, sans-serif;
                letter-spacing: 0;
            }
            main {
                max-width: 560px;
                margin: 0 auto;
                padding: 40px 20px 48px;
            }
            .brand {
                font-weight: 700;
                font-size: 1.2rem;
                letter-spacing: -0.02em;
                text-decoration: none;
                color: #241D17;
            }
            [dir="rtl"] .brand { letter-spacing: 0; }
            .brand span {
                color: #BF5523;
            }
            .card {
                background: #FFFDF9;
                border: 1px solid #EAE1D4;
                border-radius: 14px;
                padding: 18px 20px;
                margin: 18px 0 0;
            }
            .photo {
                display: block;
                width: 100%;
                aspect-ratio: 4 / 3;
                object-fit: cover;
                background: #EAE1D4;
                border-radius: 12px;
            }
            h1 {
                font-size: clamp(1.4rem, 4.5vw, 1.9rem);
                font-weight: 800;
                letter-spacing: -0.02em;
                line-height: 1.2;
                margin: 18px 0 0;
            }
            [dir="rtl"] h1 { letter-spacing: 0; }
            .title-alt {
                color: #6E5F52;
                font-size: 1.05rem;
                font-weight: 600;
                margin: 6px 0 0;
            }
            .times {
                display: flex;
                flex-direction: column;
                gap: 6px;
                background: #FBF8F3;
                border: 1px solid #EAE1D4;
                border-radius: 12px;
                padding: 12px 16px;
                margin-top: 16px;
            }
            .claim {
                color: #4A3F35;
            }
            .really {
                color: #BF5523;
                font-weight: 700;
            }
            .times strong {
                font-weight: 800;
            }
            .meta {
                color: #6E5F52;
                font-size: 0.95rem;
                margin: 14px 0 0;
            }
            .attribution {
                color: #6E5F52;
                font-size: 0.82rem;
                margin: 10px 0 0;
            }
            .attribution a {
                color: #BF5523;
                text-decoration: none;
            }
            .attribution a:hover {
                text-decoration: underline;
            }
            footer {
                color: #6E5F52;
                font-size: 0.88rem;
                margin-top: 28px;
            }
            footer a {
                color: #BF5523;
                text-decoration: none;
            }
        </style>
    </head>
    <body>
        <main>
            <a class="brand" href="/">Recipe<span>Real</span></a>

            <article class="card">
@if ($image)
                <img class="photo" src="{{ $image }}" alt="{{ $pageTitle }}" loading="lazy">
@endif
                <h1>{{ $pageTitle }}</h1>
@php
    $altTitle = app()->getLocale() === 'ar' ? $recipe->title : $recipe->title_ar;
@endphp
@if ($altTitle && $altTitle !== $pageTitle)
                <p class="title-alt" lang="{{ app()->getLocale() === 'ar' ? 'en' : 'ar' }}" dir="{{ app()->getLocale() === 'ar' ? 'ltr' : 'rtl' }}">{{ $altTitle }}</p>
@endif

@if ($claim !== null || $reality !== null)
                <div class="times">
                    @if ($claim !== null)
                        <div class="claim">{{ __('site.share_says') }} <strong>{{ $claim }} {{ __('site.share_min') }}</strong></div>
                    @endif
                    @if ($reality !== null)
                        <div class="really">{{ __('site.share_takes') }} <strong>{{ $reality }} {{ __('site.share_min') }}</strong></div>
                    @endif
                </div>
@endif

@if ($steps !== null)
                <p class="meta">{{ $steps }} {{ $steps === 1 ? __('site.share_step') : __('site.share_steps') }}</p>
@endif
@php
    $copyrightUrl = url('/copyright');
@endphp
@if ($sourceUrl !== '')
                <p class="attribution">
                    {{ app()->getLocale() === 'ar' ? 'المصدر:' : 'Source:' }}
                    <a href="{{ $sourceUrl }}" rel="noopener noreferrer nofollow" target="_blank">{{ $sourceLabel !== '' ? $sourceLabel : $sourceUrl }}</a>
                </p>
@endif
                <p class="attribution">
                    <a href="{{ $copyrightUrl }}">{{ app()->getLocale() === 'ar' ? 'حقوق الوصفات وطلبات الحذف' : 'Recipe attribution & takedowns' }}</a>
                </p>
            </article>

            <footer>{{ __('site.share_cooked') }} <a href="/">RecipeReal</a></footer>
        </main>
    </body>
</html>
