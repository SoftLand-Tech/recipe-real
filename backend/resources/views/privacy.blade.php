<!DOCTYPE html>
<html lang="{{ app()->getLocale() }}" dir="{{ app()->getLocale() === 'ar' ? 'rtl' : 'ltr' }}">
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>{{ __('site.privacy_title') }}</title>
        <meta name="description" content="{{ __('site.privacy_desc') }}">
        <link rel="alternate" hreflang="en" href="{{ request()->url().'?'.http_build_query(array_merge(request()->query(), ['lang' => 'en'])) }}">
        <link rel="alternate" hreflang="ar" href="{{ request()->url().'?'.http_build_query(array_merge(request()->query(), ['lang' => 'ar'])) }}">
        <link rel="alternate" hreflang="x-default" href="{{ request()->url() }}">
        <style>
            /* Scoped, self-contained page — system font, no external deps. */
            * {
                box-sizing: border-box;
            }
            body {
                margin: 0;
                background: #FBF8F3;
                color: #241D17;
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto,
                    Helvetica, Arial, sans-serif, "Apple Color Emoji",
                    "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji";
                line-height: 1.65;
                -webkit-font-smoothing: antialiased;
                -moz-osx-font-smoothing: grayscale;
            }
            [dir="rtl"] body, [dir="rtl"] h1, [dir="rtl"] h2 {
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Tahoma,
                    "Noto Sans Arabic", "Cairo", Roboto, Helvetica, Arial, sans-serif;
                letter-spacing: 0 !important;
            }
            main {
                max-width: 720px;
                margin: 0 auto;
                padding: 48px 20px 64px;
            }
            .brand {
                font-weight: 700;
                font-size: 1.2rem;
                letter-spacing: -0.02em;
                text-decoration: none;
                color: #241D17;
            }
            [dir="rtl"] .brand { letter-spacing: 0; }
            .brand span {
                color: #BF5523;
            }
            h1 {
                font-size: clamp(1.7rem, 4.5vw, 2.2rem);
                font-weight: 800;
                letter-spacing: -0.02em;
                line-height: 1.15;
                margin: 28px 0 6px;
            }
            .updated {
                color: #6E5F52;
                font-size: 0.92rem;
                margin: 0 0 8px;
            }
            .lede {
                color: #4A3F35;
                margin: 16px 0 0;
            }
            h2 {
                font-size: 1.22rem;
                font-weight: 700;
                letter-spacing: -0.01em;
                margin: 40px 0 10px;
                padding-top: 24px;
                border-top: 1px solid #EAE1D4;
            }
            h2:first-of-type {
                border-top: 0;
                padding-top: 0;
            }
            h2 .accent {
                color: #BF5523;
            }
            ul {
                margin: 10px 0;
                padding-inline-start: 22px;
            }
            li {
                margin: 6px 0;
            }
            li::marker {
                color: #BF5523;
            }
            strong {
                font-weight: 600;
            }
            a {
                color: #BF5523;
            }
            .never li::marker {
                content: "✕ ";
                color: #BF5523;
                font-size: 0.85em;
            }
            .card {
                background: #FFFDF9;
                border: 1px solid #EAE1D4;
                border-radius: 14px;
                padding: 18px 20px;
                margin: 14px 0;
            }
            .ar {
                direction: rtl;
                text-align: right;
            }
            .ar h2 {
                letter-spacing: 0;
            }
            .divider {
                border: 0;
                border-top: 1px solid #EAE1D4;
                margin: 52px 0 0;
            }
            .lang-row { display: flex; justify-content: flex-end; margin-top: 18px; }
            footer {
                color: #6E5F52;
                font-size: 0.88rem;
                margin-top: 24px;
            }
        </style>
    </head>
    <body>
        <main>
            <a class="brand" href="/">Recipe<span>Real</span></a>
            <div class="lang-row">@include('partials.lang-switcher')</div>

            <h1>{{ __('site.privacy_h1') }}</h1>
            <p class="updated">{{ __('site.privacy_updated') }}</p>

            <p class="lede">
                {{ __('site.privacy_lede') }}
            </p>

            <h2>{{ __('site.privacy_collect_t') }}</h2>
            <ul>
                <li><strong>{{ __('site.privacy_collect1_b') }}</strong> {{ __('site.privacy_collect1') }}</li>
                <li><strong>{{ __('site.privacy_collect2_b') }}</strong> {{ __('site.privacy_collect2') }}</li>
                <li><strong>{{ __('site.privacy_collect3_b') }}</strong> {{ __('site.privacy_collect3') }}</li>
                <li><strong>{{ __('site.privacy_collect4_b') }}</strong> {{ __('site.privacy_collect4') }}</li>
                <li><strong>{{ __('site.privacy_collect5_b') }}</strong> {{ __('site.privacy_collect5') }}</li>
                <li><strong>{{ __('site.privacy_collect6_b') }}</strong> {{ __('site.privacy_collect6') }}</li>
                <li><strong>{{ __('site.privacy_collect7_b') }}</strong> {{ __('site.privacy_collect7') }}</li>
                <li><strong>{{ __('site.privacy_collect8_b') }}</strong> {{ __('site.privacy_collect8') }}</li>
            </ul>

            <h2>{{ __('site.privacy_never_t_a') }} <span class="accent">{{ __('site.privacy_never_t_b') }}</span> {{ __('site.privacy_never_t_c') }}</h2>
            <ul class="never">
                <li>{{ __('site.privacy_never1') }}</li>
                <li>{{ __('site.privacy_never2') }}</li>
                <li>{{ __('site.privacy_never3') }}</li>
                <li>{{ __('site.privacy_never4') }}</li>
            </ul>

            <h2>{{ __('site.privacy_keep_t') }}</h2>
            <ul>
                <li><strong>{{ __('site.privacy_keep1_b') }}</strong> {{ __('site.privacy_keep1') }}</li>
                <li><strong>{{ __('site.privacy_keep2_b') }}</strong> {{ __('site.privacy_keep2') }}</li>
                <li><strong>{{ __('site.privacy_keep3_b') }}</strong> {{ __('site.privacy_keep3') }}</li>
                <li><strong>{{ __('site.privacy_keep4_b') }}</strong> {{ __('site.privacy_keep4') }}</li>
            </ul>

            <h2>{{ __('site.privacy_rights_t') }}</h2>
            <p>
                {{ __('site.privacy_rights_p1') }}
            </p>
            <div class="card">
                <strong>{{ __('site.privacy_rights_card_b') }}</strong> {{ __('site.privacy_rights_card_rest') }}
            </div>
            <p>
                {{ __('site.privacy_rights_p2_a') }}
                <a href="mailto:mamounprogrammer@gmail.com">mamounprogrammer@gmail.com</a>.
            </p>
            <p>
                {{ __('site.privacy_rights_web_a') }}
                <a href="{{ route('pages.account-delete') }}">{{ __('site.privacy_rights_web_link') }}</a>{{ __('site.privacy_rights_web_b') }}
            </p>

            @if (app()->getLocale() === 'en')
            <hr class="divider">

            <section class="ar" lang="ar" dir="rtl">
                <h2>{{ __('site.privacy_ar_short_t') }}</h2>
                <p>
                    {{ __('site.privacy_ar_updated') }}
                </p>

                <h2>ما نجمعه</h2>
                <ul>
                    <li>بيانات حسابك الأساسية في جوجل عند تسجيل الدخول: الاسم والبريد الإلكتروني ومعرّف حساب جوجل فقط.</li>
                    <li>مساهماتك في الطبخ: الأوقات الفعلية التي ترسلها لكل وصفة (الإجمالي، التحضير، والتنظيف) وعدد الأطباق — لتحسين دقة التقديرات للجميع.</li>
                    <li>أحداث الاستخدام: الشاشات التي تُفتح والميزات التي تُستخدم — ترتبط بحسابك فقط عندما تكون مسجلاً للدخول، وتُحذف بعد 90 يوماً.</li>
                    <li>بياناتك المحلية: مفضلاتك وملاحظاتك الخاصة تبقى على هاتفك.</li>
                    <li>محتوى المجتمع: الملاحظات والمنشورات والتعليقات والصور التي تختار جعلها عامة تُرفع وتُعرض للعموم مع اسم العرض الخاص بك.</li>
                    <li>معرّف التثبيت: رقم عشوائي يُنشأ لكل تثبيت، يُرسل عند بدء التطبيق ويُستخدم كعدّاد فقط — يرتبط بحسابك إن سجلت الدخول، ويُحفظ طويلاً لكنه لا يُشارك ولا يُباع أبداً.</li>
                    <li>الصور التي ترفقها: صور الملف الشخصي والصور المرفقة بالمنشورات أو الوصفات.</li>
                </ul>

                <h2>ما لا نفعله</h2>
                <ul class="never">
                    <li>لا بيع للبيانات إطلاقاً، ولا إعلانات، ولا أدوات تتبع من طرف خارجي.</li>
                    <li>المعالجات التي نعتمد عليها: جوجل (تسجيل الدخول)، وExpo (فحوصات تحديث التطبيق)، و— فقط عند استخدام ميزة استيراد الوصفات الاختيارية — خدمة الذكاء الاصطناعي المضبوطة لها.</li>
                </ul>

                <h2>الاحتفاظ بالبيانات</h2>
                <ul>
                    <li>بيانات حسابك تبقى حتى تحذفها بنفسك.</li>
                    <li>أحداث الاستخدام تُحذف تلقائياً بعد 90 يوماً.</li>
                    <li>معرّفات التثبيت تُحفظ طويلاً كعدّاد (لا تُشارك أبداً).</li>
                    <li>رسائل نموذج الاتصال تُحفظ حتى 12 شهراً.</li>
                </ul>

                <h2>حقوقك وحذف حسابك</h2>
                <p>
                    يمكنك حذف حسابك وجميع بياناتك في أي وقت من داخل التطبيق:
                    <strong>الإعدادات ← حذف الحساب</strong> — الحذف فوري ونهائي. تبقى عدّادات
                    الاستخدام المجهّلة، ووصفاتك العامة (تُحفظ دون اسمك)، والملفات المرفوعة
                    (قد تبقى في تخزيننا والنسخ الاحتياطية).
                </p>
                <p>
                    للتواصل أو لطلب الحذف أو لأي سؤال حول بياناتك:
                    <a href="mailto:mamounprogrammer@gmail.com">mamounprogrammer@gmail.com</a>
                </p>
            </section>
            @endif

            <footer>© RecipeReal</footer>
        </main>
    </body>
</html>
