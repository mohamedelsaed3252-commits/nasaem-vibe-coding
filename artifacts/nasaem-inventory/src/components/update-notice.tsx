import { useEffect, useState } from 'react';

export function UpdateNotice() {
  const [available, setAvailable] = useState(false);

  useEffect(() => {
    if (import.meta.env.DEV) return;
    const current = document.querySelector<HTMLMetaElement>('meta[name="nasaem-build"]')?.content;
    if (!current) return;
    let cancelled = false;
    let pending = false;
    const controller = new AbortController();
    const check = async () => {
      if (document.visibilityState === 'hidden' || pending) return;
      pending = true;
      try {
        const url = `${import.meta.env.BASE_URL}app-version.json?check=${Date.now()}`;
        const response = await fetch(url, { cache: 'no-store', signal: controller.signal });
        if (!response.ok) return;
        const data: unknown = await response.json();
        if (!cancelled && typeof data === 'object' && data !== null && 'version' in data &&
          typeof data.version === 'string' && data.version !== current) {
          setAvailable(true);
        }
      } catch {
        // Offline/version-check failures must not interrupt an in-progress sale.
      } finally {
        pending = false;
      }
    };
    void check();
    const timer = window.setInterval(() => void check(), 60_000);
    const onFocus = () => { void check(); };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onFocus);
    return () => {
      cancelled = true;
      controller.abort();
      window.clearInterval(timer);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onFocus);
    };
  }, []);

  if (!available) return null;
  return <section className="update-notice" role="status" dir="rtl">
    <div><strong>تحديث جديد للنظام متاح</strong><p>احفظ أي فاتورة أو تعديل مفتوح أولًا، ثم حمّل النسخة الجديدة.</p></div>
    <button type="button" className="button" onClick={() => window.location.reload()}>تحميل التحديث</button>
  </section>;
}
