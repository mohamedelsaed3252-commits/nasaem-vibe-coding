const base = import.meta.env.BASE_URL;
export default function Slide9() {
  return (
    <div dir="rtl" className="w-screen h-screen overflow-hidden relative deck profit font-body text-text">
      <div className="blob" aria-hidden="true" />
      <div className="blob-small" aria-hidden="true" />
      <div className="mark" aria-hidden="true">N</div>
      <h2>صافي الربح الشهري بالأرقام الصحيحة</h2>
      <img className="photo" src={`${base}profit.jpg`} crossOrigin="anonymous" alt="صورة توضيحية لأدوات مراجعة الحسابات الشهرية" />
      <div className="equation">
        <p className="term revenue">إجمالي مبيعات الشهر بعد الخصومات</p>
        <p className="term deduction"><span className="operator" aria-hidden="true">−</span>ناقص تكلفة الأصناف التي بيعت فعليًا</p>
        <p className="term deduction"><span className="operator" aria-hidden="true">−</span>ناقص مصاريف التشغيل المسجلة</p>
      </div>
      <div className="profit-outcome">
        <span className="equals" aria-hidden="true">=</span>
        <p className="result">الناتج هو صافي الربح الشهري</p>
      </div>
      <p className="note">شراء مخزون لم يُبع بعد لا يُخصم كاملًا من ربح الشهر</p>
    </div>
  );
}
