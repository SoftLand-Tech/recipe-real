@extends('layouts.page')

@section('title', 'Help Center — RecipeReal')
@section('description', 'Answers to common questions about RecipeReal: honest cook times, halal screening, offline use, account deletion, premium pricing, and installing the Android app.')

@section('jsonld')
<script type="application/ld+json">
{
    "@@context": "https://schema.org",
    "@@type": "FAQPage",
    "mainEntity": [
        {
            "@@type": "Question",
            "name": "What is RecipeReal?",
            "acceptedAnswer": {
                "@@type": "Answer",
                "text": "RecipeReal is a halal-only recipe app for Android with about 20,089 recipes in English and Arabic. Every recipe is screened against explicit pork and alcohol rules, the library downloads to your phone so it works offline, and a guided Cook Mode times every step so you know what a recipe really takes."
            }
        },
        {
            "@@type": "Question",
            "name": "The recipe says 25 minutes — why does RecipeReal show longer?",
            "acceptedAnswer": {
                "@@type": "Answer",
                "text": "Recipes habitually claim short times. RecipeReal measures what real cooks actually spend with a stopwatch in guided Cook Mode, then shows the recipe's claim next to the measured reality — we call it \"Really takes\". When the two differ, the measured one is the honest one."
            }
        },
        {
            "@@type": "Question",
            "name": "What does \"calibrated to your pace\" mean?",
            "acceptedAnswer": {
                "@@type": "Answer",
                "text": "Everyone cooks at a different speed. Each time you cook with the stopwatch, RecipeReal learns your pace and adjusts its time estimates for you, so the times get closer to your kitchen, not an average one."
            }
        },
        {
            "@@type": "Question",
            "name": "How do you decide what counts as halal?",
            "acceptedAnswer": {
                "@@type": "Answer",
                "text": "The whole library is screened against explicit pork and alcohol rules — product-wide, not recipe by recipe. We screen carefully, but when in doubt, always verify ingredients and brands yourself."
            }
        },
        {
            "@@type": "Question",
            "name": "Does RecipeReal work without internet?",
            "acceptedAnswer": {
                "@@type": "Answer",
                "text": "Yes. The library downloads to your phone, so browsing and cooking work with no signal — useful in a kitchen with bad reception, while travelling, or when saving data."
            }
        },
        {
            "@@type": "Question",
            "name": "How do I delete my account and my data?",
            "acceptedAnswer": {
                "@@type": "Answer",
                "text": "Open Settings in the app and use the Danger zone. Deleting your account removes your data: your profile, posts, likes, comments, notes, and cook history."
            }
        },
        {
            "@@type": "Question",
            "name": "What does Premium cost?",
            "acceptedAnswer": {
                "@@type": "Answer",
                "text": "RecipeReal is free to use with a monthly recipe allowance. Premium is US $5.99 per month or $49.99 per year and adds unlimited cooking and pace calibration — it also supports the project. Checkout is rolling out now and is not yet live in every build, and nothing is purchased on this website."
            }
        },
        {
            "@@type": "Question",
            "name": "How do I install RecipeReal on my Android phone?",
            "acceptedAnswer": {
                "@@type": "Answer",
                "text": "RecipeReal is installed as a direct download (Android 7.0 and up) — it is not on Google Play or the App Store. Tap the download link, and when Android asks, allow \"install unknown apps\" for the app you downloaded with (usually your browser), then open the file and install."
            }
        }
    ]
}
</script>
@endsection

@section('content')
<div class="page">
    <h1>Help <span class="o">Center</span></h1>
    <div class="rule" aria-hidden="true"></div>
    <p class="lede">
        Short answers to the questions we hear most. If yours is not here,
        the contact link at the bottom reaches us directly.
    </p>

    <h3>What is RecipeReal?</h3>
    <p>
        RecipeReal is a halal-only recipe app for Android with about 20,089
        recipes in English and Arabic. Every recipe is screened against
        explicit pork and alcohol rules, the library downloads to your phone
        so it works offline, and a guided Cook Mode times every step so you
        know what a recipe <em>really</em> takes.
    </p>

    <h3>The recipe says 25 minutes — why does RecipeReal show longer?</h3>
    <p>
        Because recipes habitually claim short times. In guided Cook Mode,
        RecipeReal runs a stopwatch on every step and measures what real
        cooks actually spend, then shows the recipe's claim next to the
        measured reality — we call it <strong>"Really takes"</strong>. When
        the two differ, the measured one is the honest one.
    </p>

    <h3>What does "calibrated to your pace" mean?</h3>
    <p>
        Everyone cooks at a different speed. Each time you cook with the
        stopwatch, RecipeReal learns your pace and adjusts its estimates for
        you — so the times get closer to <em>your</em> kitchen, not an
        average one.
    </p>

    <h3>How do you decide what counts as halal?</h3>
    <p>
        The whole library is screened against explicit pork and alcohol
        rules — product-wide, not recipe by recipe. We screen carefully, but
        when in doubt, always verify ingredients and brands yourself.
    </p>

    <h3>Does RecipeReal work without internet?</h3>
    <p>
        Yes. The library downloads to your phone, so browsing and cooking
        work with no signal — useful in a kitchen with bad reception, while
        travelling, or when you are saving data.
    </p>

    <h3>How do I delete my account and my data?</h3>
    <p>
        Open <strong>Settings</strong> in the app and use the
        <strong>Danger zone</strong>. Deleting your account removes your
        data: your profile, posts, likes, comments, notes, and cook history.
    </p>

    <h3>What does Premium cost?</h3>
    <p>
        RecipeReal is free to use with a monthly recipe allowance. Premium is
        US $5.99/month or $49.99/year and adds unlimited cooking and pace
        calibration — it also supports the project. Checkout is rolling out
        now and is not yet live in every build, and nothing is purchased on
        this website.
    </p>

    <h3>How do I install RecipeReal on my Android phone?</h3>
    <p>
        RecipeReal is installed as a direct download (Android 7.0 and up) —
        it is not on Google Play or the App Store. Get it on the
        <a href="{{ route('app.download') }}">download page</a>, and when
        Android asks, allow <strong>"install unknown apps"</strong> for the
        app you downloaded with (usually your browser), then open the file
        and install.
    </p>

    <h2>Still stuck?</h2>
    <p>
        Ask us directly on the <a href="{{ route('pages.contact') }}">contact
        page</a> — messages land with the team and we read every one. Halal
        concerns about a specific recipe are especially welcome; tell us the
        recipe name and we will look at it at the library level.
    </p>
</div>
@endsection
