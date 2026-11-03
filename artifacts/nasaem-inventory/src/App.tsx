import { createContext, useContext, useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { ClerkProvider, SignIn, SignUp, Show, useClerk } from '@clerk/react';
import { publishableKeyFromHost } from '@clerk/react/internal';
import { shadcn } from '@clerk/themes';
import {
  Activity, Archive, ArrowDownToLine, ArrowLeftRight, Boxes, ChartNoAxesCombined, ChevronLeft,
  CircleAlert, Download, FileText, History, LayoutDashboard, LogOut, Package, Pencil, Plus, Printer,
  Search, ShieldCheck, ShoppingCart, Truck, Users, X, Trash2, RotateCcw, Ban, Minus
} from 'lucide-react';
import {
  useGetCurrentUser, useGetDashboard, useListRecentActivity, useListProducts, useCreateProduct,
  useUpdateProduct, useDeleteProduct, useAdjustStock, useListSales, useCreateSale, useGetSaleInvoice,
  useListSupplies, useCreateSupply, useCancelSale, useListTeamMembers, useUpdateTeamRole, useExportBackup, useRestoreBackup,
  getGetCurrentUserQueryKey, getGetDashboardQueryKey, getListRecentActivityQueryKey, getListProductsQueryKey,
  getListSalesQueryKey, getGetSaleInvoiceQueryKey, getListSuppliesQueryKey,
  getListTeamMembersQueryKey, getExportBackupQueryKey,
  useListDebts, useCreateDebt, useCreateDebtPayment, useListExpenses,
  useCreateExpense, useGetMonthlyFinance
} from '@workspace/api-client-react';
import type { Product, ProductInput, AppUser, Sale, Debt, Expense } from '@workspace/api-client-react';
import { Route, Switch, Redirect, useLocation, Router as WouterRouter, Link } from 'wouter';
import { LocalAuthScreen } from '@/components/local-auth-screen';
import { BarcodeCapture } from '@/components/barcode-capture';
import { SaleProductSelect } from '@/components/sale-product-select';
import { PRODUCT_CATEGORIES } from '@/lib/product-categories';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';

const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');
const localMode = import.meta.env.VITE_LOCAL_MODE === 'true';
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchInterval: localMode ? 5_000 : false,
      refetchOnWindowFocus: true,
    },
  },
});
const clerkPubKey = publishableKeyFromHost(window.location.hostname, import.meta.env.VITE_CLERK_PUBLISHABLE_KEY);
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;
const AuthActionsContext = createContext<{ signOut: () => Promise<void> }>({ signOut: async () => {} });
function useAuthActions() { return useContext(AuthActionsContext); }
function stripBase(path: string) { return basePath && path.startsWith(basePath) ? path.slice(basePath.length) || '/' : path; }
const appearance = {
  theme: shadcn, cssLayerName: 'clerk',
  options: { logoPlacement: 'inside' as const, logoLinkUrl: basePath || '/', logoImageUrl: `${window.location.origin}${basePath}/logo.svg` },
  variables: { colorPrimary: '#b94339', colorForeground: '#244a3b', colorMutedForeground: '#748078', colorDanger: '#b94339', colorBackground: '#fffdf8', colorInput: '#fffefa', colorInputForeground: '#244a3b', colorNeutral: '#dedfd4', fontFamily: 'IBM Plex Sans Arabic', borderRadius: '0.75rem' },
  elements: {
    rootBox: 'w-full flex justify-center', cardBox: 'bg-[#fffdf8] rounded-2xl w-[440px] max-w-full overflow-hidden shadow-xl',
    card: '!shadow-none !border-0 !bg-transparent !rounded-none', footer: '!shadow-none !border-0 !bg-transparent !rounded-none',
    headerTitle: 'text-[#244a3b] font-bold', headerSubtitle: 'text-[#748078]', socialButtonsBlockButtonText: 'text-[#244a3b]',
    formFieldLabel: 'text-[#385646]', footerActionLink: 'text-[#a83d35]', footerActionText: 'text-[#748078]',
    dividerText: 'text-[#748078]', identityPreviewEditButton: 'text-[#a83d35]', formFieldSuccessText: 'text-[#357456]',
    alertText: 'text-[#a9433a]', logoBox: 'rounded-xl', logoImage: 'rounded-lg', socialButtonsBlockButton: 'border-[#dedfd4]',
    formButtonPrimary: 'bg-[#b94339] hover:bg-[#a73730]', formFieldInput: 'border-[#dedfd4] text-[#244a3b]',
    footerAction: 'text-[#748078]', dividerLine: 'bg-[#dedfd4]', alert: 'border-[#eed2cd]', otpCodeFieldInput: 'border-[#dedfd4]',
    formFieldRow: 'text-[#385646]', main: 'text-[#244a3b]'
  }
};

function Brand({ small = false }: { small?: boolean }) {
  return <div className="brand"><div className="brand-mark">N</div><div><div className="brand-title">نسايم للمنظفات</div>{!small && <div className="brand-sub">نظام إدارة المتجر</div>}</div></div>;
}
const navItems = [
  { href: '/dashboard', label: 'نظرة عامة', icon: LayoutDashboard },
  { href: '/products', label: 'المنتجات والمخزون', icon: Package },
  { href: '/sales', label: 'المبيعات والفواتير', icon: ShoppingCart },
  { href: '/supplies', label: 'التوريدات', icon: Truck },
  { href: '/finance', label: 'الربح الشهري', icon: ChartNoAxesCombined },
  { href: '/debts', label: 'الديون والمدفوعات', icon: ArrowLeftRight },
  { href: '/team', label: 'فريق العمل', icon: Users },
  { href: '/backup', label: 'النسخ الاحتياطي', icon: Archive }
];

function CacheInvalidator() {
  const { addListener } = useClerk();
  const client = useQueryClient();
  const previous = useRef<string | null | undefined>(undefined);
  useEffect(() => addListener(({ user }) => {
    const id = user?.id ?? null;
    if (previous.current !== undefined && previous.current !== id) client.clear();
    previous.current = id;
  }), [addListener, client]);
  return null;
}

function Landing() {
  return <div className="landing">
    <nav className="landing-nav"><Brand /><div className="landing-actions"><Link href="/sign-in" className="button ghost">تسجيل الدخول</Link><Link href="/sign-up" className="button">إنشاء حساب</Link></div></nav>
    <main className="landing-main">
      <section className="landing-hero">
        <div className="landing-copy"><div className="eyebrow">كل تفاصيل متجرك في مكان واحد</div><h1>إدارة أهدأ.<br /><span>متجر أنظف.</span></h1><p>نسايم للمنظفات يساعد فريقك على متابعة المنتجات والمخزون والمبيعات والتوريدات من شاشة واحدة واضحة، لتبقى الخدمة سريعة والأرقام موثوقة. {!localMode && 'افتح النظام عبر الإنترنت من أي شبكة Wi-Fi أو بيانات موبايل، مع تسجيل الدخول لحماية بيانات المحل.'}</p><div className="hero-buttons"><Link href="/sign-in" className="button">الدخول إلى المتجر <ChevronLeft /></Link><Link href="/sign-up" className="button ghost">ابدأ الآن</Link></div></div>
        <div className="landing-art" aria-hidden="true"><div className="bubble one" /><div className="bubble two" /><div className="bubble three" /><div className="bottle" /></div>
      </section>
      <section className="feature-strip"><div className="feature"><strong>مخزون تعرفه</strong>تنبيه واضح قبل نفاد المنتجات، مع تحديثات فورية لكل حركة.</div><div className="feature"><strong>بيع أسرع</strong>سجل الفاتورة والتخفيض وملاحظات البيع دون خطوات زائدة.</div><div className="feature"><strong>فريق موثوق</strong>أدوار واضحة للمالك والمدير وأمين الصندوق.</div></section>
      <footer className="landing-footer">نسايم للمنظفات · إدارة يومية بسيطة وواضحة</footer>
    </main>
  </div>;
}
function SignInPage() { return <div className="landing min-h-[100dvh] flex items-center justify-center px-4"><SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} /></div>; }
function SignUpPage() { return <div className="landing min-h-[100dvh] flex items-center justify-center px-4"><SignUp routing="path" path={`${basePath}/sign-up`} signInUrl={`${basePath}/sign-in`} /></div>; }

function Shell({ children, pageTitle }: { children: ReactNode; pageTitle: string }) {
  const [loc] = useLocation();
  const { signOut } = useAuthActions();
  const userQuery = useGetCurrentUser();
  const user = userQuery.data as AppUser | undefined;
  const canReviewApprovals = user?.active === true && user.role === 'owner';
  const teamQuery = useListTeamMembers({
    query: {
      queryKey: getListTeamMembersQueryKey(),
      enabled: canReviewApprovals,
      refetchInterval: canReviewApprovals ? 15_000 : false,
      refetchOnWindowFocus: true,
    },
  });
  const pendingApprovals = (teamQuery.data ?? []).filter(member => member.pendingApproval);
  return <div className="app">
    <aside className="sidebar"><Brand /><div className="nav-label">القائمة الرئيسية</div><nav>{navItems.map(({ href, label, icon: Icon }) => <Link href={href} key={href} className={`nav-link ${loc === href ? 'active' : ''}`} data-testid={`link-nav-${href.slice(1)}`}><Icon /><span>{label}</span>{href === '/team' && canReviewApprovals && pendingApprovals.length > 0 && <span data-testid="badge-pending-approvals" aria-label={`${fmt(pendingApprovals.length)} موافقات معلقة`} style={{ marginInlineStart: 'auto', minWidth: 19, padding: '1px 6px', borderRadius: 999, background: '#b94339', color: 'white', fontSize: 10, fontWeight: 700, textAlign: 'center' }}>{fmt(pendingApprovals.length)}</span>}</Link>)}</nav>
      <div className="sidebar-bottom"><button className="nav-link" onClick={() => { void signOut(); }} data-testid="button-sign-out"><LogOut /><span>تسجيل الخروج</span></button><div className="subtle" style={{ color: '#aac0b2', padding: '10px 12px' }}>نسايم · نسخة المتجر</div></div>
    </aside>
    <main className="main"><header className="topbar"><div><div className="top-greeting">مساحة العمل / {pageTitle}</div><div className="top-name">{pageTitle}</div></div><div className="user-chip"><span className="role-note subtle">{user?.role === 'owner' ? 'مالك المتجر' : user?.role === 'manager' ? 'مدير' : user?.role === 'cashier' ? 'أمين صندوق' : '...'}</span><div className="avatar">{user?.displayName?.slice(0, 1) || 'ن'}</div></div></header>
      {loc === '/dashboard' && canReviewApprovals && pendingApprovals.length > 0 && <section role="status" aria-live="polite" data-testid="notice-pending-approvals" style={{ margin: '18px 22px 0', padding: '15px 18px', display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12, border: '1px solid #ecdca7', borderRadius: 12, background: '#fff8dc', color: '#765e18' }}>
        <div><strong>هناك حسابات جديدة تنتظر موافقتك</strong><div style={{ marginTop: 4, fontSize: 13 }}>عدد طلبات الموافقة: {fmt(pendingApprovals.length)}.</div></div>
        <Link href="/team" className="button" data-testid="link-review-pending-approvals">مراجعة الطلبات</Link>
      </section>}
      {children}</main>
  </div>;
}

