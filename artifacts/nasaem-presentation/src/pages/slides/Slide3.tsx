const base = import.meta.env.BASE_URL;
export default function Slide3() {
  return (
    <div dir="rtl" className="w-screen h-screen overflow-hidden relative deck overview font-body text-text">
      <div className="blob" aria-hidden="true" />
      <div className="blob-small" aria-hidden="true" />
      <div className="mark" aria-hidden="true">N</div>
      <h2>فكرة نسايم: إدارة المحل ببساطة</h2>
      <img className="photo" src={`${base}overview.jpg`} crossOrigin="anonymous" alt="صورة توضيحية لإدارة محل منظفات منظم" />
      <ul>
        <li>تسجيل المنتجات وتنظيم أقسامها</li>
        <li>تنفيذ البيع وإصدار الفواتير</li>
        <li>متابعة التوريدات والمدفوعات والديون</li>
        <li>معرفة صافي الربح الشهري</li>
        <li>واجهة للكمبيوتر والموبايل عبر الإنترنت</li>
      </ul>
    </div>
  );
}
