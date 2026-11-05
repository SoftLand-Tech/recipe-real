@extends('layouts.page')

@section('title', __('site.account_delete_title'))
@section('description', __('site.account_delete_desc'))

@section('content')
<div class="page">
    <h1>{{ __('site.account_delete_h1_a') }} <span class="o">{{ __('site.account_delete_h1_b') }}</span></h1>
    <div class="rule" aria-hidden="true"></div>
    <p class="lede">
        {{ __('site.account_delete_lede') }}
    </p>

    @if (request('sent'))
        <p class="notice" role="status">
            {{ __('site.account_delete_sent') }}
        </p>
    @endif

    <div class="grid g2">
        <div class="card">
            <span class="pill">{{ __('site.account_delete_inapp_pill') }}</span>
            <h3>{{ __('site.account_delete_inapp_t') }}</h3>
            <p>
                {{ __('site.account_delete_inapp_p1_a') }} <strong>{{ __('site.account_delete_inapp_path') }}</strong>{{ __('site.account_delete_inapp_p1_b') }}
            </p>
            <p>{{ __('site.account_delete_inapp_p2') }}</p>
        </div>
        <div class="card">
            <span class="pill teal">{{ __('site.account_delete_web_pill') }}</span>
            <h3>{{ __('site.account_delete_web_t') }}</h3>
            <p>{{ __('site.account_delete_web_p1') }}</p>
            <p><a class="btn btn-ghost" href="#form">{{ __('site.account_delete_web_cta') }}</a></p>
        </div>
    </div>

    <h2>{{ __('site.account_delete_what_t') }}</h2>
    <p>{{ __('site.account_delete_what_p') }}</p>
    <ul>
        <li>{{ __('site.account_delete_what1') }}</li>
        <li>{{ __('site.account_delete_what2') }}</li>
        <li>{{ __('site.account_delete_what3') }}</li>
        <li>{{ __('site.account_delete_what4') }}</li>
        <li>{{ __('site.account_delete_what5') }}</li>
        <li>{{ __('site.account_delete_what6') }}</li>
        <li>{{ __('site.account_delete_what7') }}</li>
    </ul>
    <p>{{ __('site.account_delete_what_note') }}</p>

    <h2>{{ __('site.account_delete_form_t') }}</h2>
    <p>{{ __('site.account_delete_form_p') }}</p>

    <div class="card" id="form">
        <form method="POST" action="{{ route('pages.account-delete.submit') }}">
            @csrf
            {{-- Honeypot (M15): real users never see or fill the 'website'
                 field, and form_loaded_at marks the render time for the
                 2-second minimum submit age. The 'spam' middleware checks
                 both server-side. --}}
            <div aria-hidden="true" style="position:absolute; left:-9999px; height:0; overflow:hidden;">
                <label for="website">Website</label>
                <input id="website" name="website" type="text" autocomplete="off" tabindex="-1">
            </div>
            <input type="hidden" name="form_loaded_at" value="{{ time() }}">
            <div class="field">
                <label for="name">{{ __('site.account_delete_name') }} <span style="color: var(--faint); font-weight: 600;">{{ __('site.account_delete_optional') }}</span></label>
                <input id="name" name="name" type="text" maxlength="100" value="{{ old('name') }}" autocomplete="name" placeholder="{{ __('site.account_delete_name_ph') }}">
            </div>
            <div class="field">
                <label for="email">{{ __('site.account_delete_email') }}</label>
                <input id="email" name="email" type="email" required maxlength="200" value="{{ old('email') }}" autocomplete="email" placeholder="you@example.com">
                <p style="margin: 6px 0 0; font-size: 13px; color: var(--faint);">{{ __('site.account_delete_email_help') }}</p>
            </div>
            <div class="field">
                <label for="message">{{ __('site.account_delete_message') }} <span style="color: var(--faint); font-weight: 600;">{{ __('site.account_delete_optional') }}</span></label>
                <textarea id="message" name="message" rows="4" maxlength="2000" placeholder="{{ __('site.account_delete_message_ph') }}">{{ old('message') }}</textarea>
            </div>
            @error('name')<p style="color:#B3261E; margin:-8px 0 12px; font-size:14px;">{{ $message }}</p>@enderror
            @error('email')<p style="color:#B3261E; margin:-8px 0 12px; font-size:14px;">{{ $message }}</p>@enderror
            @error('message')<p style="color:#B3261E; margin:-8px 0 12px; font-size:14px;">{{ $message }}</p>@enderror
            <button class="btn btn-accent" type="submit">{{ __('site.account_delete_send') }}</button>
            <p style="margin: 12px 0 0; font-size: 13px; color: var(--faint);">
                {{ __('site.account_delete_note_a') }}
                <a href="{{ url('/privacy') }}">{{ __('site.foot_privacy') }}</a>{{ __('site.account_delete_note_b') }}
            </p>
        </form>
    </div>

    <h2>{{ __('site.account_delete_more_t') }}</h2>
    <p>
        {{ __('site.account_delete_more_a') }}
        <a href="{{ url('/privacy') }}">{{ __('site.account_delete_privacy_link') }}</a>{{ __('site.account_delete_more_b') }}
        <a href="{{ route('pages.contact') }}">{{ __('site.account_delete_contact_link') }}</a>{{ __('site.account_delete_more_c') }}
    </p>
</div>
@endsection
