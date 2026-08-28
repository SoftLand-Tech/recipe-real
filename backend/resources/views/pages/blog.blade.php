@extends('layouts.page')

@section('title', 'The RecipeReal Blog')
@section('description', 'Short, practical essays on honest cooking times: why recipe times lie, where the evening actually goes, and how to plan a calm iftar.')

@section('content')
<div class="page">
    <h1>The RecipeReal Blog</h1>
    <div class="rule" aria-hidden="true"></div>
    <p class="lede">Short, practical essays about honest cooking times — what recipes promise, what evenings actually hold, and how to plan around both.</p>

    <div class="grid g3">
        <div class="card">
            <span class="pill">Honest times</span>
            <h3><a href="{{ url('blog/why-recipe-times-lie') }}">Why recipe times lie (and what to trust instead)</a></h3>
            <p>Published times describe a perfect kitchen, not yours. Why the gap is normal — and which numbers to trust when you plan dinner.</p>
        </div>
        <div class="card">
            <span class="pill">Planning</span>
            <h3><a href="{{ url('blog/where-the-time-goes') }}">Prep, cook, cleanup: where the time actually goes</a></h3>
            <p>Hands-on work, hands-off waiting, and the cleanup nobody counts — plus a simple rule of thumb for a recipe's real footprint.</p>
        </div>
        <div class="card">
            <span class="pill">Ramadan</span>
            <h3><a href="{{ url('blog/plan-backwards-from-maghrib') }}">Plan backwards from maghrib: a calm iftar checklist</a></h3>
            <p>The dinner hour is fixed, so everything else can be arranged around it. A five-step way to run a calm iftar.</p>
        </div>
    </div>
</div>
@endsection
