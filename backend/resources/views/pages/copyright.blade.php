@extends('layouts.page')

{{-- Bilingual inline on purpose (lang files are owned elsewhere): the whole
    body branches on the active locale like the rest of the legal pages. --}}
@section('title', app()->getLocale() === 'ar' ? 'الحقوق والشكاوى — RecipeReal' : 'Copyright & takedowns — RecipeReal')
@section('description', app()->getLocale() === 'ar'
    ? 'حقوق النشر وإسناد الوصفات في RecipeReal، وطلب الحذف أو الإسناد.'
    : 'How RecipeReal handles recipe attribution, rights-holder requests and content takedowns.')

@section('content')
<div class="page">
@if (app()->getLocale() === 'ar')
    <h1>الحقوق <span class="o">والشكاوى</span></h1>
    <div class="rule" aria-hidden="true"></div>
    <p class="lede">
        كيف يتعامل RecipeReal مع إسناد الوصفات، وطلبات أصحاب الحقوق، وحذف المحتوى.
    </p>
    <p style="margin: -18px 0 26px; font-size: 14px; color: var(--faint); font-weight: 600;">
        آخر تحديث: 5 نوفمبر 2026
    </p>

    <h2>مكتبة الوصفات وإسناد Food.com</h2>
    <p>
        تتضمن مكتبة وصفات RecipeReal محتوى نُشر في الأصل على Food.com، وقد
        استُورد من مجموعة بيانات عامة. لا يدّعي RecipeReal ملكية ذلك المحتوى
        الأصلي؛ وتبقى الحقوق لأصحابها.
    </p>
    <p>
        كل وصفة مستوردة تحمل رابط إسناد إلى الوصفة الأصلية، ويظهر على صفحة
        مشاركة الوصفة، ويُذكر اسم المصدر على بيانات الوصفة داخل التطبيق.
    </p>

    <h2>طلب الحذف أو الإسناد</h2>
    <p>
        يمكن لأصحاب الحقوق طلب حذف وصفة أو إضافة إسناد عبر المراسلة على
        <a href="mailto:mamounprogrammer@gmail.com">mamounprogrammer@gmail.com</a>
        مع رابط الوصفة (رابط المشاركة /r/… أو رابط الوصفة الأصلية على Food.com).
        تُعالج الطلبات خلال 7 أيام؛ وتُحذف الوصفات المؤكدة من المكتبة فلا تعود
        تُقدَّم عبر الموقع أو التطبيق.
    </p>

    <h2>المحتوى الذي ينشره المستخدمون (المنشورات والصور)</h2>
    <p>
        المنشورات والصور والملاحظات ينشئها مستخدمو التطبيق، وكل مستخدم مسؤول
        عمّا يرفعه. إذا كان محتوى ينتهك حقوقك، راسلنا على
        <a href="mailto:mamounprogrammer@gmail.com">mamounprogrammer@gmail.com</a>
        مع رابط المنشور؛ وبعد التحقق يُحذف خلال 7 أيام ويُبلَّغ من رفعه.
    </p>

    <h2>تواصل معنا</h2>
    <p>
        لأي سؤال عن الحقوق أو الإسناد أو الحذف، اكتب لنا على
        <a href="mailto:mamounprogrammer@gmail.com">mamounprogrammer@gmail.com</a>
        — نقرأ كل رسالة.
    </p>
@else
    <h1>Copyright <span class="o">&amp; takedowns</span></h1>
    <div class="rule" aria-hidden="true"></div>
    <p class="lede">
        How RecipeReal handles recipe attribution, rights-holder requests and content takedowns.
    </p>
    <p style="margin: -18px 0 26px; font-size: 14px; color: var(--faint); font-weight: 600;">
        Last updated: 5 November 2026
    </p>

    <h2>Recipe library &amp; Food.com attribution</h2>
    <p>
        RecipeReal's recipe library includes content originally published on
        Food.com, imported from a public dataset. RecipeReal does not claim
        ownership of that original content; all rights remain with their
        owners.
    </p>
    <p>
        Every imported recipe carries an attribution link to the original
        recipe page — shown on the recipe's share page, with the source
        named on the recipe's data inside the app.
    </p>

    <h2>Requesting removal or credit</h2>
    <p>
        Rights holders can request removal of a recipe or additional credit by
        emailing
        <a href="mailto:mamounprogrammer@gmail.com">mamounprogrammer@gmail.com</a>
        with the recipe URL (the /r/… share link or the original Food.com
        recipe page). Requests are processed within 7 days; confirmed removals
        are deleted from the library and are no longer served by the website
        or the app.
    </p>

    <h2>User-generated content (posts &amp; photos)</h2>
    <p>
        Posts, photos and notes are created by RecipeReal users, and every
        uploader remains responsible for what they publish. If content
        infringes your rights, email
        <a href="mailto:mamounprogrammer@gmail.com">mamounprogrammer@gmail.com</a>
        with the post link; after verification it is removed within 7 days and
        the uploader is notified.
    </p>

    <h2>Contact</h2>
    <p>
        For any question about copyright, attribution or takedowns, write to
        <a href="mailto:mamounprogrammer@gmail.com">mamounprogrammer@gmail.com</a>
        — we read every message.
    </p>
@endif
</div>
@endsection
