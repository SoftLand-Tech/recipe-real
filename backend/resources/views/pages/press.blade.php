@extends('layouts.page')

@section('title', __('site.press_title'))
@section('description', __('site.press_desc'))

@section('content')
<div class="page">
    <h1>{{ __('site.press_h1') }}</h1>
    <div class="rule" aria-hidden="true"></div>
    <p class="lede">
        {{ __('site.press_lede') }}
    </p>

    <h2>{{ __('site.press_about_t') }}</h2>

    <div class="card">
        <h3>{{ __('site.press_short_t') }}</h3>
        <p>
            {{ __('site.press_short_d') }}
        </p>
    </div>

    <div class="card">
        <h3>{{ __('site.press_long_t') }}</h3>
        <p>
            {{ __('site.press_long_p1') }}
        </p>
        <p>
            {{ __('site.press_long_p2') }}
        </p>
        <p>
            {{ __('site.press_long_p3') }}
        </p>
    </div>

    <h2>{{ __('site.press_facts_t') }}</h2>
    <table>
        <tr>
            <th>{{ __('site.press_f_product') }}</th>
            <td>{{ __('site.press_f_product_v') }}</td>
        </tr>
        <tr>
            <th>{{ __('site.press_f_library') }}</th>
            <td>{{ __('site.press_f_library_v') }}</td>
        </tr>
        <tr>
            <th>{{ __('site.press_f_times') }}</th>
            <td>{{ __('site.press_f_times_v') }}</td>
        </tr>
        <tr>
            <th>{{ __('site.press_f_halal') }}</th>
            <td>{{ __('site.press_f_halal_v') }}</td>
        </tr>
        <tr>
            <th>{{ __('site.press_f_lang') }}</th>
            <td>{{ __('site.press_f_lang_v') }}</td>
        </tr>
        <tr>
            <th>{{ __('site.press_f_offline') }}</th>
            <td>{{ __('site.press_f_offline_v') }}</td>
        </tr>
        <tr>
            <th>{{ __('site.press_f_community') }}</th>
            <td>{{ __('site.press_f_community_v') }}</td>
        </tr>
        <tr>
            <th>{{ __('site.press_f_pricing') }}</th>
            <td>{{ __('site.press_f_pricing_v') }}</td>
        </tr>
        <tr>
            <th>{{ __('site.press_f_platform') }}</th>
            <td>{{ __('site.press_f_platform_v') }}</td>
        </tr>
        <tr>
            <th>{{ __('site.press_f_dist') }}</th>
            <td>{{ __('site.press_f_dist_v') }}</td>
        </tr>
        <tr>
            <th>{{ __('site.press_f_team') }}</th>
            <td>{{ __('site.press_f_team_v') }}</td>
        </tr>
    </table>

    <h2>{{ __('site.press_assets_t') }}</h2>
    <p>
        {{ __('site.press_assets_a') }}
        <a href="https://recipe-real.softland.tech/img/recipereallogo.webp">recipe-real.softland.tech/img/recipereallogo.webp</a>.
        {{ __('site.press_assets_b') }}
    </p>

    <h2>{{ __('site.press_inq_t') }}</h2>
    <p>
        {{ __('site.press_inq_a') }}
        <a href="{{ route('pages.contact') }}">{{ __('site.press_inq_link') }}</a>. {{ __('site.press_inq_b') }}
        <a href="{{ route('pages.blog') }}">{{ __('site.press_inq_blog') }}</a>.
    </p>
</div>
@endsection
