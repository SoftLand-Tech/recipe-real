@extends('layouts.page')

@section('title', __('site.careers_title'))
@section('description', __('site.careers_desc'))

@section('content')
<div class="page">
    <h1>{{ __('site.careers_h1') }}</h1>
    <div class="rule" aria-hidden="true"></div>
    <p class="lede">
        {{ __('site.careers_lede') }}
    </p>

    <h2>{{ __('site.careers_small_t') }}</h2>
    <p>
        {{ __('site.careers_small_d') }}
    </p>

    <h2>{{ __('site.careers_look_t') }}</h2>
    <ul>
        <li><strong>{{ __('site.careers_look1') }}</strong> {{ __('site.careers_look1_d') }}</li>
        <li><strong>{{ __('site.careers_look2') }}</strong> {{ __('site.careers_look2_d') }}</li>
        <li><strong>{{ __('site.careers_look3') }}</strong> {{ __('site.careers_look3_d') }}</li>
    </ul>

    <h2>{{ __('site.careers_loop_t') }}</h2>
    <p>
        {{ __('site.careers_loop_a') }}
        <a href="{{ route('pages.contact') }}">{{ __('site.careers_loop_link') }}</a> —
        {{ __('site.careers_loop_b') }}
    </p>
</div>
@endsection
