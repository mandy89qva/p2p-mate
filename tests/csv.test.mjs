import test from 'node:test';
import assert from 'node:assert/strict';
import { csvCell, createHistoryCsv } from '../public/modules/csv.js';

test('CSV entrecomilla y duplica comillas correctamente', () => {
  assert.equal(csvCell('nota "de prueba"'), '"nota ""de prueba"""');
});

test('CSV neutraliza texto que podría ejecutarse como fórmula', () => {
  assert.equal(csvCell('=1+1'), "\"'=1+1\"");
  assert.equal(csvCell('  @SUM(A1:A2)'), "\"'  @SUM(A1:A2)\"");
  assert.equal(csvCell('-texto'), "\"'-texto\"");
});

test('CSV produce encabezados y filas sin alterar números', () => {
  const csv = createHistoryCsv([{ date: '2026-11-02', type: 'hypothetical', asset: 'QUSD', currency: 'BANK_CUP', profit: 12.5, note: 'prueba' }]);
  assert.match(csv, /^date,type,asset,currency,profit/);
  assert.match(csv, /"12\.5"/);
  assert.match(csv, /"prueba"/);
});

test('CSV rechaza entradas que no son listas', () => {
  assert.throws(() => createHistoryCsv({}), /lista/);
});
