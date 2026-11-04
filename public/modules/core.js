import {D,add,sub,mul,div,toNumber} from "./decimal.js";

const val=(v,name)=>D(v,name);
function calculateUnits(d) {
  const q=val(d.qty,"Cantidad"), bp=val(d.buyPrice,"Precio de compra"), sp=val(d.sellPrice,"Precio de venta");
  const bc=div(val(d.buyPct,"Comisión de compra"),D(100)), sc=div(val(d.sellPct,"Comisión de venta"),D(100));
  const bf=val(d.buyFixed,"Comisión fija de compra"), sf=val(d.sellFixed,"Comisión fija de venta"), ex=val(d.expenses,"Gastos");
  const zero=0n, one=D(1);
  if(q<=zero) throw new Error("La cantidad debe ser mayor que cero.");
  if(bp<zero||sp<zero||bf<zero||sf<zero||ex<zero) throw new Error("Precios, comisiones fijas y gastos no pueden ser negativos.");
  if(bc<zero||bc>=one||sc<zero||sc>=one) throw new Error("Las comisiones porcentuales deben ser mayores o iguales a 0 % y menores de 100 %.");
  const buyGross=mul(q,bp), buyFee=mul(buyGross,bc), cost=add(add(buyGross,buyFee),bf);
  const sellGross=mul(q,sp), sellFee=mul(sellGross,sc), net=sub(sub(sellGross,sellFee),sf);
  const totalCost=add(cost,ex), profit=sub(net,totalCost);
  const breakEven=div(add(totalCost,sf),mul(q,sub(one,sc)));
  const roi=totalCost===zero?null:mul(div(profit,totalCost),D(100));
  return {buyGross,buyFee,cost,sellGross,sellFee,net,totalCost,profit,breakEven,unitDiff:sub(sp,bp),roi};
}
export function calculateTrade(d) {
  const units=calculateUnits(d);
  return Object.fromEntries(Object.entries(units).map(([k,v])=>[k,v===null?null:toNumber(v)]));
}
export function targetPrice(d, desired) {
  const r=calculateUnits({...d,sellPrice:"0"});
  const goal=val(desired,"Beneficio deseado");
  if(goal<0n) throw new Error("El beneficio deseado no puede ser negativo.");
  const q=val(d.qty,"Cantidad"), sc=div(val(d.sellPct,"Comisión de venta"),D(100)), sf=val(d.sellFixed,"Comisión fija de venta");
  return toNumber(div(add(add(r.totalCost,sf),goal),mul(q,sub(D(1),sc))));
}
export function simulate({capital,rate,count,reinvest}) {
  const initial=val(capital,"Capital"), ratePct=div(val(rate,"Variación"),D(100)), cycles=Number(count), reinvestPct=div(val(reinvest,"Reinversión"),D(100));
  if(initial<0n||!Number.isInteger(cycles)||cycles<0||cycles>500||reinvestPct<0n||reinvestPct>D(1)||ratePct<=D(-1)||ratePct>D(10)) throw new Error("Revisa los valores del simulador.");
  let current=initial;
  for(let i=0;i<cycles;i++) current=add(current,mul(mul(current,ratePct),reinvestPct));
  return {final:toNumber(current),change:toNumber(sub(current,initial)),percent:initial===0n?0:toNumber(mul(div(sub(current,initial),initial),D(100)))};
}
export const money = (v,currency="") => `${new Intl.NumberFormat("es", {maximumFractionDigits:4}).format(v)}${currency?` ${currency}`:""}`;


