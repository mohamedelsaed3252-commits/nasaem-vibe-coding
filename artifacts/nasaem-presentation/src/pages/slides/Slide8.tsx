const base = import.meta.env.BASE_URL;
export default function Slide8() {
  return (
    <div dir="rtl" className="w-screen h-screen overflow-hidden relative deck debts font-body text-text">
      <div className="blob" aria-hidden="true" />
      <div className="blob-small" aria-hidden="true" />
      <div className="mark" aria-hidden="true">N</div>
      <h2>الديون: تعرف ما لك وما عليك</h2>
      <img className="photo" src={`${base}debts.jpg`} crossOrigin="anonymous" alt="صورة توضيحية لمراجعة حساب وسداد مستحقات المحل" />
      <ul>
        <li>تسجيل مبالغ مستحقة للمحل أو عليه</li>
        <li>تحديد الطرف وقيمة الدين والملاحظات</li>
        <li>تسجيل السداد الكامل أو على دفعات</li>
        <li>عرض المدفوع والمتبقي لكل دين</li>
        <li>منع تسجيل دفعة تتجاوز المبلغ المتبقي</li>
      </ul>
    </div>
  );
}
