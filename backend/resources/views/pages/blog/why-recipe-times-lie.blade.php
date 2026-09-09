@extends('layouts.page')

@section('title', __('site.b1_title'))
@section('description', __('site.b1_desc'))

@section('content')
<div class="page">
    <h1>{{ __('site.b1_h1_a') }} <span class="o">{{ __('site.b1_h1_b') }}</span></h1>
    <div class="rule" aria-hidden="true"></div>
    <p class="lede">{{ __('site.b1_lede') }}</p>

    <p>
        {{ __('site.b1_p1') }}
    </p>
    <p>
        {{ __('site.b1_p2') }}
    </p>

    <h2>{{ __('site.b1_s1_t') }}</h2>
    <p>
        {{ __('site.b1_s1_p1') }}
    </p>
    <p>
        {{ __('site.b1_s1_p2') }}
    </p>

    <h2>{{ __('site.b1_s2_t') }}</h2>
    <p>
        {{ __('site.b1_s2_p') }}
    </p>
    <blockquote>
        {{ __('site.b1_quote') }}
    </blockquote>

    <h2>{{ __('site.b1_s3_t') }}</h2>
    <p>
        <strong>{{ __('site.b1_s3_b1') }}</strong> {{ __('site.b1_s3_p1') }}
    </p>
    <p>
        <strong>{{ __('site.b1_s3_b2') }}</strong> {{ __('site.b1_s3_p2') }}
    </p>
    <p>
        <strong>{{ __('site.b1_s3_b3') }}</strong> {{ __('site.b1_s3_p3') }}
    </p>

    <h2>{{ __('site.b1_s4_t') }}</h2>
    <p>
        {{ __('site.b1_s4_p') }}
    </p>

    <div class="card">
        <h3>{{ __('site.b1_card_t') }}</h3>
        <p>
            {{ __('site.b1_card_d') }}
        </p>
        <p><a class="btn btn-accent" href="{{ route('app.download') }}">{{ __('site.b1_card_btn') }}</a></p>
    </div>

    <h2>{{ __('site.blog_more') }}</h2>
    <ul>
        <li><a href="{{ url('blog/where-the-time-goes') }}">{{ __('site.blog_card2_t') }}</a></li>
        <li><a href="{{ url('blog/plan-backwards-from-maghrib') }}">{{ __('site.blog_card3_t') }}</a></li>
        <li><a href="{{ route('pages.blog') }}">{{ __('site.blog_all') }}</a></li>
    </ul>
</div>
@endsection
