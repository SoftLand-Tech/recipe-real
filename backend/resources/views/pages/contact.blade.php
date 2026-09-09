@extends('layouts.page')

@section('title', __('site.contact_title'))
@section('description', __('site.contact_desc'))

@section('content')
<div class="page">
    <h1>{{ __('site.contact_h1_a') }} <span class="o">{{ __('site.contact_h1_b') }}</span></h1>
    <div class="rule" aria-hidden="true"></div>
    <p class="lede">
        {{ __('site.contact_lede') }}
    </p>

    @if (request('sent'))
        <p class="notice" role="status">
            {{ __('site.contact_sent') }}
        </p>
    @endif

    <div class="card" id="form">
        <form method="POST" action="{{ route('pages.contact.submit') }}">
            @csrf
            <div class="field">
                <label for="name">{{ __('site.contact_name') }} <span style="color: var(--faint); font-weight: 600;">{{ __('site.contact_optional') }}</span></label>
                <input id="name" name="name" type="text" maxlength="100" value="{{ old('name') }}" autocomplete="name" placeholder="{{ __('site.contact_name_ph') }}">
            </div>
            <div class="field">
                <label for="email">{{ __('site.contact_email') }}</label>
                <input id="email" name="email" type="email" required maxlength="200" value="{{ old('email') }}" autocomplete="email" placeholder="you@example.com">
            </div>
            <div class="field">
                <label for="message">{{ __('site.contact_message') }}</label>
                <textarea id="message" name="message" rows="6" required minlength="10" maxlength="2000" placeholder="{{ __('site.contact_message_ph') }}">{{ old('message') }}</textarea>
            </div>
            @error('email')<p style="color:#B3261E; margin:-8px 0 12px; font-size:14px;">{{ $message }}</p>@enderror
            @error('message')<p style="color:#B3261E; margin:-8px 0 12px; font-size:14px;">{{ $message }}</p>@enderror
            <button class="btn btn-accent" type="submit">{{ __('site.contact_send') }}</button>
            <p style="margin: 12px 0 0; font-size: 13px; color: var(--faint);">
                {{ __('site.contact_note_a') }}
                <a href="{{ url('/privacy') }}">{{ __('site.foot_privacy') }}</a>{{ __('site.contact_note_b') }}
            </p>
        </form>
    </div>

    <h2>{{ __('site.contact_other') }}</h2>
    <ul>
        <li><strong>{{ __('site.contact_help') }}</strong> — <a href="{{ route('pages.help') }}">{{ __('site.foot_help') }}</a> {{ __('site.contact_help_text') }}</li>
        <li><strong>{{ __('site.contact_halal') }}</strong> — {{ __('site.contact_halal_text') }}</li>
        <li><strong>{{ __('site.contact_press') }}</strong> — <a href="{{ route('pages.press') }}">{{ __('site.foot_press') }}</a> {{ __('site.contact_press_text') }}</li>
    </ul>
</div>
@endsection
