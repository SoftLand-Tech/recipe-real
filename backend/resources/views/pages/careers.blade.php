@extends('layouts.page')

@section('title', 'Careers — RecipeReal')
@section('description', 'RecipeReal is a small, focused team building honest cook times for home cooks. No open roles right now — here is what we look for.')

@section('content')
<div class="page">
    <h1>Careers</h1>
    <div class="rule" aria-hidden="true"></div>
    <p class="lede">
        We are a small, focused team building one thing well: honest cooking
        times for home cooks. There are no open roles right now.
    </p>

    <h2>Why we are small on purpose</h2>
    <p>
        RecipeReal is built and run by the people who use it. Every recipe in
        the library is screened by hand against our halal standard, and every
        feature has to survive a real evening: no signal, a locked phone, a
        family waiting. Staying small keeps that standard possible.
    </p>

    <h2>What we look for when that changes</h2>
    <ul>
        <li><strong>You cook.</strong> The best ideas here come from people who have burned garlic while answering a kid's question.</li>
        <li><strong>You respect the audience.</strong> RecipeReal is halal-first and bilingual (English/Arabic) — care with both matters.</li>
        <li><strong>You like finishing things.</strong> We ship small, complete, working improvements rather than big half-features.</li>
    </ul>

    <h2>Stay in the loop</h2>
    <p>
        When a role opens, it will be posted on this page first. In the
        meantime, if you believe you would be useful to the mission, you can
        always <a href="{{ route('pages.contact') }}">write to us directly</a> —
        tell us what you cook and what you would fix first.
    </p>
</div>
@endsection
