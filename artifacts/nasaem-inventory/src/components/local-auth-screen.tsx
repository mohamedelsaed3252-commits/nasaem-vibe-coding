import { useState, type FormEvent } from 'react';
import { AlertCircle, Eye, EyeOff, LockKeyhole, ShieldCheck, Store } from 'lucide-react';

type LocalAuthScreenProps = { onAuthenticated: () => void };
type AuthMode = 'login' | 'register';

export function LocalAuthScreen({ onAuthenticated }: LocalAuthScreenProps) {
  const [mode, setMode] = useState<AuthMode>('login');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [waitingForOwner, setWaitingForOwner] = useState(false);

  const isRegister = mode === 'register';

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;
    setLoading(true);
    setError('');
    setWaitingForOwner(false);

    try {
      const response = await fetch(isRegister ? '/api/auth/local/register' : '/api/auth/local/login', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(isRegister
          ? { displayName: displayName.trim(), email: email.trim(), password }
          : { email: email.trim(), password }),
      });

      let result: { pending?: boolean; error?: string } = {};
      try {
        result = await response.json() as { pending?: boolean; error?: string };
      } catch {
        result = {};
      }

      if (!response.ok) {
        setError(result.error || 'تعذر إكمال الطلب. تحقق من البيانات ثم حاول مرة أخرى.');
        return;
      }

      if (result.pending) {
        setWaitingForOwner(true);
        return;
      }

      onAuthenticated();
    } catch {
      setError('تعذر الاتصال بالخادم المحلي. تحقق من اتصال الشبكة ثم أعد المحاولة.');
    } finally {
      setLoading(false);
    }
  }

  function changeMode(nextMode: AuthMode) {
    setMode(nextMode);
    setError('');
    setWaitingForOwner(false);
  }

  return (
    <main className="nasaem-local-auth landing" dir="rtl">
      <style>{`
        .nasaem-local-auth { display:grid; place-items:center; padding:24px 16px; background:
          radial-gradient(ellipse at 8% 12%, rgba(240,200,78,.16), transparent 32%),
          radial-gradient(ellipse at 95% 88%, rgba(53,116,86,.10), transparent 34%), #f7f4eb; }
        .nasaem-local-auth__card { width:min(100%, 460px); overflow:hidden; border:1px solid #e9e4d8; border-radius:20px; background:#fffdf8; box-shadow:0 18px 55px rgba(40,66,51,.11); }
        .nasaem-local-auth__top { padding:27px 30px 23px; background:#244a3b; color:#fff9ed; }
        .nasaem-local-auth__brand { display:flex; align-items:center; gap:12px; }
        .nasaem-local-auth__mark { display:grid; width:42px; height:42px; place-items:center; flex:none; border-radius:14px 14px 14px 4px; background:#f0c84e; color:#244a3b; font:700 24px 'DM Sans',sans-serif; transform:rotate(-4deg); }
        .nasaem-local-auth__brand-name { font-size:18px; font-weight:700; }
        .nasaem-local-auth__brand-sub { margin-top:3px; color:#c5d6c9; font-size:12px; }
        .nasaem-local-auth__intro { margin-top:25px; }
        .nasaem-local-auth__intro h1 { margin:0; color:#fff9ed; font-size:25px; letter-spacing:-.04em; }
        .nasaem-local-auth__intro p { margin:7px 0 0; color:#c5d6c9; font-size:13px; line-height:1.8; }
        .nasaem-local-auth__body { padding:25px 30px 28px; }
        .nasaem-local-auth__switch { display:grid; grid-template-columns:1fr 1fr; gap:4px; padding:4px; margin-bottom:22px; border-radius:11px; background:#f2f0e8; }
        .nasaem-local-auth__switch button { min-height:40px; border:0; border-radius:8px; background:transparent; color:#6e7a70; font:600 13px inherit; cursor:pointer; }
        .nasaem-local-auth__switch button[aria-pressed="true"] { background:#fffdf8; color:#244a3b; box-shadow:0 2px 7px rgba(40,66,51,.09); }
        .nasaem-local-auth__form { display:grid; gap:15px; }
        .nasaem-local-auth__field { display:grid; gap:7px; color:#385646; font-size:12px; font-weight:600; }
        .nasaem-local-auth__field input { min-height:45px; padding:10px 12px; border:1px solid #dedfd4; border-radius:9px; background:#fffefa; color:#244a3b; font-size:14px; outline:none; }
        .nasaem-local-auth__field input:focus { border-color:#679178; box-shadow:0 0 0 3px #4c8b671c; }
        .nasaem-local-auth__password { position:relative; }
        .nasaem-local-auth__password input { padding-left:46px; }
        .nasaem-local-auth__reveal { position:absolute; top:50%; left:7px; display:grid; width:34px; height:34px; place-items:center; border:0; border-radius:7px; background:transparent; color:#718078; transform:translateY(-50%); cursor:pointer; }
        .nasaem-local-auth__reveal:hover { background:#eff2e9; color:#244a3b; }
        .nasaem-local-auth__notice { display:flex; align-items:flex-start; gap:10px; padding:12px 13px; border:1px solid #eed2cd; border-radius:10px; background:#fff3ef; color:#9c3f35; font-size:12px; line-height:1.7; }
        .nasaem-local-auth__notice svg { width:17px; height:17px; flex:none; margin-top:1px; }
        .nasaem-local-auth__pending { padding:15px; border:1px solid #ecdca7; border-radius:11px; background:#fff8dc; color:#765e18; text-align:center; }
        .nasaem-local-auth__pending svg { width:23px; height:23px; margin-bottom:7px; }
        .nasaem-local-auth__pending strong { display:block; font-size:14px; }
        .nasaem-local-auth__pending p { margin:6px 0 0; font-size:12px; line-height:1.8; }
        .nasaem-local-auth__submit { width:100%; min-height:47px; margin-top:3px; }
        .nasaem-local-auth__submit:focus-visible, .nasaem-local-auth__switch button:focus-visible, .nasaem-local-auth__reveal:focus-visible { outline:3px solid #f0c84e; outline-offset:2px; }
        .nasaem-local-auth__foot { display:flex; align-items:center; justify-content:center; gap:7px; margin-top:20px; color:#829087; font-size:11px; }
        .nasaem-local-auth__foot svg { width:14px; height:14px; color:#357456; }
        @media(max-width:520px) { .nasaem-local-auth { padding:14px; } .nasaem-local-auth__top { padding:23px 21px 20px; } .nasaem-local-auth__body { padding:21px; } .nasaem-local-auth__intro h1 { font-size:22px; } }
      `}</style>
      <section className="nasaem-local-auth__card" aria-labelledby="nasaem-auth-title">
        <header className="nasaem-local-auth__top">
          <div className="nasaem-local-auth__brand">
            <div className="nasaem-local-auth__mark" aria-hidden="true">N</div>
            <div>
              <div className="nasaem-local-auth__brand-name">نسايم للمنظفات</div>
              <div className="nasaem-local-auth__brand-sub">نظام المتجر المحلي</div>
            </div>
          </div>
          <div className="nasaem-local-auth__intro">
            <h1 id="nasaem-auth-title">{isRegister ? 'إعداد حساب المتجر' : 'تسجيل الدخول'}</h1>
            <p>{isRegister ? 'أنشئ حساب المالك الأول لبدء استخدام نظام المتجر.' : 'أدخل بيانات حسابك للمتابعة إلى نظام المتجر.'}</p>
          </div>
        </header>
        <div className="nasaem-local-auth__body">
          <div className="nasaem-local-auth__switch" role="group" aria-label="نوع الحساب">
            <button type="button" aria-pressed={!isRegister} onClick={() => changeMode('login')}>تسجيل الدخول</button>
            <button type="button" aria-pressed={isRegister} onClick={() => changeMode('register')}>إنشاء حساب</button>
          </div>

          {waitingForOwner ? (
            <div className="nasaem-local-auth__pending" role="status" data-testid="status-auth-pending">
              <ShieldCheck aria-hidden="true" />
              <strong>الحساب بانتظار موافقة مالك المتجر</strong>
              <p>تم استلام طلبك. يمكنك المتابعة بعد اعتماد الحساب من المالك.</p>
            </div>
          ) : (
            <form className="nasaem-local-auth__form" onSubmit={submit}>
              {isRegister && (
                <label className="nasaem-local-auth__field">
                  الاسم
                  <input autoComplete="name" required value={displayName} onChange={event => setDisplayName(event.target.value)} aria-label="الاسم" />
                </label>
              )}
              <label className="nasaem-local-auth__field">
                البريد الإلكتروني
                <input type="email" autoComplete="email" dir="ltr" required value={email} onChange={event => setEmail(event.target.value)} aria-label="البريد الإلكتروني" />
              </label>
              <label className="nasaem-local-auth__field">
                كلمة المرور
                <span className="nasaem-local-auth__password">
                  <input type={showPassword ? 'text' : 'password'} autoComplete={isRegister ? 'new-password' : 'current-password'} required minLength={isRegister ? 8 : 1} value={password} onChange={event => setPassword(event.target.value)} aria-label="كلمة المرور" />
                  <button type="button" className="nasaem-local-auth__reveal" onClick={() => setShowPassword(value => !value)} aria-label={showPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'} aria-pressed={showPassword}>
                    {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                  </button>
                </span>
              </label>
              {error && <div className="nasaem-local-auth__notice" role="alert" data-testid="status-auth-error"><AlertCircle aria-hidden="true" /><span>{error}</span></div>}
              <button className="button nasaem-local-auth__submit" type="submit" disabled={loading} data-testid="button-auth-submit">
                {loading ? 'جارٍ التحقق…' : isRegister ? 'إنشاء حساب المالك' : 'الدخول إلى المتجر'}
              </button>
            </form>
          )}
          <div className="nasaem-local-auth__foot"><LockKeyhole aria-hidden="true" /><Store aria-hidden="true" /> يعمل على شبكة المتجر المحلية</div>
        </div>
      </section>
    </main>
  );
}

export default LocalAuthScreen;
