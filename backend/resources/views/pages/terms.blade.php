@extends('layouts.page')

@section('title', 'Terms of Service — RecipeReal')
@section('description', 'The terms of service for RecipeReal in plain language: accounts, acceptable use, your content, purchases, and our halal screening disclaimer. Effective August 2026.')

@section('content')
<div class="page">
    <h1>Terms of <span class="o">Service</span></h1>
    <div class="rule" aria-hidden="true"></div>
    <p class="lede">
        The rules for using RecipeReal, written to be read by a person, not
        a lawyer. An Arabic summary follows the English text.
    </p>
    <p style="margin: -18px 0 26px; font-size: 14px; color: var(--faint); font-weight: 600;">
        Effective August 2026.
    </p>

    <h2>1. Accepting these terms</h2>
    <p>
        By using RecipeReal — the app, this website, or an account with
        either — you agree to these terms. If you do not agree, please do
        not use the service.
    </p>

    <h2>2. The service</h2>
    <p>
        RecipeReal is a halal-only recipe app for Android: a screened
        library of about 20,089 recipes in English and Arabic, guided Cook
        Mode with measured cook times, an offline library, and a community
        where cooks share posts, likes, and comments. We may add, change, or
        remove features as the product grows.
    </p>

    <h2>3. Your account</h2>
    <p>
        You are responsible for keeping your sign-in details safe and for
        the activity on your account. Give accurate information, do not
        share your account, and tell us if you think someone else has used
        it. You can delete your account at any time from Settings in the app
        (Danger zone); deleting it removes your data.
    </p>

    <h2>4. Acceptable use</h2>
    <p>
        RecipeReal is built around a halal standard and a decent community.
        Do not post content that is unlawful, promotes what is haram, or is
        abusive, harassing, hateful, or misleading. Do not try to break the
        service, scrape it aggressively, or use it to spam other cooks. We
        may remove content or accounts that break these rules.
    </p>

    <h2>5. Your content</h2>
    <p>
        What you post — posts, photos, comments, notes, and your own recipes
        — stays yours. You only give us permission to host it, display it,
        and make it work inside the service (for example, showing your post
        on its public share page). That permission ends when you delete the
        content or your account.
    </p>

    <h2>6. Purchases and subscriptions</h2>
    <p>
        RecipeReal is free to use with a monthly recipe allowance. Premium
        costs US $5.99/month or $49.99/year and adds unlimited cooking and
        pace calibration. Premium is bought inside the app — nothing is
        sold or purchased on this website. Checkout is rolling out now and
        is not yet live in every build. Prices are in US dollars, and once
        checkout is live you can cancel your subscription at any time.
    </p>

    <h2>7. Halal screening disclaimer</h2>
    <p>
        Every recipe is screened against explicit pork and alcohol rules,
        and we take that seriously. But screening is a careful process, not
        a guarantee: brands and ingredients change, and kitchens differ.
        When in doubt, verify the ingredients and products you use.
    </p>

    <h2>8. Offline use</h2>
    <p>
        The library downloads to your phone so you can browse and cook with
        no signal. Downloads are for your own use in the app — please do not
        redistribute the content.
    </p>

    <h2>9. Limitation of liability</h2>
    <p>
        RecipeReal is provided "as is". We work hard to make it accurate,
        safe, and available, but we do not promise it will be perfect or
        uninterrupted, and we are not liable for losses or damages that come
        from using it — including a dinner that ran long. Some places do not
        allow certain limits, so parts of this section may not apply to you.
    </p>

    <h2>10. Changes to these terms</h2>
    <p>
        We may update these terms as the product changes. When we do, we
        will update this page and the effective date at the top. Continuing
        to use RecipeReal after a change means you accept the updated terms.
    </p>

    <h2>11. Contact</h2>
    <p>
        Questions about these terms? Reach us on the
        <a href="{{ route('pages.contact') }}">contact page</a> — a person
        reads every message.
    </p>

    <div class="ar" dir="rtl">
        <h2>ملخص الشروط بالعربية</h2>
        <p>
            خلاصة موجزة بما سبق. النص الإنجليزي أعلاه هو المرجع المعتمد.
        </p>
        <ul>
            <li>باستخدامك لتطبيق RecipeReal فأنت توافق على هذه الشروط.</li>
            <li>التطبيق مكتبة وصفات «حلال فقط»؛ نستبعد لحم الخنزير والكحول صراحةً من المكتبة كلها.</li>
            <li>حسابك مسؤوليتك: احفظ بيانات دخولك، ويمكنك حذف حسابك وبياناتك من إعدادات التطبيق.</li>
            <li>يُمنع نشر أي محتوى غير قانوني أو مكافٍ للحلال أو مسيء أو مضلل، ويُمنع إساءة استخدام الخدمة أو مجتمعها.</li>
            <li>المحتوى الذي تنشره يبقى ملكك، وتمنحنا فقط حق استضافته وعرضه داخل التطبيق، وتنتهي هذه الإجازة بحذف المحتوى أو الحساب.</li>
            <li>الاشتراك المميز: 5.99 دولار أمريكي شهرياً أو 49.99 دولاراً سنوياً، ويُشترى من داخل التطبيق فقط — لا يُباع شيء على هذا الموقع.</li>
            <li>الدفع يُطرح تدريجياً حالياً وليس متاحاً في كل النسخ بعد، والأسعار بالدولار الأمريكي، ويمكنك إلغاء اشتراكك في أي وقت متى صار متاحاً.</li>
            <li>نُرشّح الوصفات بعناية وفق معيار الحلال، لكن عند الشك تحقّق من المكوّنات والمنتجات بنفسك.</li>
            <li>تُنزَّل المكتبة على هاتفك ويعمل الطهي دون اتصال بالإنترنت، والمحتوى لاستخدامك الشخصي داخل التطبيق.</li>
            <li>الخدمة مقدَّمة «كما هي» دون ضمانات، وتقتصر مسؤوليتنا على الحد الذي يسمح به القانون.</li>
            <li>قد نُحدِّث هذه الشروط من وقت لآخر، وسيظهر تاريخ آخر تحديث أعلى هذه الصفحة.</li>
            <li>لأي سؤال تواصل معنا عبر صفحة الاتصال، ويقرأ فريقنا كل رسالة.</li>
        </ul>
    </div>
</div>
@endsection
