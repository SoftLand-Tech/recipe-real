@extends('layouts.page')

@section('title', 'Prep, cook, cleanup: where the time actually goes — RecipeReal')
@section('description', 'A practical breakdown of hands-on prep, hands-off cooking and forgotten cleanup — plus a simple rule of thumb for a recipe\'s real footprint on your evening.')

@section('content')
<div class="page">
    <h1>Prep, cook, cleanup: where the time <span class="o">actually</span> goes</h1>
    <div class="rule" aria-hidden="true"></div>
    <p class="lede">When a recipe says "45 minutes", it is merging several very different kinds of time. Pull them apart and planning dinner gets much easier.</p>

    <h2>Hands-on versus hands-off</h2>
    <p>
        Your real work is the hands-on part: chopping, measuring, stirring,
        flipping, moving food between pans. Some cooking is hands-on too — a stir-
        fry owns you for every one of its eight minutes. But most cooking time is
        hands-off: the bake, the simmer, the chill in the fridge. Your hands are
        free, and recipes love to count that as if it were your time.
    </p>
    <p>
        The trap runs both ways. Headlines pad themselves with passive time while
        dropping half the active work, which is how a "40-minute" recipe can mean
        forty minutes at home with only fifteen of them actually free. And passive
        time still schedules you: a 45-minute bake means you are home for
        45 minutes, even if you spend them folding laundry.
    </p>
    <p>
        There is a third category nobody names: the ramp-up. Pans heating, water
        coming to the boil, the oven reaching temperature. It is nobody's hands
        and everybody's wait, and almost no headline includes it.
    </p>

    <h2>The steps everyone forgets</h2>
    <ul>
        <li><strong>Marinating.</strong> Hours of clock time that cost you nothing tonight — if yesterday's you planned them. Unplanned, they push dinner back by however long the meat actually needs.</li>
        <li><strong>Resting.</strong> Roasted meat wants ten to fifteen minutes before carving, at exactly the hour when everyone is already sitting at the table.</li>
        <li><strong>Rice and grains.</strong> "20 minutes" rarely includes coming up to the boil or resting covered off the heat. Call it 35 before anyone is served.</li>
        <li><strong>Cleanup.</strong> It happens in fragments all evening, then in one last block after the plates are cleared. It is almost never counted anywhere.</li>
    </ul>

    <h2>A simple rule of thumb</h2>
    <p>
        Add up the steps that need your hands. Add the longest hands-off block —
        you will wait through it once, no matter how many small tasks you fit
        around it. Then add fifteen minutes of cleanup. That total is the recipe's
        real footprint on your evening, and for a family dinner it usually lands
        thirty to sixty minutes above the headline.
    </p>

    <h2>How RecipeReal splits it</h2>
    <p>
        RecipeReal separates Focused time — the steps that need you — from Cleanup
        time, so a recipe's "Really takes" answers both questions that matter:
        how long you must be present, and how long until the kitchen is yours
        again. Once you have cooked a dish, the numbers are yours, not a test
        kitchen's.
    </p>

    <div class="card">
        <h3>Know where your evening goes</h3>
        <p>
            Measure once, plan calmly forever. RecipeReal is free for Android.
        </p>
        <p><a class="btn btn-accent" href="{{ route('app.download') }}">Get RecipeReal</a></p>
    </div>

    <h2>More from the blog</h2>
    <ul>
        <li><a href="{{ url('blog/why-recipe-times-lie') }}">Why recipe times lie (and what to trust instead)</a></li>
        <li><a href="{{ url('blog/plan-backwards-from-maghrib') }}">Plan backwards from maghrib: a calm iftar checklist</a></li>
        <li><a href="{{ route('pages.blog') }}">All blog posts</a></li>
    </ul>
</div>
@endsection
