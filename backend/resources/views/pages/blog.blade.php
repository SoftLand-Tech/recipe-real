@extends('layouts.page')

@section('title', __('site.blog_title'))
@section('description', __('site.blog_desc'))

@section('content')
<div class="page">
    <h1>{{ __('site.blog_h1') }}</h1>
    <div class="rule" aria-hidden="true"></div>
    <p class="lede">{{ __('site.blog_lede') }}</p>

    <div class="grid g3">
        <div class="card">
            <span class="pill">{{ __('site.blog_pill_honest') }}</span>
            <h3><a href="{{ url('blog/why-recipe-times-lie') }}">{{ __('site.blog_card1_t') }}</a></h3>
            <p>{{ __('site.blog_card1_d') }}</p>
        </div>
        <div class="card">
            <span class="pill">{{ __('site.blog_pill_planning') }}</span>
            <h3><a href="{{ url('blog/where-the-time-goes') }}">{{ __('site.blog_card2_t') }}</a></h3>
            <p>{{ __('site.blog_card2_d') }}</p>
        </div>
        <div class="card">
            <span class="pill">{{ __('site.blog_pill_ramadan') }}</span>
            <h3><a href="{{ url('blog/plan-backwards-from-maghrib') }}">{{ __('site.blog_card3_t') }}</a></h3>
            <p>{{ __('site.blog_card3_d') }}</p>
        </div>
    </div>
</div>
@endsection
