{{-- Shared site nav. Works on the landing (section anchors) and on
     subpages (anchors route home first). Fully translatable + RTL-ready. --}}
@php
    $home = request()->path() === '/';
    $anchor = function (string $id) use ($home) {
        return $home ? '#'.$id : url('/').'#'.$id;
    };
@endphp
<div class="nav">
    <div class="wrap nav-inner">
        <a class="brand" href="{{ url('/') }}" aria-label="{{ __('site.nav_home_aria') }}">
            <img class="brand-mark" src="/img/recipereallogo.webp" alt="" width="34" height="34">
            <b>Recipe<em>Real</em></b>
        </a>
        <nav class="nav-links" aria-label="{{ __('site.nav_site_label') }}">
            <a href="{{ url('/') }}" @if ($home) class="active" @endif>{{ __('site.nav_home') }}</a>
            <a href="{{ $anchor('features') }}">{{ __('site.nav_features') }}</a>
            <a href="{{ $anchor('how') }}">{{ __('site.nav_how') }}</a>
            <a href="{{ $anchor('recipes') }}">{{ __('site.nav_recipes') }}</a>
            <a href="{{ $anchor('community') }}">{{ __('site.nav_community') }}</a>
            <a href="{{ route('pages.pricing') }}">{{ __('site.nav_pricing') }}</a>
            <a href="{{ $anchor('download') }}" class="btn btn-accent">{{ __('site.nav_get_app') }}</a>
            @include('partials.lang-switcher')
        </nav>
    </div>
</div>
