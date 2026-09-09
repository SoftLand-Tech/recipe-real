@extends('layouts.page')

@section('title', __('site.pricing_title'))
@section('description', __('site.pricing_desc'))

@section('content')
<div class="page">
    <h1>{{ __('site.pricing_h1_a') }} <span class="o">{{ __('site.pricing_h1_b') }}</span></h1>
    <div class="rule" aria-hidden="true"></div>
    <p class="lede">
        {{ __('site.pricing_lede') }}
    </p>

    <div class="grid g2">
        <div class="card">
            <h2>{{ __('site.pricing_free_t') }}</h2>
            <p><strong>$0</strong>{{ __('site.pricing_free_suffix') }}</p>
            <ul>
                <li>{{ __('site.pricing_free1') }}</li>
                <li>{{ __('site.pricing_free2') }}</li>
                <li>{{ __('site.pricing_free3') }}</li>
                <li>{{ __('site.pricing_free4') }}</li>
            </ul>
        </div>
        <div class="card">
            <h2>{{ __('site.pricing_premium_t') }}</h2>
            <p><strong>{{ __('site.pricing_premium_price') }}</strong> {{ __('site.pricing_premium_or') }} <strong>{{ __('site.pricing_premium_year') }}</strong></p>
            <p><span class="pill">{{ __('site.pricing_rolling') }}</span></p>
            <ul>
                <li>{{ __('site.pricing_prem1') }}</li>
                <li>{{ __('site.pricing_prem2') }}</li>
                <li>{{ __('site.pricing_prem3') }}</li>
            </ul>
        </div>
    </div>

    <h2>{{ __('site.pricing_side_t') }}</h2>
    <table>
        <thead>
            <tr>
                <th scope="col">{{ __('site.pricing_col_what') }}</th>
                <th scope="col">{{ __('site.pricing_col_free') }}</th>
                <th scope="col">{{ __('site.pricing_col_prem') }}</th>
            </tr>
        </thead>
        <tbody>
            <tr>
                <td>{{ __('site.pricing_row_library') }}</td>
                <td><b>{{ __('site.pricing_yes') }}</b></td>
                <td><b>{{ __('site.pricing_yes') }}</b></td>
            </tr>
            <tr>
                <td>{{ __('site.pricing_row_cook') }}</td>
                <td><b>{{ __('site.pricing_yes') }}</b></td>
                <td><b>{{ __('site.pricing_yes') }}</b></td>
            </tr>
            <tr>
                <td>{{ __('site.pricing_row_permonth') }}</td>
                <td>{{ __('site.pricing_allowance') }}</td>
                <td><b>{{ __('site.pricing_unlimited') }}</b></td>
            </tr>
            <tr>
                <td>{{ __('site.pricing_row_offline') }}</td>
                <td><b>{{ __('site.pricing_yes') }}</b></td>
                <td><b>{{ __('site.pricing_yes') }}</b></td>
            </tr>
            <tr>
                <td>{{ __('site.pricing_row_pace') }}</td>
                <td>—</td>
                <td><b>{{ __('site.pricing_yes') }}</b></td>
            </tr>
        </tbody>
    </table>

    <h2>{{ __('site.pricing_details_t') }}</h2>
    <ul>
        <li><strong>{{ __('site.pricing_d1_b') }}</strong> {{ __('site.pricing_d1') }}</li>
        <li><strong>{{ __('site.pricing_d2_b') }}</strong> {{ __('site.pricing_d2') }}</li>
        <li><strong>{{ __('site.pricing_d3_b') }}</strong> {{ __('site.pricing_d3') }}</li>
        <li><strong>{{ __('site.pricing_d4_b') }}</strong> {{ __('site.pricing_d4') }}</li>
    </ul>

    <h2>{{ __('site.pricing_get_t') }}</h2>
    <p>
        {{ __('site.pricing_get_d') }}
    </p>
    <p>
        <a class="btn btn-accent" href="{{ route('app.download') }}">{{ __('site.pricing_get_btn') }}</a>
    </p>
</div>
@endsection
