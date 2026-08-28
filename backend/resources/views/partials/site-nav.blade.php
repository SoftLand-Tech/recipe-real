{{-- Shared site nav. Works on the landing (section anchors) and on
     subpages (anchors route home first). --}}
@php
    $home = request()->path() === '/';
    $anchor = function (string $id) use ($home) {
        return $home ? '#'.$id : url('/').'#'.$id;
    };
@endphp
<div class="nav">
    <div class="wrap nav-inner">
        <a class="brand" href="{{ url('/') }}" aria-label="RecipeReal home">
            <img class="brand-mark" src="/img/recipereallogo.webp" alt="" width="34" height="34">
            <b>Recipe<em>Real</em></b>
        </a>
        <nav class="nav-links" aria-label="Site">
            <a href="{{ url('/') }}" @if ($home) class="active" @endif>Home</a>
            <a href="{{ $anchor('features') }}">Features</a>
            <a href="{{ $anchor('how') }}">How It Works</a>
            <a href="{{ $anchor('recipes') }}">Recipes</a>
            <a href="{{ $anchor('community') }}">Community</a>
            <a href="{{ route('pages.pricing') }}">Pricing</a>
            <a href="{{ $anchor('download') }}" class="btn btn-accent">Get the App</a>
        </nav>
    </div>
</div>
