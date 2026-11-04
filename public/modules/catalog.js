export const OPTIONS = Object.freeze([
  Object.freeze({ code: "QUSD", label: "QUSD" }),
  Object.freeze({ code: "BANK_CUP", label: "Bank_CUP" }),
  Object.freeze({ code: "BANK_MLC", label: "Bank_MLC" }),
  Object.freeze({ code: "CLASICA", label: "Clásica" }),
  Object.freeze({ code: "ETECSA", label: "ETECSA" }),
  Object.freeze({ code: "BANDECPREPAGO", label: "BandecPrepago" }),
  Object.freeze({ code: "TROPIPAY", label: "TropiPay" }),
  Object.freeze({ code: "ZELLE", label: "Zelle" })
]);
export const OPTION_CODES = Object.freeze(OPTIONS.map(option => option.code));
export function isAllowedOption(value) {
  return typeof value === "string" && OPTION_CODES.includes(value);
}
export function normalizeOption(value, field = "Opción") {
  const code = String(value ?? "").trim().toUpperCase();
  if (!isAllowedOption(code)) {
    throw new Error(`${field}: selecciona una de las ocho opciones admitidas.`);
  }
  return code;
}
