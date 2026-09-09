@extends('layouts.page')

@section('title', __('site.b3_title'))
@section('description', __('site.b3_desc'))

@section('content')
<div class="page">
    <h1>{{ __('site.b3_h1_a') }} <span class="o">{{ __('site.b3_h1_b') }}</span></h1>
    <div class="rule" aria-hidden="true"></div>
    <p class="lede">{{ __('site.b3_lede') }}</p>

    <blockquote>
        {{ __('site.b3_quote') }}
    </blockquote>

    <h2>{{ __('site.b3_s1_t') }}</h2>
    <p>
        {{ __('site.b3_s1_p') }}
    </p>

    <h2>{{ __('site.b3_s2_t') }}</h2>
    <p>
        {{ __('site.b3_s2_p1') }}
    </p>
    <p>
        {{ __('site.b3_s2_p2_a') }} <em>{{ __('site.b3_s2_em') }}</em>{{ __('site.b3_s2_p2_b') }}
    </p>

    <h2>{{ __('site.b3_s3_t') }}</h2>
    <p>
        {{ __('site.b3_s3_p') }}
    </p>

    <h2>{{ __('site.b3_s4_t') }}</h2>
    <p>
        {{ __('site.b3_s4_p') }}
    </p>

    <h2>{{ __('site.b3_s5_t') }}</h2>
    <p>
        {{ __('site.b3_s5_p') }}
    </p>

    <div class="card">
        <h3>{{ __('site.b3_card_t') }}</h3>
        <p>
            {{ __('site.b3_card_d') }}
        </p>
        <p><a class="btn btn-accent" href="{{ route('app.download') }}">{{ __('site.b3_card_btn') }}</a></p>
    </div>

    <h2>{{ __('site.blog_more') }}</h2>
    <ul>
        <li><a href="{{ url('blog/why-recipe-times-lie') }}">{{ __('site.blog_card1_t') }}</a></li>
        <li><a href="{{ url('blog/where-the-time-goes') }}">{{ __('site.blog_card2_t') }}</a></li>
        <li><a href="{{ route('pages.blog') }}">{{ __('site.blog_all') }}</a></li>
    </ul>
</div>
@endsection
