import assert from 'node:assert/strict';
// Runtime import keeps the scripts package from compiling another package's sources.
const currencyModule = '../../artifacts/nasaem-inventory/src/lib/currency.ts';
const { formatMoney } = await import(currencyModule);

assert.equal(formatMoney(13), '13 جنيه');
assert.equal(formatMoney(17), '17 جنيه');
assert.equal(formatMoney(0), '0 جنيه');
assert.equal(formatMoney(13.5), '13.5 جنيه');
assert.equal(formatMoney(1250.75), '1,250.75 جنيه');
// Intl includes a direction mark before a negative amount in Arabic locales.
assert.equal(formatMoney(-25).replace(/\u200e/g, ''), '-25 جنيه');
assert.equal(formatMoney(12.345), '12.35 جنيه');
const permissionsModule = '../../artifacts/nasaem-inventory/src/lib/permissions.ts';
const { canOperate, roleName } = await import(permissionsModule);
for (const role of ['owner', 'manager', 'warehouse', 'purchasing']) assert.equal(canOperate(role), true);
assert.equal(canOperate('cashier'), false);
assert.equal(canOperate(undefined), false);
assert.equal(roleName('warehouse'), 'مسؤول مخازن');
assert.equal(roleName('purchasing'), 'مسؤول مشتريات');
console.log('Egyptian pound display: all checks passed; amounts unchanged.');