function AccountGate({ children }: { children: ReactNode }) {
  const profile = useGetCurrentUser();
  const { signOut } = useAuthActions();
  if (profile.isLoading) return <div className="landing min-h-[100dvh] flex items-center justify-center px-5"><div className="panel state-box" style={{ width: 'min(440px, 100%)' }}><div className="state-icon"><Activity /></div><strong>جارٍ التحقق من صلاحية الحساب</strong><p>نجهز مساحة عملك بأمان.</p></div></div>;
  if (profile.isError || !profile.data) return <div className="landing min-h-[100dvh] flex items-center justify-center px-5"><div className="panel state-box error-state" style={{ width: 'min(440px, 100%)' }}><div className="state-icon"><CircleAlert /></div><strong>تعذر التحقق من الحساب</strong><p>تحقق من الاتصال ثم حاول مجددًا.</p><button className="button ghost" style={{ marginTop: 16 }} onClick={() => profile.refetch()}>إعادة المحاولة</button></div></div>;
   if (!profile.data.active) return <div className="landing min-h-[100dvh] flex items-center justify-center px-5"><section className="panel state-box" style={{ width: 'min(500px, 100%)', padding: 32 }}><Brand /><div className="state-icon" style={{ marginTop: 12, background: '#fff2c8', color: '#947322' }}><ShieldCheck /></div><strong style={{ fontSize: 18 }}>حسابك بانتظار موافقة مالك المتجر</strong><p style={{ lineHeight: 1.9 }}>تم إنشاء حسابك بنجاح، لكن الوصول إلى مساحة نسايم للمنظفات لم يُفعّل بعد. ستتمكن من تسجيل الدخول فور اعتماد حسابك من مالك المتجر.</p><button className="button ghost" style={{ marginTop: 18 }} onClick={() => { void signOut(); }}><LogOut />تسجيل الخروج</button></section></div>;
  return <>{children}</>;
}
function Guard({ children }: { children: ReactNode }) {
  const profile = useGetCurrentUser();
  if (profile.isLoading) return <div className="landing min-h-[100dvh] flex items-center justify-center px-5"><div className="panel state-box"><div className="state-icon"><Activity /></div><strong>جارٍ التحقق من الحساب</strong></div></div>;
  if (profile.isError || !profile.data) return <Redirect to={localMode ? '/sign-in' : '/'} />;
  return <AccountGate>{children}</AccountGate>;
}
function PageFrame({ title, subtitle, action, children }: { title: string; subtitle?: string; action?: ReactNode; children: ReactNode }) {
  return <div className="page"><div className="page-head"><div><div className="eyebrow">نسايم للمنظفات</div><h1 className="page-title">{title}</h1>{subtitle && <p className="page-sub">{subtitle}</p>}</div>{action}</div>{children}</div>;
}
function Loading({ count = 3 }: { count?: number }) { return <div className="stats-grid">{Array.from({ length: count }, (_, i) => <div className="skeleton-card" key={i} />)}</div>; }
function QueryState({ loading, error, retry, empty, children }: { loading: boolean; error: boolean; retry: () => void; empty?: boolean; children?: ReactNode }) {
  if (loading) return <div className="panel state-box"><div className="state-icon"><Activity /></div><strong>جارٍ تحميل بيانات المتجر</strong><p>لحظات ونعود إليك بالأرقام المحدّثة.</p></div>;
  if (error) return <div className="panel state-box error-state"><div className="state-icon"><CircleAlert /></div><strong>تعذر تحميل البيانات</strong><p>تحقق من الاتصال ثم حاول مرة أخرى.</p><button className="button ghost" style={{ marginTop: 15 }} onClick={retry}>إعادة المحاولة</button></div>;
  if (empty) return <div className="panel state-box"><div className="state-icon"><Boxes /></div><strong>لا توجد بيانات بعد</strong><p>ستظهر هنا السجلات فور إضافتها.</p></div>;
  return <>{children}</>;
}
function fmt(value: number) { return new Intl.NumberFormat('ar', { maximumFractionDigits: 2 }).format(value || 0); }
function money(value: number) { return `${fmt(value)} ر.س`; }
function date(value: string) { return new Date(value).toLocaleString('ar-SA', { calendar: 'gregory', dateStyle: 'medium', timeStyle: 'short' }); }
function useNotify() {
  const [message, setMessage] = useState('');
  const notify = (text: string) => { setMessage(text); window.setTimeout(() => setMessage(''), 2800); };
  return { message, notify, toast: message ? <div className="toast-msg" role="status">{message}</div> : null };
}
function Stat({ label, value, note, icon: Icon, tone }: { label: string; value: string; note: string; icon: typeof Package; tone?: string }) {
  return <div className="panel stat-card"><div className="stat-label"><span className={`stat-icon ${tone || ''}`}><Icon size={16} /></span>{label}</div><div className="stat-value">{value}</div><div className="stat-foot">{note}</div></div>;
}

function DashboardPage() {
  const d = useGetDashboard();
  const activity = useListRecentActivity({ limit: 8 });
  const data = d.data;
  return <Shell pageTitle="نظرة عامة"><PageFrame title="صباح الخير، نسايم" subtitle="ملخص حركة متجرك لهذا اليوم">
    {d.isLoading ? <Loading count={4} /> : d.isError ? <QueryState loading={false} error retry={() => d.refetch()} /> : <>
      <div className="stats-grid"><Stat label="إجمالي المنتجات" value={fmt(data?.productCount || 0)} note="منتج في الكتالوج" icon={Package} tone="green" /><Stat label="تحتاج إعادة طلب" value={fmt(data?.lowStockCount || 0)} note="منتجات أقل من الحد" icon={CircleAlert} tone="yellow" /><Stat label="مبيعات اليوم" value={money(data?.todaySales || 0)} note={`${fmt(data?.todaySaleCount || 0)} فاتورة اليوم`} icon={ShoppingCart} /><Stat label="ربح تقديري اليوم" value={money(data?.estimatedProfit || 0)} note="قبل المصاريف التشغيلية" icon={ChartNoAxesCombined} tone="teal" /></div>
      <div className="welcome-hero"><div><div className="eyebrow" style={{ color: '#f0cf62' }}>مركز المتجر</div><h1>كل شيء مرتب.<br />يومك يمشي بسلاسة.</h1><p>تابع المخزون، راجع المبيعات، وسجّل التوريدات من لوحة تحكم واحدة مصممة لسرعة العمل.</p><Link href="/sales" className="button yellow">تسجيل عملية بيع <ChevronLeft /></Link></div><div className="hero-mark">N</div></div>
      <div className="content-grid"><section className="panel"><div className="panel-head"><div><div className="panel-title">منتجات منخفضة المخزون</div><div className="panel-caption">تابع المنتجات التي تقترب من حد الطلب</div></div><Link href="/products" className="button ghost">كل المنتجات <ChevronLeft /></Link></div>
        {data?.lowStockProducts?.length ? <div className="table-wrap"><table className="data-table"><thead><tr><th>المنتج</th><th>المتوفر</th><th>حد التنبيه</th><th>الحالة</th></tr></thead><tbody>{data.lowStockProducts.slice(0, 5).map(p => <tr key={p.id}><td className="product-cell">{p.name}<div className="subtle">{p.category}</div></td><td>{fmt(p.stock)} {p.unit}</td><td>{fmt(p.lowStockThreshold)}</td><td><span className="pill warning">منخفض</span></td></tr>)}</tbody></table></div> : <QueryState loading={false} error={false} retry={() => d.refetch()} empty />}
      </section><section className="panel"><div className="panel-head"><div><div className="panel-title">آخر النشاطات</div><div className="panel-caption">ما يحدث في المتجر الآن</div></div><History size={18} color="#78927f" /></div>
        <QueryState loading={activity.isLoading} error={activity.isError} retry={() => activity.refetch()} empty={!activity.isLoading && !activity.isError && !activity.data?.length}><div className="activity-list">{activity.data?.map(a => <div className="activity-item" key={a.id}><div className="activity-mark">{a.kind === 'sale' ? <ShoppingCart /> : a.kind === 'supply' ? <Truck /> : <ArrowLeftRight />}</div><div><div className="activity-name">{a.label}</div><div className="activity-meta">{a.actorName} · {date(a.createdAt)}</div></div>{a.amount != null && <div className="activity-amount">{money(a.amount)}</div>}</div>)}</div></QueryState>
      </section></div>
      <section className="panel" style={{ marginTop: 18 }}><div className="panel-head"><div><div className="panel-title">آخر الفواتير</div><div className="panel-caption">الفواتير الملغاة لا تدخل في أرقام اليوم</div></div><Link href="/sales" className="button ghost">كل المبيعات <ChevronLeft /></Link></div>
        {data?.recentSales?.length ? <div className="table-wrap"><table className="data-table cards-mobile"><thead><tr><th>الفاتورة</th><th>التاريخ</th><th>الإجمالي</th><th>الحالة</th></tr></thead><tbody>{data.recentSales.slice(0, 6).map(s => <tr key={s.id} className={s.cancelledAt ? 'row-muted' : ''} data-testid={`row-recent-sale-${s.id}`}><td className="product-cell"><span className="mono">{s.invoiceNumber}</span><div className="subtle">{s.actorName}</div></td><td data-label="التاريخ">{date(s.createdAt)}</td><td data-label="الإجمالي"><b className={s.cancelledAt ? 'strike' : ''}>{money(s.total)}</b></td><td data-label="الحالة">{s.cancelledAt ? <span className="pill red">ملغاة</span> : <span className="pill">مكتملة</span>}</td></tr>)}</tbody></table></div> : <div className="state-box"><div className="state-icon"><ShoppingCart /></div><strong>لا توجد فواتير بعد</strong><p>ستظهر هنا أحدث عمليات البيع.</p></div>}
      </section>
    </>}</PageFrame></Shell>;
}

