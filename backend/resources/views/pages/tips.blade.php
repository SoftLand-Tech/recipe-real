@extends('layouts.page')

@section('title', __('site.tips_title'))
@section('description', __('site.tips_desc'))

@section('content')
<div class="page">
    <h1>{{ __('site.tips_h1') }}</h1>
    <div class="rule" aria-hidden="true"></div>
    <p class="lede">{{ __('site.tips_lede') }}</p>

    <h2>{{ __('site.tips_before_t') }}</h2>
    <ul>
        <li>{{ __('site.tips_before1_a') }} <a href="{{ url('blog/why-recipe-times-lie') }}">{{ __('site.tips_before1_link') }}</a>.</li>
        <li>{{ __('site.tips_before2') }}</li>
        <li>{{ __('site.tips_before3') }}</li>
        <li>{{ __('site.tips_before4') }}</li>
    </ul>

    <h2>{{ __('site.tips_while_t') }}</h2>
    <ul>
        <li>{{ __('site.tips_while1') }}</li>
        <li>{{ __('site.tips_while2') }}</li>
        <li>{{ __('site.tips_while3_a') }} <a href="{{ url('blog/where-the-time-goes') }}">{{ __('site.tips_while3_link') }}</a></li>
        <li>{{ __('site.tips_while4') }}</li>
    </ul>

    <h2>{{ __('site.tips_after_t') }}</h2>
    <ul>
        <li>{{ __('site.tips_after1') }}</li>
        <li>{{ __('site.tips_after2_a') }} <a href="{{ route('app.download') }}">{{ __('site.tips_after2_link') }}</a> {{ __('site.tips_after2_b') }}</li>
    </ul>

    <h2>{{ __('site.tips_keep_t') }}</h2>
    <p>
        {{ __('site.tips_keep_a') }} <a href="{{ route('pages.blog') }}">{{ __('site.tips_keep_blog') }}</a> {{ __('site.tips_keep_b') }}
        <a href="{{ route('app.download') }}">{{ __('site.tips_keep_app') }}</a> {{ __('site.tips_keep_c') }}
    </p>
</div>
@endsection
