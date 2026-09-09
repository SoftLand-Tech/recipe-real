@extends('layouts.page')

@section('title', __('site.b2_title'))
@section('description', __('site.b2_desc'))

@section('content')
<div class="page">
    <h1>{{ __('site.b2_h1_a') }} <span class="o">{{ __('site.b2_h1_b') }}</span> {{ __('site.b2_h1_c') }}</h1>
    <div class="rule" aria-hidden="true"></div>
    <p class="lede">{{ __('site.b2_lede') }}</p>

    <h2>{{ __('site.b2_s1_t') }}</h2>
    <p>
        {{ __('site.b2_s1_p1') }}
    </p>
    <p>
        {{ __('site.b2_s1_p2') }}
    </p>
    <p>
        {{ __('site.b2_s1_p3') }}
    </p>

    <h2>{{ __('site.b2_s2_t') }}</h2>
    <ul>
        <li><strong>{{ __('site.b2_s2_li1_b') }}</strong> {{ __('site.b2_s2_li1') }}</li>
        <li><strong>{{ __('site.b2_s2_li2_b') }}</strong> {{ __('site.b2_s2_li2') }}</li>
        <li><strong>{{ __('site.b2_s2_li3_b') }}</strong> {{ __('site.b2_s2_li3') }}</li>
        <li><strong>{{ __('site.b2_s2_li4_b') }}</strong> {{ __('site.b2_s2_li4') }}</li>
    </ul>

    <h2>{{ __('site.b2_s3_t') }}</h2>
    <p>
        {{ __('site.b2_s3_p') }}
    </p>

    <h2>{{ __('site.b2_s4_t') }}</h2>
    <p>
        {{ __('site.b2_s4_p') }}
    </p>

    <div class="card">
        <h3>{{ __('site.b2_card_t') }}</h3>
        <p>
            {{ __('site.b2_card_d') }}
        </p>
        <p><a class="btn btn-accent" href="{{ route('app.download') }}">{{ __('site.b2_card_btn') }}</a></p>
    </div>

    <h2>{{ __('site.blog_more') }}</h2>
    <ul>
        <li><a href="{{ url('blog/why-recipe-times-lie') }}">{{ __('site.blog_card1_t') }}</a></li>
        <li><a href="{{ url('blog/plan-backwards-from-maghrib') }}">{{ __('site.blog_card3_t') }}</a></li>
        <li><a href="{{ route('pages.blog') }}">{{ __('site.blog_all') }}</a></li>
    </ul>
</div>
@endsection
