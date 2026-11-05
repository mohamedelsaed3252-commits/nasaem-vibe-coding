export const roleLabels: Record<string, string> = {
  owner: 'مالك المتجر',
  manager: 'مدير تشغيل',
  warehouse: 'مسؤول مخازن',
  purchasing: 'مسؤول مشتريات',
  cashier: 'أمين صندوق',
};

export function roleName(role?: string) {
  return role ? roleLabels[role] ?? 'صلاحية غير معروفة' : 'جارٍ التحقق';
}

export function canOperate(role?: string) {
  return ['owner', 'manager', 'warehouse', 'purchasing'].includes(role ?? '');
}
