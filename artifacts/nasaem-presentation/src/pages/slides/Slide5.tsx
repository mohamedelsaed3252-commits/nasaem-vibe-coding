const base = import.meta.env.BASE_URL;
export default function Slide5() {
  return (
    <div dir="rtl" className="w-screen h-screen overflow-hidden relative deck sales font-body text-text">
      <div className="blob" aria-hidden="true" />
      <div className="blob-small" aria-hidden="true" />
      <div className="mark" aria-hidden="true">N</div>
      <h2>فاتورة بيع بالاسم أو بالباركود</h2>
      <img className="photo" src={`${base}sales.jpg`} crossOrigin="anonymous" alt="صورة توضيحية لبيع المنتجات وطباعة الفاتورة" />
      <div className="receipt">
        <ul>
          <li>البحث داخل قائمة المنتجات بالاسم</li>
          <li>بيع المنتجات التي لا تحمل باركود</li>
          <li>تحديد الكميات وإضافة أكثر من صنف</li>
          <li>تسجيل الخصم والملاحظات</li>
          <li>خصم الكمية من المخزون عند تسجيل البيع</li>
        </ul>
      </div>
    </div>
  );
}
