@extends('layouts.page')

@section('title', 'About Us — RecipeReal')
@section('description', 'Why RecipeReal exists: a halal-only recipe app with honest cook times measured by real cooks, in English and Arabic, with a library that works offline.')

@section('content')
<div class="page">
    <h1>About Us</h1>
    <div class="rule" aria-hidden="true"></div>
    <p class="lede">
        RecipeReal is a halal-only recipe app with honest cook times —
        measured by real cooks, in English and Arabic, built to work offline.
    </p>

    <h2>Why RecipeReal exists</h2>
    <p>
        Recipes habitually claim times that sound better than reality. You
        pick dinner because it says 25 minutes, then stand at the stove for
        an hour while the table waits. Home cooks pay for that little lie
        every single week, and almost every recipe app repeats it.
    </p>
    <p>
        RecipeReal started as a fix for exactly that. In guided Cook Mode, a
        stopwatch runs step by step while you cook, so the app measures what
        real cooks actually spend on a recipe. It shows the claimed time next
        to the reality — the "Really takes" — and calibrates every estimate
        to your pace, so the number you plan your evening around is one you
        can trust. Today the library holds more than 20,000 recipes across
        137,644 steps, and the measuring never stops.
    </p>

    <h2>What makes it different</h2>
    <div class="grid g3">
        <div class="card">
            <h3>Measured, not guessed</h3>
            <p>
                Cook Mode times you step by step and shows the claim next to
                what it really takes — then adapts every estimate to your
                pace.
            </p>
        </div>
        <div class="card">
            <h3>Halal, before anything else</h3>
            <p>
                Every recipe is screened against explicit pork and alcohol
                rules before it reaches the app. No exceptions, no "mostly".
            </p>
        </div>
        <div class="card">
            <h3>Built for real kitchens</h3>
            <p>
                English and Arabic with full right-to-left support, and a
                library that downloads to your phone — cooking works with no
                signal.
            </p>
        </div>
    </div>

    <h2>A community that sharpens the numbers</h2>
    <p>
        Every measurement a cook makes in Cook Mode makes the estimates
        better — for them, and for everyone who cooks the same recipe after
        them. Around that sits a community of cooks who share what they
        tried, compare notes, and follow each other's kitchens. The more
        people cook with RecipeReal, the truer the times get.
    </p>

    <h2>What's next</h2>
    <p>
        RecipeReal is built and run by one person, and it grows the way it
        cooks: steadily, and only when things are truly ready. A free tier
        is available today, with Premium rolling out soon. You can always
        see the current details on the
        <a href="{{ route('pages.pricing') }}">pricing page</a>.
    </p>

    <h2>Get the app</h2>
    <p>
        RecipeReal runs on Android 7.0 and up and is distributed as a direct
        APK download. Install it, download the library once, and let the
        stopwatch tell the truth for a change.
    </p>
    <p>
        <a class="btn btn-accent" href="{{ route('app.download') }}">Download RecipeReal</a>
    </p>
</div>
@endsection
