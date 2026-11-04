// Aritmética decimal fija con BigInt. Precisión interna: 8 decimales.
// Los valores monetarios se redondean a 8 decimales (half-up).
export const SCALE = 100000000n;
const POW10 = [1n,10n,100n,1000n,10000n,100000n,1000000n,10000000n,100000000n];

export function D(value, label="Valor") {
  if (typeof value === "bigint") return value;
  const s = String(value ?? "").trim();
  if (!s || !/^[+-]?(?:\d+\.?\d*|\.\d+)$/.test(s)) {
    throw new Error(`${label}: introduce un número decimal válido.`);
  }
  const neg = s[0] === "-";
  const unsigned = s.replace(/^[+-]/, "");
  const [wholeRaw="0", fracRaw=""] = unsigned.split(".");
  const whole = BigInt(wholeRaw || "0");
  const frac = fracRaw.slice(0,8).padEnd(8,"0");
  let units = whole*SCALE + BigInt(frac || "0");
  if (fracRaw.length > 8 && Number(fracRaw[8]) >= 5) units += 1n;
  return neg ? -units : units;
}
export function add(a,b){return a+b}
export function sub(a,b){return a-b}
export function mul(a,b){
  const product=a*b, abs=product<0n?-product:product;
  const rounded=(abs+SCALE/2n)/SCALE;
  return product<0n?-rounded:rounded;
}
export function div(a,b){
  if(b===0n) throw new Error("No se puede dividir entre cero.");
  const numerator=a*SCALE, negative=(numerator<0n)!==(b<0n);
  const an=numerator<0n?-numerator:numerator, bn=b<0n?-b:b;
  const rounded=(an+bn/2n)/bn;
  return negative?-rounded:rounded;
}
export function toNumber(a){return Number(a)/Number(SCALE)}
export function formatDecimal(a, maxDigits=8){
  const neg=a<0n, abs=neg?-a:a;
  const whole=abs/SCALE, frac=(abs%SCALE).toString().padStart(8,"0").slice(0,maxDigits).replace(/0+$/,"");
  return `${neg?"-":""}${whole}${frac?`.${frac}`:""}`;
}