function Modal({ title, close, children }: { title: string; close: () => void; children: ReactNode }) {
  return <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) close(); }}><section className="modal" role="dialog" aria-modal="true"><div className="modal-head"><div className="modal-title">{title}</div><button className="icon-button" aria-label="إغلاق" onClick={close}><X /></button></div><div className="modal-body">{children}</div></section></div>;
}
const isManager = (role?: string) => role === 'owner' || role === 'manager';
function ProductForm({ existing, close, onSaved }: { existing?: Product; close: () => void; onSaved: () => void }) {
  const create = useCreateProduct(); const update = useUpdateProduct(); const client = useQueryClient(); const { notify, toast } = useNotify();
  const [form, setForm] = useState({ name: existing?.name || '', sku: existing?.sku || '', category: existing?.category || '', unit: existing?.unit || 'عبوة', unitsPerCarton: String(existing?.unitsPerCarton ?? 1), cartons: '0', looseUnits: String(existing?.stock ?? 0), purchasePrice: String(existing?.purchasePrice ?? ''), sellingPrice: String(existing?.sellingPrice ?? ''), lowStockThreshold: String(existing?.lowStockThreshold ?? 5) });
  const set = (key: keyof typeof form, val: string) => setForm(prev => ({ ...prev, [key]: val }));
  const unitsPerCarton = Math.max(1, Math.floor(Number(form.unitsPerCarton) || 1));
  const initialStock = existing?.stock ?? Number((Number(form.cartons) * unitsPerCarton + Number(form.looseUnits)).toFixed(3));
  function submit(e: FormEvent) { e.preventDefault(); const data: ProductInput = { name: form.name.trim(), sku: form.sku || null, category: form.category.trim(), unit: form.unit, unitsPerCarton, purchasePrice: Number(form.purchasePrice), sellingPrice: Number(form.sellingPrice), stock: initialStock, lowStockThreshold: Number(form.lowStockThreshold) };
    if (existing) update.mutate({ id: existing.id, data: { name: data.name, sku: data.sku, category: data.category, unit: data.unit, unitsPerCarton: data.unitsPerCarton, purchasePrice: data.purchasePrice, sellingPrice: data.sellingPrice, lowStockThreshold: data.lowStockThreshold } }, { onSuccess: () => { void invalidateStore(client); notify('تم تحديث المنتج'); onSaved(); }, onError: () => notify('لم يتم حفظ التغييرات') });
    else create.mutate({ data }, { onSuccess: () => { client.invalidateQueries({ queryKey: getListProductsQueryKey() }); client.invalidateQueries({ queryKey: getGetDashboardQueryKey() }); notify('تمت إضافة المنتج'); onSaved(); }, onError: () => notify('تعذر إضافة المنتج') });
  }
  return <><form onSubmit={submit}><div className="form-grid">
    <label className="form-field span2">اسم المنتج<input required value={form.name} onChange={e => set('name', e.target.value)} data-testid="input-product-name" /></label>
    <div className="span2"><label className="form-field">الباركود / رمز المنتج<input value={form.sku} onChange={e => set('sku', e.target.value)} placeholder="أدخل رقم الباركود الموجود على العبوة" /></label><div style={{ marginTop: 9 }}><BarcodeCapture disabled={create.isPending || update.isPending} onDecoded={code => set('sku', code)} onError={() => {}} /></div></div><label className="form-field">قسم الصنف<select required value={form.category} onChange={e => set('category', e.target.value)} data-testid="select-product-category"><option value="">اختر القسم</option>{PRODUCT_CATEGORIES.map(category => <option key={category} value={category}>{category}</option>)}{form.category && !PRODUCT_CATEGORIES.some(category => category === form.category) && <option value={form.category}>{form.category} (قسم سابق)</option>}</select></label>
    <label className="form-field">الوحدة<input required value={form.unit} onChange={e => set('unit', e.target.value)} /></label><label className="form-field">عدد القطع في الكرتونة<input type="number" min="1" step="1" required value={form.unitsPerCarton} onChange={e => set('unitsPerCarton', e.target.value)} /><small>التحويل خاص بهذا الصنف ولا يغيّر كمية المخزون الحالية.</small></label><label className="form-field">سعر الشراء<input type="number" min="0" step=".01" required value={form.purchasePrice} onChange={e => set('purchasePrice', e.target.value)} /></label>
    <label className="form-field">سعر البيع<input type="number" min="0" step=".01" required value={form.sellingPrice} onChange={e => set('sellingPrice', e.target.value)} /></label>
    {!existing && <><label className="form-field">عدد الكراتين الحالية<input type="number" min="0" step="1" required value={form.cartons} onChange={e => set('cartons', e.target.value)} /></label><label className="form-field">القطع المفردة<input type="number" min="0" step=".001" required value={form.looseUnits} onChange={e => set('looseUnits', e.target.value)} /></label><div className="panel span2" style={{ padding: 12 }}>إجمالي المخزون عند الإضافة: <b>{fmt(initialStock)} {form.unit}</b></div></>}
    <label className="form-field">حد تنبيه المخزون<input type="number" min="0" required value={form.lowStockThreshold} onChange={e => set('lowStockThreshold', e.target.value)} /></label>
  </div><div className="form-actions"><button className="button" disabled={create.isPending || update.isPending}>{create.isPending || update.isPending ? 'جارٍ الحفظ…' : 'حفظ المنتج'}</button><button type="button" className="button ghost" onClick={close}>إلغاء</button></div></form>{toast}</>;
}
function StockModal({ product, close, onSaved }: { product: Product; close: () => void; onSaved: () => void }) {
  const mutation = useAdjustStock(); const client = useQueryClient(); const { notify, toast } = useNotify(); const [cartons, setCartons] = useState(''); const [pieces, setPieces] = useState(''); const [reason, setReason] = useState('');
  const totalDelta = Number((Number(cartons || 0) * Math.max(1, product.unitsPerCarton ?? 1) + Number(pieces || 0)).toFixed(3));
  return <Modal title={`تعديل مخزون ${product.name}`} close={close}><form onSubmit={e => { e.preventDefault(); mutation.mutate({ id: product.id, data: { delta: totalDelta, reason } }, { onSuccess: () => { client.invalidateQueries({ queryKey: getListProductsQueryKey() }); client.invalidateQueries({ queryKey: getGetDashboardQueryKey() }); notify('تم تحديث المخزون'); onSaved(); }, onError: () => notify('تعذر تعديل المخزون') }); }}>
    <div className="form-grid"><label className="form-field">فرق الكراتين<input type="number" step="1" required value={cartons} onChange={e => setCartons(e.target.value)} placeholder="استخدم السالب للخصم" /></label><label className="form-field">فرق القطع<input type="number" step=".001" required value={pieces} onChange={e => setPieces(e.target.value)} placeholder="مثال: 3 أو -2" /></label><div className="span2 panel" style={{ padding: 12 }}>كل كرتونة = {fmt(product.unitsPerCarton ?? 1)} قطعة · التغيير الإجمالي: <b>{fmt(totalDelta)} {product.unit}</b></div><label className="form-field span2">سبب التعديل<input required value={reason} onChange={e => setReason(e.target.value)} /></label></div><div className="form-actions"><button className="button" disabled={mutation.isPending || totalDelta === 0}>تأكيد التعديل</button><button type="button" className="button ghost" onClick={close}>إلغاء</button></div></form>{toast}</Modal>;
}
function invalidateStore(client: ReturnType<typeof useQueryClient>) {
  return client.invalidateQueries({ predicate: q => { const k = q.queryKey[0]; return typeof k === 'string' && ['/api/products', '/api/sales', '/api/dashboard', '/api/activity'].some(p => k.startsWith(p)); } });
}
function ArchiveDialog({ product, close: dismiss, onDone }: { product: Product; close: () => void; onDone: (msg: string) => void }) {
  const remove = useDeleteProduct(); const client = useQueryClient();
  const close = () => { if (!remove.isPending) dismiss(); };
  return <Modal title="حذف المنتج من القائمة" close={() => { if (!remove.isPending) close(); }}><div className="confirm-box danger-box"><Trash2 /><div><strong>حذف «{product.name}»؟</strong><p>سيختفي المنتج من قائمة البيع والمخزون، لكن <b>الفواتير السابقة تبقى كما هي</b> ولا تُمسح أي مبيعات قديمة. يمكنك استعادته لاحقًا من فلتر «المنتجات المحذوفة».</p></div></div>
    {remove.isError && <div className="inline-error" role="alert"><CircleAlert />تعذر حذف المنتج. تحقق من الاتصال وحاول مرة أخرى.</div>}
    <div className="form-actions"><button className="button danger" disabled={remove.isPending} data-testid="button-confirm-archive" onClick={() => remove.mutate({ id: product.id }, { onSuccess: () => { void invalidateStore(client); onDone(`تم حذف ${product.name} من القائمة`); } })}><Trash2 />{remove.isPending ? 'جارٍ الحذف…' : 'نعم، احذف المنتج'}</button><button type="button" className="button ghost" onClick={close}>تراجع</button></div></Modal>;
}
function ProductsPage() {
  const [category, setCategory] = useState('');
  const user = useGetCurrentUser(); const [search, setSearch] = useState(''); const [filter, setFilter] = useState('active'); const [showForm, setShowForm] = useState(false); const [editing, setEditing] = useState<Product | undefined>(); const [adjusting, setAdjusting] = useState<Product | undefined>(); const [archiving, setArchiving] = useState<Product | undefined>();
  const params = { search: search || undefined, lowStock: filter === 'low' ? true : undefined, includeInactive: filter === 'archived' ? true : undefined };
  const q = useListProducts(params); const client = useQueryClient(); const update = useUpdateProduct(); const { notify, toast } = useNotify(); const canManage = isManager(user.data?.role);
  const rows = (q.data ?? []).filter(p => (filter === 'archived' ? !p.isActive : p.isActive) && (!category || p.category === category));
  const categories = Array.from(new Set<string>([...PRODUCT_CATEGORIES, ...(q.data ?? []).map(p => p.category), ...(category ? [category] : [])])).filter(Boolean);
  const restore = (p: Product) => update.mutate({ id: p.id, data: { isActive: true } }, { onSuccess: () => { void invalidateStore(client); notify(`تمت استعادة ${p.name}`); }, onError: () => notify('تعذر استعادة المنتج') });
  return <Shell pageTitle="المنتجات والمخزون"><PageFrame title="المنتجات والمخزون" subtitle="أضف المنتجات، عدّل بياناتها، أو احذفها من القائمة" action={canManage ? <button className="button big" onClick={() => setShowForm(true)} data-testid="button-add-product"><Plus />إضافة منتج</button> : undefined}>
    <div className="panel"><div className="filters"><div className="search-row"><div className="field-search"><Search /><input placeholder="ابحث بالاسم أو الباركود…" value={search} onChange={e => setSearch(e.target.value)} data-testid="input-search-products" /></div><label className="form-field">قسم الصنف<select value={category} onChange={e => setCategory(e.target.value)} data-testid="filter-product-category"><option value="">كل الأقسام</option>{categories.map(value => <option key={value} value={value}>{value}</option>)}</select></label><div className="seg" role="tablist">{[['active', 'المنتجات الحالية'], ['low', 'مخزون منخفض'], ['archived', 'المنتجات المحذوفة']].map(([v, l]) => <button key={v} type="button" className={filter === v ? 'on' : ''} onClick={() => setFilter(v)} data-testid={`filter-${v}`}>{l}</button>)}</div></div><span className="subtle">{fmt(rows.length)} منتج</span></div>
      <QueryState loading={q.isLoading} error={q.isError} retry={() => q.refetch()} empty={!q.isLoading && !q.isError && !rows.length}><div className="table-wrap"><table className="data-table cards-mobile"><thead><tr><th>المنتج</th><th>التصنيف</th><th>الكرتون</th><th>القطع المفردة</th><th>إجمالي المخزون</th><th>سعر الشراء</th><th>سعر البيع</th><th>الحالة</th>{canManage && <th>إجراءات</th>}</tr></thead><tbody>{rows.map(p => { const cartonSize = Math.max(1, p.unitsPerCarton ?? 1); const cartonCount = Math.floor(p.stock / cartonSize); const looseCount = Number((p.stock - cartonCount * cartonSize).toFixed(3)); return <tr key={p.id} className={p.isActive ? '' : 'row-muted'} data-testid={`row-product-${p.id}`}><td className="product-cell">{p.name}<div className="subtle mono">{p.sku || 'بدون باركود'}</div></td><td data-label="التصنيف">{p.category}</td><td data-label="الكرتون">{fmt(cartonCount)} <small>({fmt(cartonSize)} قطعة/كرتونة)</small></td><td data-label="القطع المفردة">{fmt(looseCount)}</td><td data-label="إجمالي المخزون"><b>{fmt(p.stock)}</b> {p.unit}</td><td data-label="سعر الشراء">{money(p.purchasePrice)}</td><td data-label="سعر البيع">{money(p.sellingPrice)}</td><td data-label="الحالة">{!p.isActive ? <span className="pill red">محذوف</span> : <span className={`pill ${p.stock <= p.lowStockThreshold ? 'warning' : ''}`}>{p.stock <= p.lowStockThreshold ? 'مخزون منخفض' : 'متوفر'}</span>}</td>{canManage && <td className="actions-cell"><div className="actions">{p.isActive ? <><button className="act" onClick={() => setEditing(p)} data-testid={`button-edit-${p.id}`}><Pencil />تعديل المنتج</button><button className="act" onClick={() => setAdjusting(p)}><ArrowLeftRight />تعديل الكمية</button><button className="act danger" onClick={() => setArchiving(p)} data-testid={`button-delete-${p.id}`}><Trash2 />حذف المنتج</button></> : <button className="act" disabled={update.isPending} onClick={() => restore(p)} data-testid={`button-restore-${p.id}`}><RotateCcw />{update.isPending && update.variables?.id === p.id ? 'جارٍ الاستعادة…' : 'استعادة المنتج'}</button>}</div></td>}</tr>; })}</tbody></table></div></QueryState>
    </div>
    {showForm && <Modal title="إضافة منتج جديد" close={() => setShowForm(false)}><ProductForm close={() => setShowForm(false)} onSaved={() => setShowForm(false)} /></Modal>}
    {editing && <Modal title="تعديل بيانات المنتج" close={() => setEditing(undefined)}><ProductForm existing={editing} close={() => setEditing(undefined)} onSaved={() => setEditing(undefined)} /></Modal>}
    {archiving && <ArchiveDialog product={archiving} close={() => setArchiving(undefined)} onDone={m => { setArchiving(undefined); notify(m); }} />}
    {adjusting && <StockModal product={adjusting} close={() => setAdjusting(undefined)} onSaved={() => setAdjusting(undefined)} />}{toast}
  </PageFrame></Shell>;
}

