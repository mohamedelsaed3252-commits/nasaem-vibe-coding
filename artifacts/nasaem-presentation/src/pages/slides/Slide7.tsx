const base = import.meta.env.BASE_URL;
export default function Slide7() {
  return (
    <div dir="rtl" className="w-screen h-screen overflow-hidden relative deck supplies font-body text-text">
      <div className="blob-small" aria-hidden="true" />
      <div className="mark" aria-hidden="true">N</div>
      <h2>التوريدات: بضاعة ومدفوعات واضحة</h2>
      <ul>
        <li>تسجيل المورد والأصناف الواردة وتكلفتها</li>
        <li>إضافة الكميات إلى رصيد المخزون</li>
        <li>فصل متابعة البضاعة عن المدفوعات</li>
        <li>تسجيل المبلغ المدفوع والمتبقي للمورد</li>
        <li>ربط المتبقي بسجل الديون</li>
      </ul>
      <img className="photo" src={`${base}supplies.jpg`} crossOrigin="anonymous" alt="صورة توضيحية لاستلام كراتين البضاعة ومراجعتها" />
    </div>
  );
}
