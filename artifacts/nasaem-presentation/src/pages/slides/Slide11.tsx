const base = import.meta.env.BASE_URL;
export default function Slide11() {
  return (
    <div dir="rtl" className="w-screen h-screen overflow-hidden relative deck security font-body text-text">
      <div className="blob" aria-hidden="true" />
      <div className="blob-small" aria-hidden="true" />
      <div className="mark" aria-hidden="true">N</div>
      <h2>صلاحيات ونسخ احتياطية لحماية العمل</h2>
      <img className="photo" src={`${base}security.jpg`} crossOrigin="anonymous" alt="صورة توضيحية لقفل وقرص نسخ احتياطي بجانب كمبيوتر المحل" />
      <ul>
        <li>تسجيل دخول وحسابات لفريق المحل</li>
        <li>اعتماد الحسابات وتحديد الصلاحيات بواسطة المالك</li>
        <li>تقييد الإجراءات الحساسة حسب الدور</li>
        <li>تصدير نسخة احتياطية واستعادتها عند الحاجة</li>
        <li>الوصول من أي شبكة Wi-Fi أو بيانات موبايل</li>
      </ul>
    </div>
  );
}
