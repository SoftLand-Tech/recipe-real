<?php

namespace Tests\Unit;

use App\Support\ArabicFoodGlossary;
use PHPUnit\Framework\TestCase;

/**
 * Covers the culinary glossary: transliterated food words become their
 * established Arabic terms, while standard loanwords pass through.
 */
class ArabicFoodGlossaryTest extends TestCase
{
    public function test_cranberry_scones_becomes_proper_arabic(): void
    {
        $this->assertSame('سكونز التوت البري', ArabicFoodGlossary::apply('سكون الكرانبيري'));
    }

    public function test_redundant_transliterated_parenthetical_is_dropped(): void
    {
        $this->assertSame('خبز التوت البري', ArabicFoodGlossary::apply('خبز التوت البري (كرانبيري)'));
        $this->assertSame(
            'كرامبل التفاح وتوت العليق',
            ArabicFoodGlossary::apply('كرامبل التفاح وتوت العليق (راسبيري)'),
        );
        $this->assertSame('مافن التوت الأزرق', ArabicFoodGlossary::apply('مافن التوت الأزرق (بلوبيري)'));
        $this->assertSame('جزر أبيض مشوي بالفرن', ArabicFoodGlossary::apply('جزر أبيض (بارسنيب) مشوي بالفرن'));
    }

    public function test_pecan_forms_normalize(): void
    {
        $this->assertSame('فطيرة جوز البقان الأعلى تقييمًا', ArabicFoodGlossary::apply('فطيرة الجوز البيكان الأعلى تقييمًا'));
        $this->assertSame('قرع العسل المطهو مع البصل والبقان', ArabicFoodGlossary::apply('قرع العسل المطهو مع البصل والبيكان'));
    }

    public function test_rosemary_with_prefixes(): void
    {
        $this->assertSame(
            'لحم بقري وبطاطس بإكليل الجبل والزعتر',
            ArabicFoodGlossary::apply('لحم بقري وبطاطس بالروزماري والزعتر'),
        );
        $this->assertSame('بطاطس إكليل الجبل بالميكروويف', ArabicFoodGlossary::apply('بطاطس روزماري بالميكروويف'));
    }

    public function test_scone_forms_become_loanword(): void
    {
        $this->assertSame('سكونز حلو بسيط', ArabicFoodGlossary::apply('سكون حلو بسيط'));
        $this->assertSame('سكونز (فطائر) اسكتلندية', ArabicFoodGlossary::apply('سكونش (فطائر) اسكتلندية'));
    }

    public function test_standard_loanwords_pass_through(): void
    {
        foreach (['مافن التوت الأزرق', 'السكونز البريطاني', 'كيش النقانق بالجبن', 'تاكو الدجاج', 'براونيز الشوكولاتة', 'تشيز كيك التوت الأحمر'] as $clean) {
            $this->assertSame($clean, ArabicFoodGlossary::apply($clean), "should not touch: {$clean}");
        }
    }

    public function test_guarded_blackberry_does_not_touch_tribal_forms(): void
    {
        $this->assertSame('كوبلر التوت الأسود', ArabicFoodGlossary::apply('كوبلر العليق'));
        $this->assertSame('مربى العليق الأسود المنزلي', ArabicFoodGlossary::apply('مربى العليق الأسود المنزلي'));
        $this->assertSame('كرامبل التفاح وتوت العليق', ArabicFoodGlossary::apply('كرامبل التفاح وتوت العليق'));
    }

    public function test_brussels_and_artichoke_fixes(): void
    {
        $this->assertSame('كرنب بروكسل بالديجون', ArabicFoodGlossary::apply('بروكلي بروكسل بالديجون'));
        $this->assertSame('ديب الخرشوف الدافئ', ArabicFoodGlossary::apply('ديب الأرضي شوكة الدافئ'));
    }

    public function test_hallucinated_titles_are_corrected(): void
    {
        $this->assertSame('ذرة لذيذة', ArabicFoodGlossary::apply('طاجن الذرة الكريمي بالجبن والثوم'));
        $this->assertSame('الكراث بالكريمة والبارميزان', ArabicFoodGlossary::apply('كرات (برعم الكرنب) بالكريمة والبارميزان'));
    }

    public function test_idempotent_and_empty_safe(): void
    {
        $fixed = ArabicFoodGlossary::apply('سكون الكرانبيري');
        $this->assertSame($fixed, ArabicFoodGlossary::apply($fixed));
        $this->assertSame('', ArabicFoodGlossary::apply('   '));
    }
}
