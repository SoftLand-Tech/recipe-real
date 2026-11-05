@extends('layouts.page')

@section('title', __('site.terms_title'))
@section('description', __('site.terms_desc'))

@section('content')
<div class="page">
    <h1>{{ __('site.terms_h1_a') }} <span class="o">{{ __('site.terms_h1_b') }}</span></h1>
    <div class="rule" aria-hidden="true"></div>
    <p class="lede">
        {{ __('site.terms_lede') }}
    </p>
    <p style="margin: -18px 0 26px; font-size: 14px; color: var(--faint); font-weight: 600;">
        {{ __('site.terms_effective') }}
    </p>

    <h2>{{ __('site.terms1_t') }}</h2>
    <p>
        {{ __('site.terms1_d') }}
    </p>

    <h2>{{ __('site.terms2_t') }}</h2>
    <p>
        {{ __('site.terms2_d') }}
    </p>

    <h2>{{ __('site.terms3_t') }}</h2>
    <p>
        {{ __('site.terms3_d') }}
    </p>

    <h2>{{ __('site.terms4_t') }}</h2>
    <p>
        {{ __('site.terms4_d') }}
    </p>

    <h2>{{ __('site.terms5_t') }}</h2>
    <p>
        {{ __('site.terms5_d') }}
    </p>

    <h2>{{ __('site.terms6_t') }}</h2>
    <p>
        {{ __('site.terms6_d') }}
    </p>

    <h2>{{ __('site.terms7_t') }}</h2>
    <p>
        {{ __('site.terms7_d') }}
    </p>

    <h2>{{ __('site.terms8_t') }}</h2>
    <p>
        {{ __('site.terms8_d') }}
    </p>

    <h2>{{ __('site.terms9_t') }}</h2>
    <p>
        {{ __('site.terms9_d') }}
    </p>

    <h2>{{ __('site.terms10_t') }}</h2>
    <p>
        {{ __('site.terms10_d') }}
    </p>

    <h2>{{ __('site.terms11_t') }}</h2>
    <p>
        {{ __('site.terms11_a') }}
        <a href="{{ route('pages.contact') }}">{{ __('site.terms11_link') }}</a> — {{ __('site.terms11_b') }}
    </p>

    @if (app()->getLocale() === 'en')
        <div class="ar" dir="rtl">
            <h2>{{ __('site.terms_ar_t', [], 'ar') }}</h2>
            <p>
                خلاصة موجزة بما سبق. النص الإنجليزي أعلاه هو المرجع المعتمد.
            </p>
            <ul>
                <li>باستخدامك لتطبيق RecipeReal فأنت توافق على هذه الشروط.</li>
                <li>حسابك مسؤوليتك: احفظ بيانات دخولك، ويمكنك حذف حسابك وبياناتك من إعدادات التطبيق.</li>
                <li>يُمنع نشر أي محتوى غير قانوني أو ضار أو مسيء أو مضلل، ويُمنع إساءة استخدام الخدمة أو مجتمعها.</li>
                <li>المحتوى الذي تنشره يبقى ملكك، وتمنحنا فقط حق استضافته وعرضه داخل التطبيق، وتنتهي هذه الإجازة بحذف المحتوى أو الحساب.</li>
                <li>الاشتراك المميز: 5.99 دولار أمريكي شهرياً أو 49.99 دولاراً سنوياً، ويُشترى من داخل التطبيق فقط — لا يُباع شيء على هذا الموقع.</li>
                <li>الدفع يُطرح تدريجياً حالياً وليس متاحاً في كل النسخ بعد، والأسعار بالدولار الأمريكي، ويمكنك إلغاء اشتراكك في أي وقت متى صار متاحاً.</li>
                <li>الوصفات تأتي من مصادر متعددة؛ تحقّق دائمًا من المكونات والملصقات بنفسك.</li>
                <li>تُنزَّل المكتبة على هاتفك ويعمل الطهي دون اتصال بالإنترنت، والمحتوى لاستخدامك الشخصي داخل التطبيق.</li>
                <li>الخدمة مقدَّمة «كما هي» دون ضمانات، وتقتصر مسؤوليتنا على الحد الذي يسمح به القانون.</li>
                <li>قد نُحدِّث هذه الشروط من وقت لآخر، وسيظهر تاريخ آخر تحديث أعلى هذه الصفحة.</li>
                <li>لأي سؤال تواصل معنا عبر صفحة الاتصال، ويقرأ فريقنا كل رسالة.</li>
            </ul>
        </div>
    @endif
</div>
@endsection
