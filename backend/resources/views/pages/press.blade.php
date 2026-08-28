@extends('layouts.page')

@section('title', 'Press Kit — RecipeReal')
@section('description', 'Press kit for RecipeReal: short and long boilerplate, a fact sheet, and brand assets for the halal-only Android recipe app with honest cook times.')

@section('content')
<div class="page">
    <h1>Press Kit</h1>
    <div class="rule" aria-hidden="true"></div>
    <p class="lede">
        Everything you need to write about RecipeReal: what it is, the facts
        as they stand today, and where to find the art. For anything else,
        write to us through the contact page.
    </p>

    <h2>About RecipeReal</h2>

    <div class="card">
        <h3>Short version</h3>
        <p>
            RecipeReal is a halal-only, bilingual (English/Arabic) Android
            recipe app built around honest cook times. Its guided Cook Mode
            times real cooks step by step, shows the claimed time next to
            what the recipe really takes, and calibrates every estimate to
            each cook's pace. The library holds around 20,089 recipes,
            downloads to the phone for offline use, and is free to start.
        </p>
    </div>

    <div class="card">
        <h3>Long version</h3>
        <p>
            Recipes habitually claim times that sound better than reality,
            and home cooks pay for it in lost evenings. RecipeReal treats
            time as data. In Cook Mode — a full-screen, step-by-step guide
            with a stopwatch, step alarms, and pause/resume — the app
            measures what real cooks actually spend on a recipe, shows the
            claim next to the measured reality, and calibrates every estimate
            to the individual cook's pace.
        </p>
        <p>
            The product is halal-first: every recipe is screened against
            explicit pork and alcohol rules before it reaches the app. The
            library — around 20,089 recipes and 137,644 steps — speaks
            English and Arabic with full right-to-left support, and downloads
            to the phone so cooking works with no signal. A community of
            cooks shares what they tried, and their measurements keep
            sharpening the estimates for everyone.
        </p>
        <p>
            RecipeReal is built and run by a one-person team. It offers a
            free tier, with Premium at US $5.99/month or $49.99/year rolling
            out. The app runs on Android 7.0 and up and is distributed as a
            direct APK download — it is not on Google Play or the App Store.
        </p>
    </div>

    <h2>Fact sheet</h2>
    <table>
        <tr>
            <th>Product</th>
            <td>RecipeReal — a halal-only Android recipe app with honest, measured cook times</td>
        </tr>
        <tr>
            <th>Library</th>
            <td>~20,089 recipes, 137,644 steps</td>
        </tr>
        <tr>
            <th>Cook times</th>
            <td>Measured in guided Cook Mode; claim shown next to "Really takes"; calibrated to each cook's pace</td>
        </tr>
        <tr>
            <th>Halal screening</th>
            <td>Every recipe screened against explicit pork and alcohol rules before it reaches the app</td>
        </tr>
        <tr>
            <th>Languages</th>
            <td>English and Arabic, with right-to-left (RTL) support</td>
        </tr>
        <tr>
            <th>Offline</th>
            <td>The library downloads to the phone; cooking works with no signal</td>
        </tr>
        <tr>
            <th>Community</th>
            <td>Cooks share what they tried; their measurements sharpen the estimates</td>
        </tr>
        <tr>
            <th>Pricing</th>
            <td>Free tier; Premium US $5.99/month or $49.99/year (rolling out)</td>
        </tr>
        <tr>
            <th>Platform</th>
            <td>Android 7.0 and up</td>
        </tr>
        <tr>
            <th>Distribution</th>
            <td>Direct APK download — not on Google Play or the App Store</td>
        </tr>
        <tr>
            <th>Team</th>
            <td>One person</td>
        </tr>
    </table>

    <h2>Brand and art assets</h2>
    <p>
        The RecipeReal app icon and logo are available as a single asset:
        <a href="https://recipe-real.softland.tech/img/recipereallogo.webp">recipe-real.softland.tech/img/recipereallogo.webp</a>.
        Please use it as provided — no recoloring, stretching, or added
        effects.
    </p>

    <h2>Press inquiries</h2>
    <p>
        We do not have a separate press address — everything comes through
        the <a href="{{ route('pages.contact') }}">contact page</a>. Tell us
        what you are working on and your deadline, and we will get back to
        you. Product updates and notes from the build are posted on the
        <a href="{{ route('pages.blog') }}">blog</a>.
    </p>
</div>
@endsection