function CancelSaleDialog({ sale, close: dismiss, onDone }: { sale: Sale; close: () => void; onDone: () => void }) {
  const cancel = useCancelSale(); const client = useQueryClient(); const [reason, setReason] = useState(''); const [ok, setOk] = useState(false);
  const close = () => { if (!cancel.isPending) dismiss(); };
  return <Modal title={`إلغاء الفاتورة ${sale.invoiceNumber}`} close={() => { if (!cancel.isPending) close(); }}><form onSubmit={e => { e.preventDefault(); if (!ok || !reason.trim() || cancel.isPending) return; cancel.mutate({ id: sale.id, data: { reason: reason.trim() } }, { onSuccess: () => { void invalidateStore(client); onDone(); } }); }}>
    <div className="confirm-box danger-box"><Ban /><div><strong>ماذا يحدث عند الإلغاء؟</strong><p>ستعود الكميات ({fmt(sale.items.reduce((a, i) => a + i.quantity, 0))} قطعة) إلى المخزون، ولن تُحسب الفاتورة ({money(sale.total)}) في المبيعات أو الأرباح. الفاتورة لا تُمسح، وتبقى في السجل بعلامة «ملغاة».</p></div></div>
    <label className="form-field" style={{ marginTop: 14 }}>سبب الإلغاء (مطلوب)<textarea required maxLength={500} value={reason} onChange={e => setReason(e.target.value)} placeholder="مثال: الزبون أرجع البضاعة" data-testid="input-cancel-reason" /></label>
    <label className="check-row"><input type="checkbox" checked={ok} onChange={e => setOk(e.target.checked)} data-testid="check-cancel-confirm" />أفهم أن البضاعة ستعود للمخزون وأن الفاتورة لن تُحسب في الأرباح</label>
    {cancel.isError && <div className="inline-error" role="alert"><CircleAlert />تعذر إلغاء الفاتورة. قد لا تملك الصلاحية أو أن الاتصال انقطع.</div>}
    <div className="form-actions"><button className="button danger" disabled={!ok || !reason.trim() || cancel.isPending} data-testid="button-confirm-cancel-sale"><Ban />{cancel.isPending ? 'جارٍ الإلغاء…' : 'تأكيد إلغاء الفاتورة'}</button><button type="button" className="button ghost" onClick={close}>تراجع</button></div></form></Modal>;
}
type Line = { productId: string; quantity: number };
function SalesPage() {
  const user = useGetCurrentUser(); const products = useListProducts(); const sales = useListSales({ limit: 100 }); const create = useCreateSale(); const client = useQueryClient(); const [newSale, setNewSale] = useState(false); const [invoiceId, setInvoiceId] = useState(''); const { notify, toast } = useNotify(); const canSell = !!user.data; const canManage = isManager(user.data?.role);
  const invoice = useGetSaleInvoice(invoiceId, { query: { enabled: !!invoiceId, queryKey: getGetSaleInvoiceQueryKey(invoiceId) } });
  const [lines, setLines] = useState<Line[]>([]); const [discount, setDiscount] = useState('0'); const [notes, setNotes] = useState(''); const [historySearch, setHistorySearch] = useState(''); const [productSearch, setProductSearch] = useState(''); const [editingProduct, setEditingProduct] = useState<Product | undefined>(); const [cancelling, setCancelling] = useState<Sale | undefined>();
  const active = products.data?.filter(p => p.isActive) ?? [];
  const byId = (id: string) => products.data?.find(p => p.id === id);
  const subtotal = lines.reduce((a, l) => a + (byId(l.productId)?.sellingPrice ?? 0) * (Number(l.quantity) || 0), 0);
  const disc = Math.max(0, Number(discount) || 0); const total = Math.max(0, subtotal - disc);
  const validLines = lines.filter(l => l.productId && l.quantity > 0);
  const resetDraft = () => { setLines([]); setDiscount('0'); setNotes(''); setProductSearch(''); };
  const closeSale = () => { setNewSale(false); resetDraft(); };
  const addProductToSale = (product: Product) => {
    const existingIndex = lines.findIndex(line => line.productId === product.id);
    const nextQuantity = (existingIndex >= 0 ? lines[existingIndex].quantity : 0) + 1;
    if (nextQuantity > product.stock) { const message = `الكمية المتاحة من ${product.name} لا تكفي.`; notify(message); return message; }
    if (existingIndex >= 0) setLines(prev => prev.map((line, index) => index === existingIndex ? { ...line, quantity: nextQuantity } : line));
    else { const emptyIndex = lines.findIndex(l => !l.productId); if (emptyIndex >= 0) setLines(prev => prev.map((l, i) => i === emptyIndex ? { productId: product.id, quantity: 1 } : l)); else setLines(prev => [...prev, { productId: product.id, quantity: 1 }]); }
    notify(`تمت إضافة ${product.name} إلى الفاتورة`);
    return undefined;
  };
  const addScannedProduct = (code: string) => {
    const normalizedCode = code.trim().toLocaleLowerCase();
    const matches = active.filter(p => p.sku?.trim().toLocaleLowerCase() === normalizedCode);
    if (matches.length > 1) { const message = `الرمز ${code} مرتبط بأكثر من منتج. صحح رموز المنتجات أولاً.`; notify(message); return message; }
    const product = matches[0];
    if (!product) { const message = `لم يتم العثور على منتج بالرمز ${code}. أضف الرمز إلى بيانات المنتج أولاً.`; notify(message); return message; }
    return addProductToSale(product);
  };
  const nameMatches = productSearch.trim()
    ? active.filter(p => p.name.toLocaleLowerCase().includes(productSearch.trim().toLocaleLowerCase())).slice(0, 8)
    : [];
  const submitSale = (e: FormEvent) => { e.preventDefault(); if (!validLines.length) { notify('أضف صنفًا واحدًا على الأقل'); return; } if (lines.some(line => !line.productId)) { notify('اختر المنتج في كل سطر من أصناف الفاتورة'); return; } create.mutate({ data: { items: validLines.map(l => ({ productId: l.productId, quantity: Number(l.quantity) })), discount: disc, notes: notes || null } }, { onSuccess: sale => { void invalidateStore(client); notify('تم تسجيل البيع'); closeSale(); setInvoiceId(sale.id); }, onError: () => notify('تعذر تسجيل البيع؛ تحقق من الكميات') }); };
  const term = historySearch.trim().toLocaleLowerCase();
  const shown = (sales.data ?? []).filter(s => !term || [s.invoiceNumber, s.actorName, s.notes ?? '', s.cancellationReason ?? '', ...s.items.map(i => i.productName)].some(t => t.toLocaleLowerCase().includes(term)));
  const inv = invoice.data;
  return <Shell pageTitle="المبيعات والفواتير"><PageFrame title="المبيعات والفواتير" subtitle="سجّل البيع، وراجع الفواتير أو ألغِها" action={canSell ? <button className="button big" onClick={() => setNewSale(true)} data-testid="button-new-sale"><Plus />تسجيل بيع جديد</button> : undefined}>
    <div className="panel"><div className="panel-head"><div><div className="panel-title">سجل المبيعات</div><div className="panel-caption">آخر ١٠٠ فاتورة · الفواتير الملغاة تبقى ظاهرة للمراجعة</div></div><div className="field-search"><Search /><input placeholder="ابحث برقم الفاتورة أو المنتج أو البائع…" value={historySearch} onChange={e => setHistorySearch(e.target.value)} data-testid="input-search-sales" /></div></div>
      <QueryState loading={sales.isLoading} error={sales.isError} retry={() => sales.refetch()} empty={!sales.isLoading && !sales.isError && !shown.length}><div className="table-wrap"><table className="data-table cards-mobile"><thead><tr><th>رقم الفاتورة</th><th>التاريخ</th><th>الأصناف</th><th>الإجمالي</th><th>الحالة</th><th>سجلها</th><th></th></tr></thead><tbody>{shown.map(s => <tr key={s.id} className={s.cancelledAt ? 'row-muted' : ''} data-testid={`row-sale-${s.id}`}><td className="product-cell"><span className="mono">{s.invoiceNumber}</span></td><td data-label="التاريخ">{date(s.createdAt)}</td><td data-label="الأصناف">{s.items.length}</td><td data-label="الإجمالي"><b className={s.cancelledAt ? 'strike' : ''}>{money(s.total)}</b></td><td data-label="الحالة">{s.cancelledAt ? <span className="pill red">ملغاة</span> : <span className="pill">مكتملة</span>}</td><td data-label="سجلها">{s.actorName}</td><td className="actions-cell"><div className="actions"><button className="act" onClick={() => setInvoiceId(s.id)} data-testid={`button-invoice-${s.id}`}><FileText />عرض الفاتورة</button>{canManage && !s.cancelledAt && <button className="act danger" onClick={() => setCancelling(s)} data-testid={`button-cancel-sale-${s.id}`}><Ban />إلغاء الفاتورة</button>}</div></td></tr>)}</tbody></table></div></QueryState></div>
    {newSale && <Modal title="تسجيل عملية بيع" close={closeSale}><form onSubmit={submitSale}>
      <div className="scan-box">
        <label className="form-field" htmlFor="sale-product-search">ابحث عن الصنف بالاسم<input id="sale-product-search" autoComplete="off" placeholder="اكتب اسم الصنف المسجل لإضافته بدون باركود…" value={productSearch} onChange={e => setProductSearch(e.target.value)} disabled={create.isPending || products.isLoading || products.isError} data-testid="input-sale-product-name" /></label>
        {productSearch.trim() && <div role="listbox" aria-label="الأصناف المطابقة" style={{ display: 'grid', gap: 6, marginTop: 7, marginBottom: 14, maxHeight: 220, overflowY: 'auto' }}>
          {nameMatches.length ? nameMatches.map(product => <button key={product.id} type="button" role="option" aria-selected="false" className="button ghost" style={{ justifyContent: 'space-between', textAlign: 'right' }} onClick={() => { addProductToSale(product); setProductSearch(''); }} data-testid={`button-add-product-${product.id}`}><span>{product.name}</span><span className="subtle">متوفر {fmt(product.stock)} · {money(product.sellingPrice)}</span></button>) : <div className="subtle" style={{ padding: '8px 2px' }}>{products.isLoading ? 'جارٍ تحميل الأصناف…' : 'لا يوجد صنف مطابق للاسم المكتوب'}</div>}
        </div>}
        <div className="panel-caption" style={{ margin: '12px 0 9px' }}>ابحث بالاسم أو امسح الباركود لإضافة الصنف مباشرة</div>
        {products.isError && <div className="inline-error" role="alert">تعذر تحميل الأصناف. <button type="button" className="act" onClick={() => products.refetch()}>إعادة المحاولة</button></div>}
        <BarcodeCapture disabled={create.isPending || products.isLoading || products.isError} onDecoded={addScannedProduct} onError={() => {}} />
      </div>
      <div className="draft-head"><strong>أصناف الفاتورة</strong>{lines.length > 0 && <button type="button" className="act danger" onClick={resetDraft} data-testid="button-reset-draft"><RotateCcw />تفريغ الفاتورة</button>}</div>
      {!lines.length && <div className="draft-empty"><ShoppingCart /><div>لا توجد أصناف بعد. ابحث باسم الصنف أو امسح باركود أو اضغط «إضافة صنف».</div></div>}
      {lines.map((line, i) => { const p = byId(line.productId); return <div className="sale-line" key={i} data-testid={`line-${i}`}>
        <SaleProductSelect products={active} value={line.productId} disabled={create.isPending} onChange={id => setLines(prev => prev.map((item, n) => n === i ? { ...item, productId: id } : item))} />
        <label className="form-field qty">الكمية<div className="stepper"><button type="button" onClick={() => setLines(prev => prev.map((x, n) => n === i ? { ...x, quantity: Math.max(1, x.quantity - 1) } : x))} aria-label="إنقاص"><Minus /></button><input type="number" min="1" max={p?.stock} required value={line.quantity} onChange={e => setLines(prev => prev.map((item, n) => n === i ? { ...item, quantity: Number(e.target.value) } : item))} aria-label="الكمية" /><button type="button" onClick={() => setLines(prev => prev.map((x, n) => n === i ? { ...x, quantity: x.quantity + 1 } : x))} aria-label="زيادة"><Plus /></button></div></label>
        <div className="line-total"><span className="subtle">{p ? `${money(p.sellingPrice)} للوحدة` : '—'}</span><b>{money((p?.sellingPrice ?? 0) * (line.quantity || 0))}</b></div>
        <div className="line-actions">{canManage && p && <button type="button" className="act" onClick={() => setEditingProduct(p)}><Pencil />تعديل المنتج</button>}<button type="button" className="act danger" onClick={() => setLines(prev => prev.filter((_, n) => n !== i))} data-testid={`button-remove-line-${i}`}><Trash2 />إزالة</button></div>
      </div>; })}
      <button type="button" className="button ghost" onClick={() => setLines(prev => [...prev, { productId: '', quantity: 1 }])} data-testid="button-add-line"><Plus />إضافة صنف</button>
      <div className="form-grid" style={{ marginTop: 18 }}><label className="form-field">التخفيض (ر.س)<input type="number" min="0" step=".01" value={discount} onChange={e => setDiscount(e.target.value)} /></label><label className="form-field">ملاحظات<input value={notes} onChange={e => setNotes(e.target.value)} /></label></div>
      <div className="totals" data-testid="draft-totals"><div><span>المجموع</span><b>{money(subtotal)}</b></div><div><span>التخفيض</span><b>{money(disc)}</b></div><div className="grand"><span>الإجمالي المطلوب</span><b>{money(total)}</b></div>{disc > subtotal && <div className="inline-error"><CircleAlert />التخفيض أكبر من المجموع</div>}</div>
      <div className="form-actions"><button className="button big" disabled={create.isPending || !validLines.length} data-testid="button-save-sale">{create.isPending ? 'جارٍ تسجيل البيع…' : `حفظ البيع · ${money(total)}`}</button><button type="button" className="button ghost" onClick={closeSale}>إغلاق</button></div></form></Modal>}
    {editingProduct && <Modal title="تعديل بيانات المنتج" close={() => setEditingProduct(undefined)}><ProductForm existing={editingProduct} close={() => setEditingProduct(undefined)} onSaved={() => { setEditingProduct(undefined); void invalidateStore(client); }} /></Modal>}
    {invoiceId && <Modal title="فاتورة البيع" close={() => setInvoiceId('')}><QueryState loading={invoice.isLoading} error={invoice.isError} retry={() => invoice.refetch()}>{inv && <div className="invoice-view">{inv.cancelledAt && <div className="cancel-banner" data-testid="status-invoice-cancelled"><Ban /><div><strong>فاتورة ملغاة</strong><div>بتاريخ {date(inv.cancelledAt)}{inv.cancelledBy ? ` · بواسطة ${inv.cancelledBy}` : ''}</div>{inv.cancellationReason && <div>السبب: {inv.cancellationReason}</div>}<div className="subtle">لا تُحسب في المبيعات أو الأرباح، وأُعيدت كمياتها للمخزون.</div></div></div>}<div style={{ textAlign: 'center', paddingBottom: 18, borderBottom: '1px dashed #dcded3' }}><Brand small /><h2>فاتورة مبيعات</h2><span className="mono">{inv.invoiceNumber}</span><div className="subtle">{date(inv.createdAt)}</div></div><div className="table-wrap"><table className="data-table"><thead><tr><th>الصنف</th><th>الكمية</th><th>سعر الوحدة</th><th>الإجمالي</th></tr></thead><tbody>{inv.items.map((item, i) => <tr key={i}><td>{item.productName}</td><td>{fmt(item.quantity)}</td><td>{money(item.unitPrice)}</td><td>{money(item.lineTotal)}</td></tr>)}</tbody></table></div><div style={{ textAlign: 'left', padding: '16px 0', lineHeight: 2 }}><div>المجموع: {money(inv.subtotal)}</div><div>التخفيض: {money(inv.discount)}</div><strong className={inv.cancelledAt ? 'strike' : ''}>الإجمالي: {money(inv.total)}</strong></div><div className="form-actions"><button className="button ghost" onClick={() => window.print()}><Printer />طباعة الفاتورة</button>{canManage && <button className="button danger" disabled={!!inv.cancelledAt} onClick={() => setCancelling(inv)} data-testid="button-cancel-invoice"><Ban />{inv.cancelledAt ? 'الفاتورة ملغاة' : 'إلغاء الفاتورة'}</button>}</div></div>}</QueryState></Modal>}
    {cancelling && <CancelSaleDialog sale={cancelling} close={() => setCancelling(undefined)} onDone={() => { setCancelling(undefined); notify('تم إلغاء الفاتورة وإعادة الكميات للمخزون'); }} />}{toast}
  </PageFrame></Shell>;
}

