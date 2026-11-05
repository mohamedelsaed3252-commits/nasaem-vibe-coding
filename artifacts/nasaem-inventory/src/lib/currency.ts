const egyptianAmount = new Intl.NumberFormat('ar-EG-u-nu-latn', {
  maximumFractionDigits: 2,
});

// Display only: saved amounts and accounting calculations are unchanged.
export function formatMoney(value: number): string {
  return `${egyptianAmount.format(value || 0)} جنيه`;
}
