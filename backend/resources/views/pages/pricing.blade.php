@extends('layouts.page')

@section('title', 'Simple pricing — RecipeReal')
@section('description', 'RecipeReal is free to use with a monthly recipe allowance. Premium is US $5.99/month or $49.99/year for unlimited cooking and pace calibration — checkout is rolling out now.')

@section('content')
<div class="page">
    <h1>Simple <span class="o">pricing</span></h1>
    <div class="rule" aria-hidden="true"></div>
    <p class="lede">
        One free tier that is genuinely useful, and one optional
        subscription. No ads, no tiers in between, nothing sneaky.
    </p>

    <div class="grid g2">
        <div class="card">
            <h2>Free</h2>
            <p><strong>$0</strong>, forever. The honest core of the app.</p>
            <ul>
                <li>Browse the full halal library — about 20,089 recipes</li>
                <li>Guided Cook Mode with the step stopwatch</li>
                <li>A monthly recipe allowance</li>
                <li>Offline library on your phone</li>
            </ul>
        </div>
        <div class="card">
            <h2>Premium</h2>
            <p><strong>US $5.99/month</strong> or <strong>$49.99/year</strong></p>
            <p><span class="pill">Rolling out now</span></p>
            <ul>
                <li>Unlimited cooking — no monthly allowance</li>
                <li>Pace calibration tuned to how you cook</li>
                <li>Supports a small, independent project</li>
            </ul>
        </div>
    </div>

    <h2>Side by side</h2>
    <table>
        <thead>
            <tr>
                <th scope="col">What you get</th>
                <th scope="col">Free</th>
                <th scope="col">Premium</th>
            </tr>
        </thead>
        <tbody>
            <tr>
                <td>Full halal library</td>
                <td><b>Yes</b></td>
                <td><b>Yes</b></td>
            </tr>
            <tr>
                <td>Guided Cook Mode</td>
                <td><b>Yes</b></td>
                <td><b>Yes</b></td>
            </tr>
            <tr>
                <td>Recipes per month</td>
                <td>Monthly allowance</td>
                <td><b>Unlimited</b></td>
            </tr>
            <tr>
                <td>Offline use</td>
                <td><b>Yes</b></td>
                <td><b>Yes</b></td>
            </tr>
            <tr>
                <td>Pace calibration</td>
                <td>—</td>
                <td><b>Yes</b></td>
            </tr>
        </tbody>
    </table>

    <h2>The honest details</h2>
    <ul>
        <li><strong>Prices are in US dollars.</strong> $5.99 per month or $49.99 per year, wherever you live.</li>
        <li><strong>Cancel anytime</strong> — once checkout is live in your build, you can cancel from inside the app and keep access until the end of your period.</li>
        <li><strong>Premium lives inside the app.</strong> Nothing is bought on this website — you will never enter card details here.</li>
        <li><strong>Checkout is rolling out now.</strong> It is not yet live in every build; if you do not see it yet, it is coming.</li>
    </ul>

    <h2>Get the app</h2>
    <p>
        Everything above — free and Premium alike — starts with installing
        RecipeReal on your Android phone (7.0 and up). It is a direct
        download, not a store listing.
    </p>
    <p>
        <a class="btn btn-accent" href="{{ route('app.download') }}">Get the app</a>
    </p>
</div>
@endsection