function SuppliesPage() {
  const user = useGetCurrentUser(); const q = useListSupplies({ limit: 100 }); const products = useListProducts(); const debts = useListDebts(); const create = useCreateSupply(); const client = useQueryClient(); const [open, setOpen] = useState(false); const [tab, setTab] = useState<'goods' | 'payments'>('goods'); const [supplierName, setSupplierName] = useState(''); const [reference, setReference] = useState(''); const [notes, setNotes] = useState(''); const [amountPaid, setAmountPaid] = useState('0'); const [lines, setLines] = useState([{ productId: '', quantity: 1, unitCost: 0 }]); const { notify, toast } = useNotify(); const canManage = isManager(user.data?.role);
  const supplyTotal = Number(lines.reduce((sum, line) => sum + line.quantity * line.unitCost, 0).toFixed(2));
  const remaining = Number((supplyTotal - Number(amountPaid || 0)).toFixed(2));
  const reset = () => { setOpen(false); setSupplierName(''); setReference(''); setNotes(''); setAmountPaid('0'); setLines([{ productId: '', quantity: 1, unitCost: 0 }]); };
  function addScannedSupplyProduct(code: string) {
    const normalizedCode = code.trim().toLocaleLowerCase();
    const matches = products.data?.filter(p => p.sku?.trim().toLocaleLowerCase() === normalizedCode) ?? [];
    if (matches.length > 1) { const message = `الرمز ${code} مرتبط بأكثر من منتج. صحح رموز المنتجات أولاً.`; notify(message); return message; }
    const product = matches[0];
    if (!product) { const message = `لم يتم العثور على منتج بالرمز ${code}. أضف المنتج ورمزه أولاً.`; notify(message); return message; }
    const existingIndex = lines.findIndex(line => line.productId === product.id);
    if (existingIndex >= 0) {
      setLines(prev => prev.map((line, index) => index === existingIndex ? { ...line, quantity: line.quantity + 1 } : line));
    } else {
      const emptyIndex = lines.findIndex(line => !line.productId);
      const nextLine = { productId: product.id, quantity: 1, unitCost: Number(product.purchasePrice) };
      if (emptyIndex >= 0) setLines(prev => prev.map((line, index) => index === emptyIndex ? nextLine : line));
      else setLines(prev => [...prev, nextLine]);
    }
    notify(`تمت إضافة ${product.name} إلى التوريد`);
    return undefined;
  }
  function submit(e: FormEvent) { e.preventDefault(); if (Number(amountPaid) > supplyTotal) { notify('المبلغ المدفوع أكبر من إجمالي التوريد'); return; } create.mutate({ data: { supplierName, reference: reference || null, notes: notes || null, amountPaid: Number(amountPaid || 0), items: lines.filter(l => l.productId && l.quantity > 0).map(l => ({ productId: l.productId, quantity: Number(l.quantity), unitCost: Number(l.unitCost) })) } }, { onSuccess: () => { client.invalidateQueries({ queryKey: getListSuppliesQueryKey() }); client.invalidateQueries({ queryKey: getListProductsQueryKey() }); client.invalidateQueries({ queryKey: getGetDashboardQueryKey() }); client.invalidateQueries({ queryKey: getListRecentActivityQueryKey() }); client.invalidateQueries({ queryKey: ['/api/debts'] }); notify('تم تسجيل التوريد وتحديث المخزون'); reset(); }, onError: () => notify('تعذر تسجيل التوريد') }); }
  const supplierPayments = (debts.data ?? []).filter(d => d.partyType === 'supplier').flatMap(d => d.payments.map(p => ({ ...p, partyName: d.partyName, direction: d.direction })));
  return <Shell pageTitle="التوريدات"><PageFrame title="التوريدات" subtitle="تابع البضائع المستلمة وما تم دفعه للموردين" action={canManage ? <button className="button green" onClick={() => setOpen(true)}><Plus />تسجيل توريد</button> : undefined}><div className="panel"><div className="panel-head"><div><div className="panel-title">سجل الموردين</div><div className="panel-caption">فصل واضح بين فواتير البضائع والمدفوعات</div></div><Truck size={18} color="#78927f" /></div><div className="seg" role="tablist" style={{ marginBottom: 16 }}><button type="button" role="tab" aria-selected={tab === 'goods'} className={tab === 'goods' ? 'on' : ''} onClick={() => setTab('goods')}>البضائع والتوريدات</button><button type="button" role="tab" aria-selected={tab === 'payments'} className={tab === 'payments' ? 'on' : ''} onClick={() => setTab('payments')}>المدفوعات</button></div>
    {tab === 'goods' ? <QueryState loading={q.isLoading} error={q.isError} retry={() => q.refetch()} empty={!q.isLoading && !q.isError && !q.data?.length}><div className="table-wrap"><table className="data-table"><thead><tr><th>المورد</th><th>المرجع</th><th>التاريخ</th><th>الأصناف</th><th>الإجمالي</th><th>المدفوع</th><th>المتبقي</th><th>استلمها</th></tr></thead><tbody>{q.data?.map(s => <tr key={s.id}><td className="product-cell">{s.supplierName}</td><td className="mono">{s.reference || '—'}</td><td>{date(s.createdAt)}</td><td>{s.items.length}</td><td><b>{money(s.total)}</b></td><td>{s.amountPaid == null ? 'غير مسجل' : money(s.amountPaid)}</td><td>{s.amountPaid == null ? '—' : money(Math.max(0, s.total - s.amountPaid))}</td><td>{s.actorName}</td></tr>)}</tbody></table></div></QueryState> : <QueryState loading={debts.isLoading} error={debts.isError} retry={() => debts.refetch()} empty={!debts.isLoading && !debts.isError && !supplierPayments.length}><div className="table-wrap"><table className="data-table"><thead><tr><th>المورد</th><th>نوع الحركة</th><th>التاريخ</th><th>المبلغ المدفوع</th><th>ملاحظات</th><th>سجلها</th></tr></thead><tbody>{supplierPayments.map(p => <tr key={p.id}><td className="product-cell">{p.partyName}</td><td>سداد للمورد</td><td>{date(p.createdAt)}</td><td><b>{money(p.amount)}</b></td><td>{p.notes || '—'}</td><td>{p.actorName}</td></tr>)}</tbody></table></div></QueryState>}</div>
    {open && <Modal title="تسجيل توريد جديد" close={reset}><form onSubmit={submit}>
      <div className="form-grid"><label className="form-field">اسم المورد<input required value={supplierName} onChange={e => setSupplierName(e.target.value)} /></label><label className="form-field">رقم المرجع<input value={reference} onChange={e => setReference(e.target.value)} /></label></div>
      <div className="panel" style={{ marginTop: 16, padding: 14 }}>
        <div className="panel-caption" style={{ marginBottom: 9 }}>امسح باركود الصنف لإضافته إلى التوريد</div>
        {products.isError && <div className="inline-error" role="alert">تعذر تحميل الأصناف. <button type="button" className="act" onClick={() => products.refetch()}>إعادة المحاولة</button></div>}
        <BarcodeCapture disabled={create.isPending || products.isLoading || products.isError} onDecoded={addScannedSupplyProduct} onError={() => {}} />
      </div>
      <div style={{ marginTop: 18, fontWeight: 700 }}>الأصناف المستلمة</div>{lines.map((line, i) => <div className="line-editor" key={i}><select required value={line.productId} onChange={e => setLines(p => p.map((x, n) => n === i ? { ...x, productId: e.target.value } : x))}><option value="">اختر المنتج</option>{products.data?.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select><input type="number" min="1" required value={line.quantity} aria-label="الكمية بالقطع" onChange={e => setLines(p => p.map((x, n) => n === i ? { ...x, quantity: Number(e.target.value) } : x))} /><input type="number" min="0" step=".01" required value={line.unitCost} aria-label="تكلفة الوحدة" onChange={e => setLines(p => p.map((x, n) => n === i ? { ...x, unitCost: Number(e.target.value) } : x))} />{lines.length > 1 && <button type="button" className="icon-button" onClick={() => setLines(p => p.filter((_, n) => n !== i))}><X /></button>}</div>)}<button type="button" className="button ghost" onClick={() => setLines(p => [...p, { productId: '', quantity: 1, unitCost: 0 }])}><Plus />إضافة صنف</button><div className="form-grid" style={{ marginTop: 14 }}><label className="form-field">إجمالي التوريد<input value={supplyTotal.toFixed(2)} readOnly /></label><label className="form-field">المدفوع الآن<input type="number" min="0" max={supplyTotal} step=".01" required value={amountPaid} onChange={e => setAmountPaid(e.target.value)} /></label><div className="panel span2" style={{ padding: 12 }}>المتبقي للمورد: <b>{money(Math.max(0, remaining))}</b></div></div><label className="form-field" style={{ marginTop: 14 }}>ملاحظات<input value={notes} onChange={e => setNotes(e.target.value)} /></label><div className="form-actions"><button className="button green" disabled={create.isPending || Number(amountPaid) > supplyTotal}>حفظ التوريد</button><button type="button" className="button ghost" onClick={reset}>إلغاء</button></div></form></Modal>}{toast}</PageFrame></Shell>;
}

const expenseCategories = [
  { value: 'electricity', label: 'الكهرباء' },
  { value: 'water', label: 'المياه' },
  { value: 'rent', label: 'الإيجار' },
  { value: 'salaries', label: 'المرتبات' },
  { value: 'other', label: 'مصروفات أخرى' },
] as const;
function localDateInput() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function FinancePage() {
  const user = useGetCurrentUser(); const canManage = isManager(user.data?.role); const client = useQueryClient(); const { notify, toast } = useNotify();
  const [month, setMonth] = useState(() => localDateInput().slice(0, 7)); const [adding, setAdding] = useState(false);
  const [category, setCategory] = useState<(typeof expenseCategories)[number]['value']>('electricity');
  const [amount, setAmount] = useState(''); const [expenseDate, setExpenseDate] = useState(localDateInput()); const [notes, setNotes] = useState('');
  const summary = useGetMonthlyFinance({ month }); const expenses = useListExpenses({ month }); const create = useCreateExpense();
  const reset = () => { setAdding(false); setAmount(''); setExpenseDate(localDateInput()); setNotes(''); setCategory('electricity'); };
  function submit(e: FormEvent) {
    e.preventDefault();
    create.mutate({ data: { category, amount: Number(amount), expenseDate, notes: notes || null } }, {
      onSuccess: () => { void client.invalidateQueries({ queryKey: ['/api/finance/monthly'] }); void client.invalidateQueries({ queryKey: ['/api/expenses'] }); notify('تم تسجيل المصروف وتحديث صافي الربح'); reset(); },
      onError: () => notify('تعذر تسجيل المصروف'),
    });
  }
  const report = summary.data;
  return <Shell pageTitle="الربح الشهري"><PageFrame title="الربح الشهري" subtitle="المبيعات ناقص تكلفة البضاعة المباعة فعلًا، ثم خصم المصروفات التشغيلية." action={canManage ? <button className="button green" onClick={() => setAdding(true)}><Plus />تسجيل مصروف</button> : undefined}>
    <div className="panel" style={{ marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}><div><div className="panel-title">الفترة المحاسبية</div><div className="panel-caption">يُحسب الشهر حسب توقيت المحل، ولا تُحسب الفواتير الملغاة.</div></div><label className="form-field" style={{ minWidth: 180 }}>اختر الشهر<input aria-label="الشهر" type="month" value={month} onChange={e => setMonth(e.target.value)} /></label></div>
    <QueryState loading={summary.isLoading} error={summary.isError} retry={() => summary.refetch()}>
      {report && <div className="stats-grid">
        <Stat label="إجمالي المبيعات" value={money(report.salesRevenue)} note="فواتير مكتملة فقط" icon={ShoppingCart} />
        <Stat label="تكلفة البضاعة المباعة" value={money(report.costOfGoodsSold)} note="حسب تكلفة الأصناف وقت البيع" icon={Package} />
        <Stat label="الربح قبل المصروفات" value={money(report.grossProfit)} note="المبيعات ناقص تكلفة المباع" icon={ChartNoAxesCombined} />
        <Stat label="إجمالي المصروفات" value={money(report.expensesTotal)} note="مصروفات الشهر المسجلة" icon={ArrowDownToLine} />
        <Stat label="صافي ربح الشهر" value={money(report.netProfit)} note="بعد خصم المصروفات" icon={ChartNoAxesCombined} />
      </div>}
    </QueryState>
    <div className="panel" style={{ marginTop: 16 }}><div className="panel-head"><div><div className="panel-title">تفصيل مصروفات الشهر</div><div className="panel-caption">الكهرباء والمياه والإيجار والمرتبات وغيرها</div></div></div>
      <QueryState loading={expenses.isLoading} error={expenses.isError} retry={() => expenses.refetch()} empty={!expenses.isLoading && !expenses.isError && !expenses.data?.length}>
        <div className="table-wrap"><table className="data-table"><thead><tr><th>التاريخ</th><th>البند</th><th>المبلغ</th><th>ملاحظات</th><th>سجلها</th></tr></thead><tbody>{expenses.data?.map(item => <tr key={item.id}><td>{item.expenseDate}</td><td>{expenseCategories.find(c => c.value === item.category)?.label ?? item.category}</td><td><b>{money(item.amount)}</b></td><td>{item.notes || '—'}</td><td>{item.actorName}</td></tr>)}</tbody></table></div>
      </QueryState>
    </div>
    {adding && <Modal title="تسجيل مصروف تشغيلي" close={reset}><form onSubmit={submit}><div className="form-grid">
      <label className="form-field">نوع المصروف<select value={category} onChange={e => setCategory(e.target.value as typeof category)}>{expenseCategories.map(item => <option value={item.value} key={item.value}>{item.label}</option>)}</select></label>
      <label className="form-field">المبلغ<input required type="number" min=".01" step=".01" value={amount} onChange={e => setAmount(e.target.value)} /></label>
      <label className="form-field">تاريخ المصروف<input required type="date" value={expenseDate} onChange={e => setExpenseDate(e.target.value)} /></label>
      <label className="form-field span2">ملاحظات<input value={notes} onChange={e => setNotes(e.target.value)} placeholder="مثال: فاتورة الكهرباء" /></label>
    </div><div className="form-actions"><button className="button green" disabled={create.isPending}>{create.isPending ? 'جارٍ الحفظ…' : 'حفظ المصروف'}</button><button type="button" className="button ghost" onClick={reset}>إلغاء</button></div></form></Modal>}
    {toast}
  </PageFrame></Shell>;
}

function DebtsPage() {
  const user = useGetCurrentUser(); const canManage = isManager(user.data?.role); const client = useQueryClient(); const debts = useListDebts();
  const create = useCreateDebt(); const pay = useCreateDebtPayment(); const { notify, toast } = useNotify();
  const [adding, setAdding] = useState(false); const [direction, setDirection] = useState<'receivable' | 'payable'>('receivable');
  const [partyName, setPartyName] = useState(''); const [principal, setPrincipal] = useState(''); const [initialPaid, setInitialPaid] = useState('0'); const [debtNotes, setDebtNotes] = useState('');
  const [paying, setPaying] = useState<Debt | undefined>(); const [paymentAmount, setPaymentAmount] = useState(''); const [paymentNotes, setPaymentNotes] = useState('');
  const resetCreate = () => { setAdding(false); setDirection('receivable'); setPartyName(''); setPrincipal(''); setInitialPaid('0'); setDebtNotes(''); };
  const invalidateDebts = () => { void client.invalidateQueries({ queryKey: ['/api/debts'] }); void client.invalidateQueries({ queryKey: getListSuppliesQueryKey() }); };
  function submitDebt(e: FormEvent) {
    e.preventDefault();
    const amountValue = Number(principal); const paidValue = Number(initialPaid || 0);
    if (paidValue > amountValue) { notify('المبلغ المدفوع أكبر من أصل الدين'); return; }
    create.mutate({ data: { direction, partyType: direction === 'receivable' ? 'customer' : 'supplier', partyName: partyName.trim(), amount: amountValue, paidAmount: paidValue, notes: debtNotes || null } }, {
      onSuccess: () => { invalidateDebts(); notify('تم تسجيل الدين'); resetCreate(); },
      onError: () => notify('تعذر تسجيل الدين'),
    });
  }
  function submitPayment(e: FormEvent) {
    e.preventDefault(); if (!paying) return;
    const value = Number(paymentAmount);
    if (value > paying.remaining) { notify('المبلغ أكبر من المتبقي'); return; }
    pay.mutate({ id: paying.id, data: { amount: value, notes: paymentNotes || null } }, {
      onSuccess: () => { invalidateDebts(); notify('تم تسجيل الدفعة وتحديث الرصيد'); setPaying(undefined); setPaymentAmount(''); setPaymentNotes(''); },
      onError: () => notify('تعذر تسجيل الدفعة'),
    });
  }
  const rows = debts.data ?? [];
  const receivable = rows.filter(d => d.direction === 'receivable').reduce((sum, d) => sum + d.remaining, 0);
  const payable = rows.filter(d => d.direction === 'payable').reduce((sum, d) => sum + d.remaining, 0);
  return <Shell pageTitle="الديون والمدفوعات"><PageFrame title="الديون والمدفوعات" subtitle="سجل ما للعملاء وما على المحل، وتابع السداد الجزئي حتى إغلاق الرصيد." action={canManage ? <button className="button green" onClick={() => setAdding(true)}><Plus />تسجيل دين</button> : undefined}>
    <div className="stats-grid"><Stat label="مستحق للمحل" value={money(receivable)} note="أرصدة العملاء المفتوحة" icon={ArrowDownToLine} /><Stat label="مستحق على المحل" value={money(payable)} note="أرصدة الموردين المفتوحة" icon={Truck} /></div>
    <div className="panel" style={{ marginTop: 16 }}><div className="panel-head"><div><div className="panel-title">سجل الديون</div><div className="panel-caption">الدفعات لا تغيّر الربح؛ وتُسجل هنا لمتابعة الأرصدة فقط.</div></div></div>
      <QueryState loading={debts.isLoading} error={debts.isError} retry={() => debts.refetch()} empty={!debts.isLoading && !debts.isError && !rows.length}>
        <div className="table-wrap"><table className="data-table"><thead><tr><th>الطرف</th><th>الاتجاه</th><th>تاريخ التسجيل</th><th>أصل الدين</th><th>المدفوع</th><th>المتبقي</th>{canManage && <th>إجراء</th>}</tr></thead><tbody>{rows.map(d => <tr key={d.id}><td className="product-cell">{d.partyName}<div className="subtle">{d.partyType === 'customer' ? 'عميل' : 'مورد'}{d.supplyId ? ' · مرتبط بتوريد' : ''}</div>{d.notes && <div className="subtle">{d.notes}</div>}</td><td><span className={`pill ${d.direction === 'receivable' ? 'warning' : ''}`}>{d.direction === 'receivable' ? 'للْمَحل' : 'على المحل'}</span></td><td>{date(d.createdAt)}</td><td>{money(d.amount)}</td><td>{money(d.paidAmount)}</td><td><b>{money(d.remaining)}</b></td>{canManage && <td>{d.remaining > 0 ? <button className="act" onClick={() => { setPaying(d); setPaymentAmount(String(d.remaining)); }}><ArrowDownToLine />تسجيل سداد</button> : <span className="pill">مكتمل</span>}</td>}</tr>)}</tbody></table></div>
      </QueryState>
    </div>
    {adding && <Modal title="تسجيل دين جديد" close={resetCreate}><form onSubmit={submitDebt}><div className="form-grid">
      <label className="form-field">نوع الدين<select value={direction} onChange={e => setDirection(e.target.value as typeof direction)}><option value="receivable">عميل عليه للمحل</option><option value="payable">المحل عليه لمورد</option></select></label>
      <label className="form-field">{direction === 'receivable' ? 'اسم العميل' : 'اسم المورد'}<input required value={partyName} onChange={e => setPartyName(e.target.value)} /></label>
      <label className="form-field">إجمالي الدين<input required type="number" min=".01" step=".01" value={principal} onChange={e => setPrincipal(e.target.value)} /></label>
      <label className="form-field">المدفوع عند التسجيل<input type="number" min="0" step=".01" value={initialPaid} onChange={e => setInitialPaid(e.target.value)} /></label>
      <label className="form-field span2">ملاحظات<input value={debtNotes} onChange={e => setDebtNotes(e.target.value)} /></label>
    </div><div className="form-actions"><button className="button green" disabled={create.isPending || Number(initialPaid) > Number(principal)}>حفظ الدين</button><button type="button" className="button ghost" onClick={resetCreate}>إلغاء</button></div></form></Modal>}
    {paying && <Modal title={`تسجيل سداد — ${paying.partyName}`} close={() => { if (!pay.isPending) setPaying(undefined); }}><form onSubmit={submitPayment}><div className="panel" style={{ padding: 12, marginBottom: 14 }}>المتبقي: <b>{money(paying.remaining)}</b></div><label className="form-field">مبلغ الدفعة<input required type="number" min=".01" max={paying.remaining} step=".01" value={paymentAmount} onChange={e => setPaymentAmount(e.target.value)} /></label><label className="form-field" style={{ marginTop: 12 }}>ملاحظات<input value={paymentNotes} onChange={e => setPaymentNotes(e.target.value)} /></label><div className="form-actions"><button className="button green" disabled={pay.isPending || Number(paymentAmount) > paying.remaining}>حفظ الدفعة</button><button type="button" className="button ghost" onClick={() => setPaying(undefined)}>إلغاء</button></div></form></Modal>}
    {toast}
  </PageFrame></Shell>;
}

function TeamPage() {
  const current = useGetCurrentUser(); const q = useListTeamMembers(); const change = useUpdateTeamRole(); const client = useQueryClient(); const { notify, toast } = useNotify(); const canManage = current.data?.role === 'owner';
  const updateMember = (member: AppUser, update: { role?: AppUser['role']; active?: boolean }) => {
    change.mutate({ data: { userId: member.id, role: update.role ?? member.role, ...(update.active === undefined ? {} : { active: update.active }) } }, {
      onSuccess: () => { client.invalidateQueries({ queryKey: getListTeamMembersQueryKey() }); client.invalidateQueries({ queryKey: getGetCurrentUserQueryKey() }); notify('تم تحديث بيانات العضو'); },
      onError: () => notify('تعذر تحديث بيانات العضو')
    });
  };
  return <Shell pageTitle="فريق العمل"><PageFrame title="فريق العمل" subtitle="إدارة صلاحيات الوصول إلى بيانات المتجر"><div className="panel"><div className="panel-head"><div><div className="panel-title">أعضاء الفريق</div><div className="panel-caption">الأدوار وحالة الحساب تحددان الوصول إلى المتجر</div></div><ShieldCheck size={18} color="#78927f" /></div><QueryState loading={q.isLoading} error={q.isError} retry={() => q.refetch()} empty={!q.isLoading && !q.isError && !q.data?.length}><div className="table-wrap"><table className="data-table"><thead><tr><th>الموظف</th><th>البريد الإلكتروني</th><th>الدور</th><th>حالة الحساب</th><th>تاريخ الانضمام</th></tr></thead><tbody>{q.data?.map((m: AppUser) => <tr key={m.id}><td className="product-cell">{m.displayName}</td><td dir="ltr" style={{ textAlign: 'right' }}>{m.email}</td><td>{canManage ? <select className="filter-select" value={m.role} disabled={change.isPending} aria-label={`دور ${m.displayName}`} onChange={e => updateMember(m, { role: e.target.value as AppUser['role'] })}><option value="owner">مالك</option><option value="manager">مدير</option><option value="cashier">أمين صندوق</option></select> : <span className="pill">{m.role === 'owner' ? 'مالك' : m.role === 'manager' ? 'مدير' : 'أمين صندوق'}</span>}</td><td>{canManage ? <button type="button" className={`pill ${m.active ? '' : 'warning'}`} disabled={change.isPending} onClick={() => updateMember(m, { active: !m.active })} aria-label={`${m.active ? 'تعطيل' : 'تفعيل'} حساب ${m.displayName}`} data-testid={`button-toggle-member-${m.id}`}>{m.pendingApproval ? 'بانتظار الموافقة · تفعيل' : m.active ? 'نشط · إيقاف' : 'معطّل · تفعيل'}</button> : <span className={`pill ${m.active ? '' : 'warning'}`}>{m.pendingApproval ? 'بانتظار الموافقة' : m.active ? 'نشط' : 'معطّل'}</span>}</td><td>{date(m.createdAt)}</td></tr>)}</tbody></table></div></QueryState></div>{!canManage && <p className="page-sub" style={{ marginTop: 14 }}>تغيير الأدوار وحالة الحساب متاح لمالك المتجر فقط.</p>}{toast}</PageFrame></Shell>;
}

function BackupPage() {
  const current = useGetCurrentUser(); const client = useQueryClient(); const exportQ = useExportBackup({ query: { enabled: false, queryKey: getExportBackupQueryKey() } }); const restore = useRestoreBackup(); const { notify, toast } = useNotify(); const inputRef = useRef<HTMLInputElement>(null); const canManage = current.data?.role === 'owner';
  async function exportData() {
    const result = await exportQ.refetch();
    if (result.data) { const blob = new Blob([JSON.stringify(result.data, null, 2)], { type: 'application/json' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `nasaem-backup-${new Date().toISOString().slice(0, 10)}.json`; a.click(); URL.revokeObjectURL(url); notify('تم تنزيل النسخة الاحتياطية'); }
    else notify('تعذر تصدير النسخة الاحتياطية');
  }
  function readFile(file?: File) { if (!file) return; const reader = new FileReader(); reader.onload = () => { try { const payload = JSON.parse(String(reader.result)); if (!payload || payload.version !== 1 || !Array.isArray(payload.products) || !Array.isArray(payload.sales) || !Array.isArray(payload.supplies)) throw new Error('invalid'); if (!confirm('سيتم استعادة البيانات من الملف المحدد. هل تريد المتابعة؟')) return; restore.mutate({ data: payload }, { onSuccess: () => { client.invalidateQueries({ queryKey: getListProductsQueryKey() }); client.invalidateQueries({ queryKey: getListSalesQueryKey() }); client.invalidateQueries({ queryKey: getListSuppliesQueryKey() }); client.invalidateQueries({ queryKey: getGetDashboardQueryKey() }); notify('اكتملت استعادة النسخة الاحتياطية'); }, onError: () => notify('فشلت استعادة النسخة الاحتياطية') }); } catch { notify('الملف غير صالح أو لا يتوافق مع النسخة الحالية'); } }; reader.readAsText(file); }
  return <Shell pageTitle="النسخ الاحتياطي"><PageFrame title="النسخ الاحتياطي" subtitle="حافظ على سجلات المنتجات والمبيعات والتوريدات"><div className="content-grid"><section className="panel"><div className="panel-head"><div><div className="panel-title">تصدير نسخة</div><div className="panel-caption">احفظ نسخة كاملة بصيغة JSON</div></div><ArrowDownToLine color="#357456" /></div><div className="state-box"><div className="state-icon"><Download /></div><strong>نسخة بيانات قابلة للاستعادة</strong><p>تشمل المنتجات والمبيعات والتوريدات المسجلة.</p>{canManage && <button className="button green" style={{ marginTop: 16 }} onClick={exportData} disabled={exportQ.isFetching}>{exportQ.isFetching ? 'جارٍ تجهيز الملف…' : 'تنزيل النسخة الاحتياطية'}</button>}</div></section>
      <section className="panel"><div className="panel-head"><div><div className="panel-title">استعادة نسخة</div><div className="panel-caption">استعادة البيانات من ملف نسايم محفوظ</div></div><Archive color="#b94339" /></div><div className="state-box"><div className="state-icon"><History /></div><strong>اختر ملف النسخة الاحتياطية</strong><p>استخدم ملف JSON صادرًا من نسايم للمنظفات.</p><input ref={inputRef} type="file" accept="application/json,.json" hidden onChange={e => readFile(e.target.files?.[0])} />{canManage && <button className="button" style={{ marginTop: 16 }} onClick={() => inputRef.current?.click()} disabled={restore.isPending}>{restore.isPending ? 'جارٍ الاستعادة…' : 'اختيار ملف للاستعادة'}</button>}</div></section></div>{!canManage && <div className="panel state-box" style={{ marginTop: 18 }}><strong>هذه الإجراءات متاحة لمالك المتجر فقط</strong><p>يمكنك التواصل مع المالك لإجراء تصدير أو استعادة.</p></div>}{toast}</PageFrame></Shell>;
}

function HomeRedirect() {
  return localMode ? <LocalHomeRedirect /> : <RemoteHomeRedirect />;
}
function RemoteHomeRedirect() {
  return <><Show when="signed-in"><Redirect to="/dashboard" /></Show><Show when="signed-out"><Landing /></Show></>;
}
function LocalHomeRedirect() {
  const profile = useGetCurrentUser();
  if (profile.isLoading) return <div className="landing min-h-[100dvh] flex items-center justify-center px-5"><div className="panel state-box"><div className="state-icon"><Activity /></div><strong>جارٍ التحقق من الحساب</strong></div></div>;
  if (profile.data?.active) return <Redirect to="/dashboard" />;
  return <Redirect to="/sign-in" />;
}
function RoutedErrorBoundary({ children }: { children: ReactNode }) { const [location] = useLocation(); return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>; }
function LocalAuthRoute() {
  const client = useQueryClient();
  const [, setLocation] = useLocation();
  return <LocalAuthScreen onAuthenticated={() => { client.clear(); setLocation('/dashboard'); }} />;
}
function Router() {
  return <RoutedErrorBoundary><Switch>
    <Route path="/" component={HomeRedirect} />
    <Route path="/sign-in/*?">{() => localMode ? <LocalAuthRoute /> : <SignInPage />}</Route>
    <Route path="/sign-up/*?">{() => localMode ? <LocalAuthRoute /> : <SignUpPage />}</Route>
    <Route path="/dashboard">{() => <Guard><DashboardPage /></Guard>}</Route>
    <Route path="/products">{() => <Guard><ProductsPage /></Guard>}</Route>
    <Route path="/sales">{() => <Guard><SalesPage /></Guard>}</Route>
    <Route path="/supplies">{() => <Guard><SuppliesPage /></Guard>}</Route>
    <Route path="/finance">{() => <Guard><FinancePage /></Guard>}</Route>
    <Route path="/debts">{() => <Guard><DebtsPage /></Guard>}</Route>
    <Route path="/team">{() => <Guard><TeamPage /></Guard>}</Route>
    <Route path="/backup">{() => <Guard><BackupPage /></Guard>}</Route>
    <Route><div className="page" dir="rtl"><div className="panel state-box"><div className="state-icon"><CircleAlert /></div><strong>الصفحة غير موجودة</strong><Link className="button" href="/dashboard" style={{ marginTop: 15 }}>العودة إلى المتجر</Link></div></div></Route>
  </Switch></RoutedErrorBoundary>;
}
function ClerkRoutes() {
  const [, setLocation] = useLocation();
  return <ClerkProvider publishableKey={clerkPubKey} proxyUrl={clerkProxyUrl} appearance={appearance} signInUrl={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`}
    localization={{ signIn: { start: { title: 'مرحبًا بعودتك', subtitle: 'سجّل الدخول لمتابعة متجرك' } }, signUp: { start: { title: 'أنشئ حسابك', subtitle: 'ابدأ إدارة متجرك مع نسايم' } } }}
    routerPush={to => setLocation(stripBase(to))} routerReplace={to => setLocation(stripBase(to), { replace: true })}>
    <QueryClientProvider client={queryClient}><TooltipProvider><ClerkAuthActions><CacheInvalidator /><Router /><Toaster /></ClerkAuthActions></TooltipProvider></QueryClientProvider>
  </ClerkProvider>;
}
function ClerkAuthActions({ children }: { children: ReactNode }) {
  const { signOut } = useClerk();
  return <AuthActionsContext.Provider value={{ signOut: async () => { await signOut({ redirectUrl: basePath || '/' }); } }}>{children}</AuthActionsContext.Provider>;
}
function LocalAuthActions({ children }: { children: ReactNode }) {
  const client = useQueryClient();
  const [, setLocation] = useLocation();
  const signOut = async () => {
    const response = await fetch('/api/auth/local/logout', { method: 'POST', credentials: 'include' });
    if (!response.ok) {
      window.alert('تعذر تسجيل الخروج. تحقق من اتصال الشبكة ثم أعد المحاولة.');
      return;
    }
    client.clear();
    setLocation('/sign-in');
  };
  return <AuthActionsContext.Provider value={{ signOut }}>{children}</AuthActionsContext.Provider>;
}
function LocalRoutes() {
  return <QueryClientProvider client={queryClient}><TooltipProvider><LocalAuthActions><Router /><Toaster /></LocalAuthActions></TooltipProvider></QueryClientProvider>;
}
function App() {
  if (localMode) return <WouterRouter base={basePath}><LocalRoutes /></WouterRouter>;
  if (!clerkPubKey) throw new Error('Missing VITE_CLERK_PUBLISHABLE_KEY in .env file');
  return <WouterRouter base={basePath}><ClerkRoutes /></WouterRouter>;
}
export default App;
