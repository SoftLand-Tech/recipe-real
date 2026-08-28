@extends('layouts.page')

@section('title', 'Plan backwards from maghrib: a calm iftar checklist — RecipeReal')
@section('description', 'The iftar hour is fixed, so everything else can be arranged around it. A five-step checklist for a calm Ramadan evening in the kitchen.')

@section('content')
<div class="page">
    <h1>Plan backwards from maghrib: <span class="o">a calm iftar checklist</span></h1>
    <div class="rule" aria-hidden="true"></div>
    <p class="lede">In Ramadan the dinner hour is set by the adhan, not by appetite. That fixed finish line is a gift: work backwards from it and the whole evening calms down.</p>

    <blockquote>
        Maghrib doesn't move. Everything else can be arranged around it.
    </blockquote>

    <h2>One: pick your eating time</h2>
    <p>
        Not when maghrib is — when you actually eat. Some families eat the moment
        the fast opens with dates and water, then bring the main dish thirty
        minutes later once everyone has settled. Decide which rhythm is yours,
        because every start time in the kitchen hangs off that one number.
    </p>

    <h2>Two: work backwards through the menu</h2>
    <p>
        Take the longest dish on the table and give it the latest start that still
        lands on time, then fit the rest around it. If you eat at 6:30 and the
        main really takes 45 minutes plus 10 to rest, it starts at 5:35 — which
        means its onions are being chopped at 5:20. Soup is quick and reheats
        well, so it starts last. Write the start times on a scrap of paper; a
        thirty-second list beats a stressful evening.
    </p>
    <p>
        The key word is <em>really</em>. Use the times your kitchen has actually
        produced, not the ones printed on the recipe — on iftar night a generous
        estimate is worth more than an optimistic one.
    </p>

    <h2>Three: give the day the work you can</h2>
    <p>
        Anything that survives a few hours is free if you do it early. Marinate
        the chicken after suhoor. Chop vegetables in the quiet afternoon. Make the
        soup base at midday and reheat it at the end. Evening-you should only be
        assembling and heating — the more that is already done, the calmer the
        last half hour feels.
    </p>

    <h2>Four: keep a go-to list</h2>
    <p>
        Keep a short list of dishes whose real times you already know and trust —
        the ones you have cooked often enough to schedule blind. These are the
        iftar workhorses: measured, forgiving, reheatable. RecipeReal helps here
        too. Recipes carry a "Really takes" time measured by real cooks, and you
        can set your "eating at" time and let the app tell you exactly when to
        start.
    </p>

    <h2>Five: don't experiment on the day</h2>
    <p>
        The ambitious twelve-step dish will still be there next week. Iftar night
        is for recipes you could nearly cook with your eyes closed. Save the
        experiment for a normal weekend, when a late dinner costs you nothing and
        nobody is fasting through the wait.
    </p>

    <div class="card">
        <h3>Set the time you eat, get the time to start</h3>
        <p>
            RecipeReal tells you when to begin so the food lands when the fast
            opens. Free for Android.
        </p>
        <p><a class="btn btn-accent" href="{{ route('app.download') }}">Get RecipeReal</a></p>
    </div>

    <h2>More from the blog</h2>
    <ul>
        <li><a href="{{ url('blog/why-recipe-times-lie') }}">Why recipe times lie (and what to trust instead)</a></li>
        <li><a href="{{ url('blog/where-the-time-goes') }}">Prep, cook, cleanup: where the time actually goes</a></li>
        <li><a href="{{ route('pages.blog') }}">All blog posts</a></li>
    </ul>
</div>
@endsection
