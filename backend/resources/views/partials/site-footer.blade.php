{{-- Shared site footer — every link is real. --}}
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
                <p>Accurate recipes. Real cooking times. Real results.</p>
            </div>
            <nav class="foot-col" aria-label="Explore">
                <h4>Explore</h4>
                <a href="{{ $anchor('recipes') }}">Recipes</a>
                <a href="{{ $anchor('how') }}">How It Works</a>
                <a href="{{ $anchor('features') }}">Features</a>
                <a href="{{ route('pages.pricing') }}">Pricing</a>
                <a href="{{ route('pages.blog') }}">Blog</a>
            </nav>
            <nav class="foot-col" aria-label="Resources">
                <h4>Resources</h4>
                <a href="{{ route('pages.tips') }}">Cooking Tips</a>
                <a href="{{ route('pages.help') }}">Help Center</a>
                <a href="{{ route('pages.contact') }}">Contact Us</a>
                <a href="{{ url('/privacy') }}">Privacy Policy</a>
                <a href="{{ route('pages.terms') }}">Terms of Service</a>
            </nav>
            <nav class="foot-col" aria-label="Company">
                <h4>Company</h4>
                <a href="{{ route('pages.about') }}">About Us</a>
                <a href="{{ route('pages.careers') }}">Careers</a>
                <a href="{{ route('pages.press') }}">Press Kit</a>
            </nav>
        </div>
        <div class="foot-bottom">
            <span>© {{ date('Y') }} RecipeReal. All rights reserved.</span>
            <span><a href="{{ url('/privacy') }}">Privacy</a></span>
        </div>
    </div>
</footer>
