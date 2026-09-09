{{-- Shared site footer — every link is real. Fully translatable. --}}
@php
    $home = request()->path() === '/';
    $anchor = function (string $id) use ($home) {
        return $home ? '#'.$id : url('/').'#'.$id;
    };
@endphp
<footer>
    <div class="wrap">
        <div class="foot-grid">
            <div class="foot-brand">
                <a class="brand" href="{{ url('/') }}">
                    <img class="brand-mark" src="/img/recipereallogo.webp" alt="" width="34" height="34">
                    <b>Recipe<em>Real</em></b>
                </a>
                <p>{{ __('site.foot_tag') }}</p>
            </div>
            <nav class="foot-col" aria-label="{{ __('site.foot_explore') }}">
                <h4>{{ __('site.foot_explore') }}</h4>
                <a href="{{ $anchor('recipes') }}">{{ __('site.nav_recipes') }}</a>
                <a href="{{ $anchor('how') }}">{{ __('site.nav_how') }}</a>
                <a href="{{ $anchor('features') }}">{{ __('site.nav_features') }}</a>
                <a href="{{ route('pages.pricing') }}">{{ __('site.nav_pricing') }}</a>
                <a href="{{ route('pages.blog') }}">{{ __('site.foot_blog') }}</a>
            </nav>
            <nav class="foot-col" aria-label="{{ __('site.foot_resources') }}">
                <h4>{{ __('site.foot_resources') }}</h4>
                <a href="{{ route('pages.tips') }}">{{ __('site.foot_tips') }}</a>
                <a href="{{ route('pages.help') }}">{{ __('site.foot_help') }}</a>
                <a href="{{ route('pages.contact') }}">{{ __('site.foot_contact') }}</a>
                <a href="{{ url('/privacy') }}">{{ __('site.foot_privacy') }}</a>
                <a href="{{ route('pages.terms') }}">{{ __('site.foot_terms') }}</a>
            </nav>
            <nav class="foot-col" aria-label="{{ __('site.foot_company') }}">
                <h4>{{ __('site.foot_company') }}</h4>
                <a href="{{ route('pages.about') }}">{{ __('site.foot_about') }}</a>
                <a href="{{ route('pages.careers') }}">{{ __('site.foot_careers') }}</a>
                <a href="{{ route('pages.press') }}">{{ __('site.foot_press') }}</a>
            </nav>
        </div>
        <div class="foot-bottom">
            <span>© {{ date('Y') }} RecipeReal. {{ __('site.foot_rights') }}</span>
            <span><a href="{{ url('/privacy') }}">{{ __('site.foot_privacy_short') }}</a></span>
        </div>
    </div>
</footer>
