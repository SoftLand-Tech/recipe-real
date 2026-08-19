<!DOCTYPE html>
<html lang="en">
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
    $pageTitle  = $recipe->title ?? $recipe->title_ar ?? 'Recipe';
    $image      = $recipe->image_url;

    // og:description mirrors the badge + steps line, e.g.
    // "Recipe says 25 min · Really takes 40 min · 12 steps".
    $descParts = [];
    if ($claim !== null) {
        $descParts[] = "Recipe says {$claim} min";
    }
    if ($reality !== null) {
        $descParts[] = "Really takes {$reality} min";
    }
    if ($steps !== null) {
        $descParts[] = "{$steps} steps";
    }
    $description = implode(' · ', $descParts);
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
            .title-ar {
                direction: rtl;
                text-align: right;
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
@if ($recipe->title_ar && $recipe->title_ar !== $recipe->title)
                <p class="title-ar" lang="ar" dir="rtl">{{ $recipe->title_ar }}</p>
@endif

@if ($claim !== null || $reality !== null)
                <div class="times">
                    @if ($claim !== null)
                        <div class="claim">Recipe says <strong>{{ $claim }} min</strong></div>
                    @endif
                    @if ($reality !== null)
                        <div class="really">Really takes <strong>{{ $reality }} min</strong></div>
                    @endif
                </div>
@endif

@if ($steps !== null)
                <p class="meta">{{ $steps }} step{{ $steps === 1 ? '' : 's' }}</p>
@endif
            </article>

            <footer>Cooked with <a href="/">RecipeReal</a></footer>
        </main>
    </body>
</html>
