<!DOCTYPE html>
<html lang="en">
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
@php
    // PUBLIC data only — no auth, no counts, no comments.
    $author = trim((string) ($post->user->display_name ?? $post->user->name ?? ''));
    $avatar = $post->user->avatar_url;

    // Kind chip: label + tone matched to the app's mobile chips
    // (try=success green / fail=danger red / question=amber).
    $kindTones = [
        'try'      => ['label' => 'Try',      'noun' => 'recipe try',  'fg' => '#3D8B5A', 'bg' => '#E3EFE8'],
        'fail'     => ['label' => 'Fail',     'noun' => 'recipe fail', 'fg' => '#D9534F', 'bg' => '#FAE6E5'],
        'question' => ['label' => 'Question', 'noun' => 'question',    'fg' => '#D69A2D', 'bg' => '#F8EDD4'],
    ];
    $kind = $kindTones[$post->kind] ?? $kindTones['try'];

    // Effective image list (images JSON column, else legacy image_url),
    // capped at 4 for the page.
    $jsonImages = is_array($post->images) ? array_values(array_filter($post->images)) : [];
    $allImages  = count($jsonImages) > 0
        ? $jsonImages
        : ($post->image_url ? [$post->image_url] : []);
    $images = array_slice($allImages, 0, 4);

    $recipe = $post->recipe;

    // Recipe badge figures — the same precedence the recipe page uses
    // (reality_minutes ?? community_avg_minutes; claim-only when no reality).
    $claim   = $recipe && $recipe->publisher_time_minutes !== null
        ? (int) round((float) $recipe->publisher_time_minutes)
        : null;
    $reality = $recipe && ($recipe->reality_minutes ?? $recipe->community_avg_minutes) !== null
        ? (int) round((float) ($recipe->reality_minutes ?? $recipe->community_avg_minutes))
        : null;

    $shareUrl = url('/p/' . $post->id);

    // og:image: first post image, else the attached recipe's image.
    $ogImage = $images[0] ?? $recipe?->image_url;

    // og:title: "X shared a recipe try on RecipeReal" (or the kind word).
    $ogTitle = ($author !== '' ? $author . ' ' : '') . 'shared a ' . $kind['noun'] . ' on RecipeReal';

    // og:description: first 120 chars of the body.
    $description = \Illuminate\Support\Str::limit(trim((string) $post->body), 120);
@endphp
        <title>{{ $ogTitle }}</title>
        <meta name="description" content="{{ $description }}">
        {{-- OpenGraph (WhatsApp / social preview) --}}
        <meta property="og:title" content="{{ $ogTitle }}">
        <meta property="og:description" content="{{ $description }}">
        <meta property="og:type" content="website">
        <meta property="og:site_name" content="RecipeReal">
        <meta property="og:url" content="{{ $shareUrl }}">
@if ($ogImage)
        <meta property="og:image" content="{{ $ogImage }}">
@endif
        <style>
            /* Scoped, self-contained page — same warm palette as the recipe
               share page (system fonts, no external deps). */
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
            .author {
                display: flex;
                align-items: center;
                gap: 10px;
            }
            .author img {
                width: 40px;
                height: 40px;
                border-radius: 50%;
                object-fit: cover;
                background: #EAE1D4;
                flex: none;
            }
            .author .name {
                font-size: 1.05rem;
                font-weight: 700;
                letter-spacing: -0.02em;
                line-height: 1.3;
            }
            .kind {
                display: inline-block;
                margin-top: 2px;
                padding: 1px 10px;
                border-radius: 999px;
                font-size: 0.78rem;
                font-weight: 700;
                line-height: 1.5;
            }
            .body {
                margin: 16px 0 0;
                white-space: pre-wrap;
                overflow-wrap: anywhere;
            }
            /* Simple photo grid: 1 image full-width 4:3; 2+ images square
               cells in two columns (3rd+ spill into row 2). */
            .photos {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 6px;
                margin-top: 16px;
            }
            .photos.single {
                grid-template-columns: 1fr;
            }
            .photos img {
                width: 100%;
                aspect-ratio: 1;
                object-fit: cover;
                background: #EAE1D4;
                border-radius: 10px;
            }
            .photos.single img {
                aspect-ratio: 4 / 3;
            }
            /* Attached recipe: a small card linking to /r/{recipe}. */
            .recipe {
                display: flex;
                align-items: center;
                gap: 12px;
                text-decoration: none;
                color: inherit;
                background: #FBF8F3;
                border: 1px solid #EAE1D4;
                border-radius: 12px;
                padding: 10px 14px;
                margin-top: 16px;
            }
            .recipe img {
                width: 52px;
                height: 52px;
                border-radius: 8px;
                object-fit: cover;
                background: #EAE1D4;
                flex: none;
            }
            .recipe .main {
                min-width: 0;
            }
            .recipe .title {
                font-weight: 700;
                font-size: 0.95rem;
                line-height: 1.35;
                overflow-wrap: anywhere;
            }
            .recipe .times {
                display: flex;
                flex-wrap: wrap;
                gap: 4px;
                margin-top: 4px;
                font-size: 0.85rem;
            }
            .recipe .claim {
                color: #4A3F35;
            }
            .recipe .really {
                color: #BF5523;
                font-weight: 700;
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
                <div class="author">
@if ($avatar)
                    <img src="{{ $avatar }}" alt="" loading="lazy">
@endif
                    <div>
                        <div class="name">{{ $author }}</div>
                        <span class="kind" style="color: {{ $kind['fg'] }}; background: {{ $kind['bg'] }};">{{ $kind['label'] }}</span>
                    </div>
                </div>

                <p class="body">{{ $post->body }}</p>

@if (count($images) > 0)
                <div class="photos{{ count($images) === 1 ? ' single' : '' }}">
@foreach ($images as $image)
                    <img src="{{ $image }}" alt="" loading="lazy">
@endforeach
                </div>
@endif

@if ($recipe !== null)
                <a class="recipe" href="{{ url('/r/' . $recipe->id) }}">
@if ($recipe->image_url)
                    <img src="{{ $recipe->image_url }}" alt="" loading="lazy">
@endif
                    <span class="main">
                        <span class="title">{{ $recipe->title ?? $recipe->title_ar ?? 'Recipe' }}</span>
                        <span class="times">
@if ($claim !== null)
                            <span class="claim">Recipe says {{ $claim }} min</span>
@endif
@if ($reality !== null)
                            <span class="really">Really takes {{ $reality }} min</span>
@endif
                        </span>
                    </span>
                </a>
@endif
            </article>

            <footer>Cooked with <a href="/">RecipeReal</a></footer>
        </main>
    </body>
</html>
