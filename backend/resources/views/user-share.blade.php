<!DOCTYPE html>
<html lang="{{ app()->getLocale() }}" dir="{{ app()->getLocale() === 'ar' ? 'rtl' : 'ltr' }}">
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
@php
    // PUBLIC data only — the internal users.name, email and gender never
    // render here (privacy hardening H4; ProfileController::payload with
    // publicOnly: true is the allowlist). Display name falls back to the
    // same neutral bilingual label the public API uses.
    $name = trim((string) ($user->display_name ?? ''));
    if ($name === '') {
        $name = app()->getLocale() === 'ar' ? 'طاهٍ' : 'A cook';
    }
    // avatar_url is already a full URL (upload pipeline / Google picture)
    // or null — null renders the initials tile below, no image tag.
    $avatar = $user->avatar_url;

    // Neutral initials fallback: the first character of the display name on
    // a warm tile — keeps the profile presentable with zero external assets.
    $initial = mb_substr($name, 0, 1);

    $pageTitle = $name.' — RecipeReal';
    $shareUrl  = url('/u/' . $user->id);

    // og:description mirrors the bio, or a localized fallback line when the
    // cook never wrote one (same rule as the page body below).
    $bio = trim((string) ($user->bio ?? ''));
    $description = $bio !== '' ? $bio : __('site.share_user_fallback_desc');

    $copyrightUrl = url('/copyright');
@endphp
        <title>{{ $pageTitle }}</title>
        <meta name="description" content="{{ $description }}">
        {{-- OpenGraph (WhatsApp / social preview) --}}
        <meta property="og:title" content="{{ $pageTitle }}">
        <meta property="og:description" content="{{ $description }}">
        <meta property="og:type" content="website">
        <meta property="og:site_name" content="RecipeReal">
        <meta property="og:url" content="{{ $shareUrl }}">
@if ($avatar)
        <meta property="og:image" content="{{ $avatar }}">
