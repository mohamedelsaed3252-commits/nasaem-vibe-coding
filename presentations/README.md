# ملفات العرض والتسليم

**من إنشاء Mohamed El_saed — منحة لتعلّم Vibe Coding**

مصدر العرض الكامل، بما فيه الشرائح والصور والخطوط والشعارات، موجود في:

[`../artifacts/nasaem-presentation/`](../artifacts/nasaem-presentation/)

## النسخ الجاهزة

بعد تجهيز التسليم محليًا، تكون الملفات في:

```text
generated-artifacts/delivery/
  pdf/
    Nasaem-Presentation-Mohamed-El_saed.pdf
    Nasaem-Project-Idea-Mohamed-El_saed.pdf
  powerpoint/
    Nasaem-Presentation-Mohamed-El_saed.pptx
```

## تنزيل ملفات الإصدار

[صفحة الإصدار بكل الملفات](https://github.com/mohamedelsaed3252-commits/nasaem-vibe-coding/releases/tag/v1.0.0)

المستودع خاص؛ يلزم الدخول بالحساب المالك أو حساب لديه صلاحية.

الكود ومصدر العرض موجودان في المستودع، والنسخ الجاهزة مرفقة بالإصدار:

| الملف | التحميل |
| --- | --- |
| العرض التقديمي PDF | [تنزيل PDF](https://github.com/mohamedelsaed3252-commits/nasaem-vibe-coding/releases/download/v1.0.0/Nasaem-Presentation-Mohamed-El_saed.pdf) |
| العرض بالحركات PowerPoint | [تنزيل PowerPoint](https://github.com/mohamedelsaed3252-commits/nasaem-vibe-coding/releases/download/v1.0.0/Nasaem-Presentation-Mohamed-El_saed.pptx) |
| فكرة المشروع PDF | [تنزيل فكرة المشروع](https://github.com/mohamedelsaed3252-commits/nasaem-vibe-coding/releases/download/v1.0.0/Nasaem-Project-Idea-Mohamed-El_saed.pdf) |
| الكود والوثائق وPDF وPowerPoint معًا | [تنزيل الحزمة الكاملة ZIP](https://github.com/mohamedelsaed3252-commits/nasaem-vibe-coding/releases/download/v1.0.0/Nasaem-Project-Mohamed-El_saed.zip) |

ملفات PDF وPowerPoint الجاهزة ليست ضمن تاريخ Git؛ مصدر العرض نفسه، بما فيه الصور والخطوط، محفوظ مع الكود.

داخل أرشيف التسليم المضغوط، توجد الملفات الجاهزة مباشرة في `presentations/pdf/` و`presentations/powerpoint/` إلى جانب المصدر والوثائق.

ملف PowerPoint يتضمن ظهور العنوان ثم النقاط تدريجيًا عند العرض، مع انتقالات هادئة وأشكال متناسقة. افتحه في PowerPoint واختر «عرض الشرائح». ملف PDF نسخة ثابتة ولا يشغّل الحركات.

## إعادة تجهيز الحركات

بعد تصدير PowerPoint جديد من العرض:

```sh
python scripts/animate_nasaem_pptx.py path/to/exported-presentation.pptx
```

السكربت مخصص لعرض نسايم ذي 12 شريحة. احتفظ بنسخة من الملف قبل استخدامه؛ فهو يعدّل الملف المحدد.

## تجهيز حزمة المصدر

```sh
python scripts/package-project.py
```

ينتج أرشيف تسليم يحتوي الكود والوثائق وملفات PDF وPowerPoint المتاحة، دون الأسرار أو بيانات المحل أو تاريخ Git. يُشترط تجهيز النسخ الثلاث أعلاه قبل تشغيله.
