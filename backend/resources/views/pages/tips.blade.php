@extends('layouts.page')

@section('title', 'Cooking Tips — RecipeReal')
@section('description', 'Short, practical tips for calm, time-honest home cooking — before you start, while you cook, and after the plate is served.')

@section('content')
<div class="page">
    <h1>Cooking Tips</h1>
    <div class="rule" aria-hidden="true"></div>
    <p class="lede">No gadgets, no techniques to master — just small habits that keep a weeknight dinner on schedule and an evening calm.</p>

    <h2>Before you start</h2>
    <ul>
        <li>Read the whole recipe before the first knife leaves the block, and mark the steps that need your hands. The headline time will not tell you — <a href="{{ url('blog/why-recipe-times-lie') }}">recipe times rarely do</a>.</li>
        <li>Chop everything before any heat goes on. Most blown estimates are blown in the prep, not in the cooking.</li>
        <li>Start the slowest passive thing first — the oven, the rice, the marinade coming to temperature — and let it run while you do the fast work.</li>
        <li>Defrost and marinate the night before. The fridge does evening work for free while you sleep.</li>
    </ul>

    <h2>While you cook</h2>
    <ul>
        <li>Set a timer for every hands-off block and actually step away. The simmer does not need watching; the table needs setting.</li>
        <li>Clean in the gaps. The thirty seconds while the onions soften is enough to wash one pot, and one pot at a time is how kitchens stay sane.</li>
        <li>If everything turns urgent at once, your start time was wrong — not your cooking. Next time, begin with the dish that has the longest lead. <a href="{{ url('blog/where-the-time-goes') }}">Here is where the time actually goes.</a></li>
        <li>Run one stopwatch, once, on a dish you cook often. Whatever it says is the number to plan around — your kitchen, not a test kitchen's.</li>
    </ul>

    <h2>After the plate</h2>
    <ul>
        <li>Fill the dirty pots with water before you sit down to eat. Ten seconds now saves ten minutes of scrubbing later.</li>
        <li>Note what dinner actually took, start to finish. Measured honestly, those numbers become the most useful recipe data you own — <a href="{{ route('app.download') }}">RecipeReal records them for you</a> with a stopwatch in Cook Mode.</li>
    </ul>

    <h2>Keep your own times</h2>
    <p>
        Every tip above comes down to one idea: plan around what your kitchen
        really does, not what a recipe hopes. Measure a few dinners and the
        guessing stops. If you want help, the <a href="{{ route('pages.blog') }}">blog</a> goes deeper,
        and <a href="{{ route('app.download') }}">the app</a> does the measuring.
    </p>
</div>
@endsection
