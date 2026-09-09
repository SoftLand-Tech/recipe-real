{{-- Language switcher: EN | عربي. Persists via ?lang= (session + cookie).
     Preserves the current path + query string, swapping only `lang`. --}}
@php
    $isAr = app()->getLocale() === 'ar';
    $switchQs = function (string $lang) {
        $qs = request()->query();
        $qs['lang'] = $lang;
        return http_build_query($qs);
    };
@endphp
@once
<style>
    .lang-switch { display: inline-flex; align-items: center; gap: 6px;
        font-size: 13px; font-weight: 800; flex: none; }
    .lang-switch a { text-decoration: none; color: inherit; opacity: .6;
        padding: 6px 10px; border-radius: 999px; border: 1px solid transparent;
        line-height: 1; white-space: nowrap; }
    .lang-switch a:hover { opacity: 1; border-color: currentColor; }
    .lang-switch a[aria-current="true"] { opacity: 1; background: rgba(127,127,127,.14);
        border-color: rgba(127,127,127,.35); }
    .lang-switch span { opacity: .4; }
    /* Small screens: collapse to a single toggle (the *other* language)
       so the brand + CTA + switcher fit on one line. */
    @media (max-width: 560px) {
        .lang-switch { gap: 0; font-size: 12px; }
        .lang-switch a { padding: 6px 9px; }
        .lang-switch a[aria-current="true"], .lang-switch > span { display: none; }
    }
</style>
@endonce
<div class="lang-switch" role="group" aria-label="{{ __('site.lang_label') }}">
    <a href="{{ request()->url().'?'.$switchQs('en') }}"
       @if (! $isAr) aria-current="true" @endif
       hreflang="en" lang="en">EN</a>
    <span aria-hidden="true">·</span>
    <a href="{{ request()->url().'?'.$switchQs('ar') }}"
       @if ($isAr) aria-current="true" @endif
       hreflang="ar" lang="ar">عربي</a>
</div>
