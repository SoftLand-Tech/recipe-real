@extends('layouts.page')

@section('title', 'Contact Us — RecipeReal')
@section('description', 'Questions, feedback, or halal concerns about a recipe? Write to the RecipeReal team — messages go straight to us.')

@section('content')
<div class="page">
    <h1>Contact <span class="o">Us</span></h1>
    <div class="rule" aria-hidden="true"></div>
    <p class="lede">
        Questions, feedback, or a concern about a recipe? Write to us —
        messages land directly with the team, and we read every one.
    </p>

    @if (request('sent'))
        <p class="notice" role="status">
            Message received — thank you. We read everything and reply where we can.
        </p>
    @endif

    <div class="card" id="form">
        <form method="POST" action="{{ route('pages.contact.submit') }}">
            @csrf
            <div class="field">
                <label for="name">Your name <span style="color: var(--faint); font-weight: 600;">(optional)</span></label>
                <input id="name" name="name" type="text" maxlength="100" value="{{ old('name') }}" autocomplete="name" placeholder="e.g. Amina">
            </div>
            <div class="field">
                <label for="email">Email</label>
                <input id="email" name="email" type="email" required maxlength="200" value="{{ old('email') }}" autocomplete="email" placeholder="you@example.com">
            </div>
            <div class="field">
                <label for="message">Message</label>
                <textarea id="message" name="message" rows="6" required minlength="10" maxlength="2000" placeholder="What's on your mind?">{{ old('message') }}</textarea>
            </div>
            @error('email')<p style="color:#B3261E; margin:-8px 0 12px; font-size:14px;">{{ $message }}</p>@enderror
            @error('message')<p style="color:#B3261E; margin:-8px 0 12px; font-size:14px;">{{ $message }}</p>@enderror
            <button class="btn btn-accent" type="submit">Send message</button>
            <p style="margin: 12px 0 0; font-size: 13px; color: var(--faint);">
                We use your email only to reply — nothing else. See the
                <a href="{{ url('/privacy') }}">privacy policy</a>.
            </p>
        </form>
    </div>

    <h2>Other ways to reach the work</h2>
    <ul>
        <li><strong>App help &amp; FAQ</strong> — the <a href="{{ route('pages.help') }}">Help Center</a> answers the most common questions first.</li>
        <li><strong>Halal concerns about a specific recipe</strong> — tell us the recipe name; screening mistakes get fixed at the library level.</li>
        <li><strong>Press &amp; partnerships</strong> — the <a href="{{ route('pages.press') }}">press kit</a> has facts and art; the form reaches us for everything else.</li>
    </ul>
</div>
@endsection