@endif
        <style>
            /* Scoped, self-contained page — same warm palette as the recipe
               and post share pages (system fonts, no external deps). */
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
            .profile {
                display: flex;
                align-items: center;
                gap: 14px;
            }
            .avatar {
                width: 84px;
                height: 84px;
                border-radius: 50%;
                object-fit: cover;
                background: #EAE1D4;
                flex: none;
            }
            /* Neutral initials tile when the cook has no avatar (or a
               broken one): warm background, brand-colored first letter. */
            .avatar-fallback {
                width: 84px;
                height: 84px;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                background: #EAE1D4;
                color: #BF5523;
                font-size: 2rem;
                font-weight: 800;
                flex: none;
                user-select: none;
            }
            .who {
                min-width: 0;
            }
            .name {
                font-size: 1.35rem;
                font-weight: 800;
                letter-spacing: -0.02em;
                line-height: 1.25;
                overflow-wrap: anywhere;
            }
            [dir="rtl"] .name { letter-spacing: 0; }
            .stats {
                display: flex;
                flex-wrap: wrap;
                align-items: baseline;
                gap: 8px;
                color: #6E5F52;
                font-size: 0.92rem;
                margin-top: 6px;
            }
            .stats strong {
                color: #241D17;
                font-weight: 800;
            }
            .bio {
                margin: 16px 0 0;
                white-space: pre-wrap;
                overflow-wrap: anywhere;
            }
            .bio-empty {
                color: #6E5F52;
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
            /* Newest recipes: small cards so a visitor without the app can
               keep browsing real content (each links to /r/{id}). */
            .recipes {
                margin: 24px 0 0;
            }
            .recipes h2 {
                font-size: 1.05rem;
                font-weight: 700;
                letter-spacing: -0.02em;
                margin: 0 0 10px;
                overflow-wrap: anywhere;
            }
            [dir="rtl"] .recipes h2 { letter-spacing: 0; }
            .grid {
                display: grid;
                grid-template-columns: repeat(2, 1fr);
                gap: 10px;
            }
            .rcard {
                display: block;
                text-decoration: none;
                color: inherit;
                background: #FFFDF9;
                border: 1px solid #EAE1D4;
                border-radius: 12px;
                padding: 10px;
            }
            .rcard img,
            .rcard .thumb {
                display: block;
                width: 100%;
                aspect-ratio: 4 / 3;
                object-fit: cover;
                background: #EAE1D4;
                border-radius: 8px;
            }
            .rcard .rtitle {
                display: block;
                font-weight: 700;
                font-size: 0.92rem;
                line-height: 1.35;
                margin-top: 8px;
                overflow-wrap: anywhere;
            }
            .rcard .rtimes {
                display: flex;
                flex-wrap: wrap;
                gap: 4px;
                margin-top: 4px;
                font-size: 0.82rem;
            }
            .rcard .claim {
                color: #4A3F35;
            }
            .rcard .really {
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
                <div class="profile">
@if ($avatar)
                    <img class="avatar" src="{{ $avatar }}" alt="{{ $name }}" loading="lazy">
@else
                    <div class="avatar-fallback" aria-hidden="true">{{ $initial }}</div>
@endif
                    <div class="who">
                        <div class="name">{{ $name }}</div>
                        <div class="stats">
                            <span><strong>{{ $recipesCount }}</strong> {{ __('site.share_user_stat_recipes') }}</span>
                            <span>·</span>
                            <span><strong>{{ $followersCount }}</strong> {{ __('site.share_user_stat_followers') }}</span>
                            <span>·</span>
                            <span><strong>{{ $followingCount }}</strong> {{ __('site.share_user_stat_following') }}</span>
                        </div>
                    </div>
                </div>

                <p class="bio{{ $bio === '' ? ' bio-empty' : '' }}">{{ $bio !== '' ? $bio : __('site.share_user_fallback_desc') }}</p>

                <p class="attribution">
                    <a href="{{ $copyrightUrl }}">{{ app()->getLocale() === 'ar' ? 'حقوق الوصفات وطلبات الحذف' : 'Recipe attribution & takedowns' }}</a>
                </p>
            </article>

@if (count($recipes) > 0)
            <section class="recipes">
                <h2>{{ __('site.share_user_recipes_heading', ['name' => $name]) }}</h2>
                <div class="grid">
@foreach ($recipes as $recipe)
    @php
        // Device language first (same rule as /r): Arabic visitors see the
        // Arabic title when it exists, and vice versa. When the rendered
        // title is NOT in the page language, tag it lang+dir so mixed
        // scripts align correctly.
        $ar = $recipe->title_ar;
        $en = $recipe->title;
        $title = app()->getLocale() === 'ar' ? ($ar ?? $en) : ($en ?? $ar);
        $titleIsAlt = false;
        if ($title !== null) {
            $titleIsAlt = app()->getLocale() === 'ar'
                ? ($ar === null && $en !== null)
                : ($en === null && $ar !== null);
        } else {
            $title = __('site.share_fallback_recipe');
        }

        // Badge figures: the claim and the measured reality — same
        // "Recipe says / Really takes" treatment and the same precedence
        // as /r and the post cards (persisted reality first, community
        // average as the fallback; NO publisher fallback).
        $claim = $recipe->publisher_time_minutes !== null
            ? (int) round((float) $recipe->publisher_time_minutes)
            : null;
        $reality = ($recipe->reality_minutes ?? $recipe->community_avg_minutes) !== null
            ? (int) round((float) ($recipe->reality_minutes ?? $recipe->community_avg_minutes))
            : null;
    @endphp
                    <a class="rcard" href="{{ url('/r/' . $recipe->id) }}">
@if ($recipe->image_url)
                        <img src="{{ $recipe->image_url }}" alt="{{ __('site.share_user_recipe_alt', ['title' => $title]) }}" loading="lazy">
@else
                        <div class="thumb" aria-hidden="true"></div>
@endif
                        <span class="rtitle"@if ($titleIsAlt) lang="{{ app()->getLocale() === 'ar' ? 'en' : 'ar' }}" dir="{{ app()->getLocale() === 'ar' ? 'ltr' : 'rtl' }}"@endif>{{ $title }}</span>
                        <span class="rtimes">
@if ($claim !== null)
                            <span class="claim">{{ __('site.share_says') }} {{ $claim }} {{ __('site.share_min') }}</span>
@endif
@if ($reality !== null)
                            <span class="really">{{ __('site.share_takes') }} {{ $reality }} {{ __('site.share_min') }}</span>
@endif
                        </span>
                    </a>
@endforeach
                </div>
            </section>
@endif

            <footer>{{ __('site.share_cooked') }} <a href="/">RecipeReal</a></footer>
        </main>
    </body>
</html>
