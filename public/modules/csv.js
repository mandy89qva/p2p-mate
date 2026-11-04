// Exportación CSV segura para hojas de cálculo.
// Evita que texto controlado por el usuario se interprete como fórmula.
const FORMULA_PREFIX = /^[\u0000-\u0020]*[=+@\-]/;

export function csvCell(value) {
  let text = String(value ?? "");
  if (FORMULA_PREFIX.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

export function createHistoryCsv(records) {
  if (!Array.isArray(records)) throw new TypeError("El historial debe ser una lista.");
  const columns = ["date", "type", "asset", "currency", "profit", "roi", "cost", "qty", "buyPrice", "sellPrice", "note"];
  return [columns.join(","), ...records.map(record => columns.map(key => csvCell(record?.[key])).join(","))].join("\r\n");
}
