import { useGetYearlyFinance } from '@workspace/api-client-react';
import { formatMoney } from '@/lib/currency';

export function YearlyFinanceReport({ year, onMonth }: { year: number; onMonth: (month: string) => void }) {
  const query = useGetYearlyFinance({ year });
  if (query.isLoading) return <div className="panel state-box" role="status">جارٍ تحميل التقرير السنوي…</div>;
  if (query.isError) return <div className="panel state-box"><strong>تعذر تحميل التقرير السنوي</strong><button className="button" onClick={() => void query.refetch()}>إعادة المحاولة</button></div>;
  const report = query.data;
  if (!report) return null;
  const totals = [
    ['إجمالي مبيعات السنة', report.salesRevenue],
    ['تكلفة البضاعة المباعة', report.costOfGoodsSold],
    ['الربح قبل المصروفات', report.grossProfit],
    ['مصروفات السنة', report.expensesTotal],
    ['صافي الربح السنوي', report.netProfit],
  ] as const;
  return <section aria-label={`التقرير السنوي ${year}`} data-testid="yearly-finance-report">
    <div className="stats-grid">{totals.map(([label, value]) => <article className="panel stat-card" key={label}><div className="stat-label">{label}</div><div className="stat-value">{formatMoney(value)}</div></article>)}</div>
    <div className="panel" style={{ marginTop: 16 }}>
      <div className="panel-head"><div><div className="panel-title">تفصيل السنة شهرًا بشهر — {year}</div><div className="panel-caption">الربح محسوب تلقائيًا، والشهور بدون حركة تظهر بصفر. اضغط تفاصيل الشهر لعرض مصروفاته.</div></div></div>
      <div className="table-wrap"><table className="data-table cards-mobile"><thead><tr><th>الشهر</th><th>المبيعات</th><th>تكلفة المباع</th><th>المصروفات</th><th>صافي الربح</th><th>التفاصيل</th></tr></thead>
        <tbody>{report.months.map(month => <tr key={month.month}>
          <td data-label="الشهر" className="product-cell">{month.month}</td>
          <td data-label="المبيعات">{formatMoney(month.salesRevenue)}</td>
          <td data-label="تكلفة المباع">{formatMoney(month.costOfGoodsSold)}</td>
          <td data-label="المصروفات">{formatMoney(month.expensesTotal)}</td>
          <td data-label="صافي الربح"><b>{formatMoney(month.netProfit)}</b></td>
          <td className="actions-cell"><button className="act" onClick={() => onMonth(month.month)} aria-label={`تفاصيل شهر ${month.month}`}>تفاصيل الشهر</button></td>
        </tr>)}</tbody>
      </table></div>
    </div>
  </section>;
}
