@extends('layouts.page')

@section('title', __('site.about_title'))
@section('description', __('site.about_desc'))

@section('content')
<div class="page">
    <h1>{{ __('site.about_h1') }}</h1>
    <div class="rule" aria-hidden="true"></div>
    <p class="lede">
        {{ __('site.about_lede') }}
    </p>

    <h2>{{ __('site.about_why_t') }}</h2>
    <p>
        {{ __('site.about_why_p1') }}
    </p>
    <p>
        {{ __('site.about_why_p2') }}
    </p>

    <h2>{{ __('site.about_diff_t') }}</h2>
    <div class="grid g3">
        <div class="card">
            <h3>{{ __('site.about_diff1_t') }}</h3>
            <p>
                {{ __('site.about_diff1_d') }}
            </p>
        </div>
        <div class="card">
            <h3>{{ __('site.about_diff2_t') }}</h3>
            <p>
                {{ __('site.about_diff2_d') }}
            </p>
        </div>
        <div class="card">
            <h3>{{ __('site.about_diff3_t') }}</h3>
            <p>
                {{ __('site.about_diff3_d') }}
            </p>
        </div>
    </div>

    <h2>{{ __('site.about_community_t') }}</h2>
    <p>
        {{ __('site.about_community_d') }}
    </p>

    <h2>{{ __('site.about_next_t') }}</h2>
    <p>
        {{ __('site.about_next_a') }}
        <a href="{{ route('pages.pricing') }}">{{ __('site.about_pricing_link') }}</a>{{ __('site.about_next_b') }}
    </p>

    <h2>{{ __('site.about_get_t') }}</h2>
    <p>
        {{ __('site.about_get_d') }}
    </p>
    <p>
        <a class="btn btn-accent" href="{{ route('app.download') }}">{{ __('site.about_download') }}</a>
    </p>
</div>
@endsection