// Herramientas auxiliares de inventario y conversión. Todas las tasas son manuales.
export function calculateAverageCost(purchases) {
  if (!Array.isArray(purchases) || purchases.length === 0) {
    throw new Error("Añade al menos una compra.");
  }
  let totalQty = 0n, totalCost = 0n;
  for (const [i, item] of purchases.entries()) {
    const qty = val(item.qty, `Cantidad de compra ${i + 1}`);
    const price = val(item.price, `Precio de compra ${i + 1}`);
    const pct = div(val(item.feePct ?? "0", "Comisión porcentual"), D(100));
    const fixed = val(item.feeFixed ?? "0", "Comisión fija");
    const expenses = val(item.expenses ?? "0", "Gastos");
    if (qty <= 0n || price < 0n || pct < 0n || pct >= D(1) || fixed < 0n || expenses < 0n) {
      throw new Error(`Revisa los valores de la compra ${i + 1}.`);
    }
    const gross = mul(qty, price);
    const cost = add(add(add(gross, mul(gross, pct)), fixed), expenses);
    totalQty = add(totalQty, qty);
    totalCost = add(totalCost, cost);
  }
  return {
    totalQty: toNumber(totalQty),
    totalCost: toNumber(totalCost),
    averagePrice: toNumber(div(totalCost, totalQty))
  };
}

export function calculatePartialSale({totalQty, averagePrice, sellQty, sellPrice, sellPct="0", sellFixed="0", expenses="0"}) {
  const qty = val(totalQty, "Cantidad disponible");
  const avg = val(averagePrice, "Coste promedio");
  const sold = val(sellQty, "Cantidad a vender");
  const price = val(sellPrice, "Precio de venta");
  const pct = div(val(sellPct, "Comisión de venta"), D(100));
  const fixed = val(sellFixed, "Comisión fija");
  const extra = val(expenses, "Gastos");
  if (qty <= 0n || avg < 0n || sold <= 0n || sold > qty || price < 0n ||
      pct < 0n || pct >= D(1) || fixed < 0n || extra < 0n) {
    throw new Error("Revisa las cantidades, precios, comisiones y gastos de la venta.");
  }
  const allocatedCost = mul(sold, avg);
  const gross = mul(sold, price);
  const fee = mul(gross, pct);
  const net = sub(sub(sub(gross, fee), fixed), extra);
  const realized = sub(net, allocatedCost);
  const remainingQty = sub(qty, sold);
  const remainingCost = mul(remainingQty, avg);
  return {
    allocatedCost: toNumber(allocatedCost),
    gross: toNumber(gross),
    fee: toNumber(fee),
    net: toNumber(net),
    realized: toNumber(realized),
    remainingQty: toNumber(remainingQty),
    remainingCost: toNumber(remainingCost),
    averagePrice: toNumber(avg)
  };
}

export function calculateCapital({capital, committed="0", reserve="0"}) {
  const total = val(capital, "Capital total");
  const used = val(committed, "Capital comprometido");
  const held = val(reserve, "Reserva");
  if (total < 0n || used < 0n || held < 0n || add(used, held) > total) {
    throw new Error("El capital comprometido y la reserva no pueden superar el capital total.");
  }
  const available = sub(sub(total, used), held);
  return {
    total: toNumber(total),
    committed: toNumber(used),
    reserve: toNumber(held),
    available: toNumber(available),
    committedPercent: total === 0n ? 0 : toNumber(mul(div(used, total), D(100))),
    reservePercent: total === 0n ? 0 : toNumber(mul(div(held, total), D(100))),
    availablePercent: total === 0n ? 0 : toNumber(mul(div(available, total), D(100)))
  };
}

// rate = unidades de moneda destino por cada unidad de moneda origen.
export function convertAmount({amount, rate, feePct="0"}) {
  const source = val(amount, "Cantidad");
  const exchangeRate = val(rate, "Tasa de conversión");
  const fee = div(val(feePct, "Comisión"), D(100));
  if (source < 0n || exchangeRate <= 0n || fee < 0n || fee >= D(1)) {
    throw new Error("La cantidad no puede ser negativa, la tasa debe ser positiva y la comisión debe estar entre 0 % y menos de 100 %.");
  }
  const gross = mul(source, exchangeRate);
  const feeAmount = mul(gross, fee);
  return {
    gross: toNumber(gross),
    fee: toNumber(feeAmount),
    net: toNumber(sub(gross, feeAmount)),
    rate: toNumber(exchangeRate)
  };
}
