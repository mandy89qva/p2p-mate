import {calculateTrade,targetPrice,simulate,money,calculateAverageCost,calculatePartialSale,calculateCapital,convertAmount} from "./modules/core.js";
import {initStorage,getHistory,saveHistory,addRecord,updateRecord,deleteRecord,createBackup,restoreBackup} from "./modules/storage.js";
import {initializeQvaPay,fetchP2PAverages} from "./modules/qvapay.js";
import {createHistoryCsv} from "./modules/csv.js";
const $=id=>document.getElementById(id);
let qvapayIntegration=null;
const fields=["asset","currency","qty","buyPrice","sellPrice","buyPct","sellPct","buyFixed","sellFixed","expenses"];
let last=null;
let editingId=null;
// Valores iniciales pertenecientes al catálogo cerrado.
$("asset").value="QUSD"; $("currency").value="BANK_CUP";
$("invAsset").value="QUSD"; $("invCurrency").value="BANK_CUP";
$("capCurrency").value="BANK_CUP"; $("convFrom").value="QUSD"; $("convTo").value="BANK_CUP";
function data(){return Object.fromEntries(fields.map(k=>[k,$(k).value]))}
function fmt(v){return money(v,$("currency").value.trim().toUpperCase())}
function calculate(){
  try{
    $("error").textContent="";
    const d=data(), r=calculateTrade(d); last={d,r};
    $("profit").textContent=fmt(r.profit); $("profit").className="profit "+(r.profit>=0?"positive":"negative");
    $("status").textContent=r.profit>=0?"Resultado positivo en este escenario":"Resultado negativo en este escenario";
    $("cost").textContent=fmt(r.totalCost); $("gross").textContent=fmt(r.sellGross); $("net").textContent=fmt(r.net);
    $("roi").textContent=r.roi===null?"No disponible":`${r.roi.toFixed(3)} %`;
    $("breakeven").textContent=money(r.breakEven); $("unitDiff").textContent=money(r.unitDiff);
    $("targetPrice").textContent=money(targetPrice(d,$("desired").value),$("currency").value.trim().toUpperCase());
    return true;
  }catch(e){$("error").textContent=e.message;return false}
}
$("calcForm").addEventListener("submit",e=>{e.preventDefault();calculate()});
fields.concat(["desired"]).forEach(k=>{ $(k).addEventListener("input",calculate); $(k).addEventListener("change",calculate); });
$("saveBtn").addEventListener("click",async()=>{
  if(!calculate()||!last)return;
  const {d,r}=last;
  const record={type:$("recordType").value, note:$("recordNote").value.trim(), asset:d.asset.toUpperCase(),currency:d.currency.toUpperCase(),profit:r.profit,roi:r.roi,cost:r.totalCost,qty:Number(d.qty),buyPrice:Number(d.buyPrice),sellPrice:Number(d.sellPrice),inputs:d};
  try {
    if(editingId){await updateRecord(editingId,record);editingId=null;$("saveBtn").textContent="Guardar escenario";}
    else await addRecord(record);
    await renderHistory();await renderStats();$("error").textContent="Registro guardado en este dispositivo.";
  } catch(e){$("error").textContent=e.message;}
});
document.querySelectorAll(".tab").forEach(b=>b.addEventListener("click",()=>{document.querySelectorAll(".tab,.view").forEach(x=>x.classList.remove("active"));b.classList.add("active");$(b.dataset.view).classList.add("active");if(b.dataset.view==="history")renderHistory();if(b.dataset.view==="stats")renderStats();if(b.dataset.view==="rates"&&!ratesLoaded)loadRates()}));
$("themeBtn").onclick=()=>{document.documentElement.classList.toggle("light");localStorage.setItem("p2pmate.theme",document.documentElement.classList.contains("light")?"light":"dark")};
if(localStorage.getItem("p2pmate.theme")==="light")document.documentElement.classList.add("light");
function esc(s){return String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
async function renderHistory(){
  const all=await getHistory(), query=$("historySearch").value.trim().toLowerCase(), type=$("historyType").value;
  const rows=all.filter(x=>(type==="all"||x.type===type)&&(!query||`${x.asset} ${x.currency} ${x.note||""}`.toLowerCase().includes(query)));
  $("historyRows").innerHTML=rows.length?rows.map(x=>`<tr><td>${new Date(x.date).toLocaleString()}</td><td><span class="type-pill ${x.type==="real"?"real":"hypothetical"}">${x.type==="real"?"Real declarado":"Hipotético"}</span></td><td>${esc(x.asset)}</td><td>${esc(x.currency)}</td><td class="${Number(x.profit)>=0?"positive":"negative"}">${money(x.profit,x.currency)}</td><td>${x.roi===null||x.roi===undefined?"—":Number(x.roi).toFixed(2)+" %"}</td><td><button class="small-btn edit-btn" data-edit="${esc(x.id)}">Editar</button><button class="small-btn" data-del="${esc(x.id)}">Eliminar</button></td></tr>`).join(""):`<tr><td colspan="7" class="empty">${all.length?"No hay registros que coincidan con esos filtros.":"Todavía no hay registros."}</td></tr>`;
}
$("historyRows").addEventListener("click",async e=>{
  const id=e.target.dataset.del||e.target.dataset.edit;if(!id)return;
  const rows=await getHistory();
  if(e.target.dataset.edit){
    const row=rows.find(x=>x.id===id);if(!row?.inputs)return;
    fields.forEach(k=>$(k).value=row.inputs[k]??"");
    $("recordType").value=row.type||"hypothetical";$("recordNote").value=row.note||"";
    editingId=id;$("saveBtn").textContent="Actualizar registro";document.querySelector('[data-view="calculator"]').click();calculate();return;
  }
  if(confirm("¿Eliminar este registro del dispositivo?")){await deleteRecord(id);await renderHistory();await renderStats();}
});
$("historySearch").addEventListener("input",renderHistory);
$("historyType").addEventListener("change",renderHistory);
$("clearBtn").onclick=async()=>{if(confirm("¿Borrar todo el historial guardado en este dispositivo? Esta acción no se puede deshacer.")){await saveHistory([]);await renderHistory();await renderStats();}};
function downloadBlob(blob,name){const url=URL.createObjectURL(blob);const link=document.createElement("a");link.href=url;link.download=name;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
$("exportBtn").onclick=async()=>{try{const a=await getHistory();if(!a.length)return alert("No hay registros para exportar.");const csv=createHistoryCsv(a);downloadBlob(new Blob(["\ufeff"+csv],{type:"text/csv;charset=utf-8"}),"p2p-mate-historial.csv")}catch(e){alert(`No se pudo exportar el historial: ${e.message}`)}};
$("backupBtn").onclick=async()=>{try{const backup=await createBackup();downloadBlob(new Blob([JSON.stringify(backup,null,2)],{type:"application/json"}),`p2p-mate-copia-${new Date().toISOString().slice(0,10)}.json`)}catch(e){alert(e.message)}};
$("importFile").addEventListener("change",async e=>{const file=e.target.files?.[0];if(!file)return;try{const text=await file.text(),data=JSON.parse(text);if(!confirm("Restaurar esta copia reemplazará el historial actual. ¿Deseas continuar?"))return;await restoreBackup(data);await renderHistory();await renderStats();alert("Copia restaurada correctamente.")}catch(err){alert(`No se pudo restaurar la copia: ${err.message}`)}finally{e.target.value=""}});
async function renderStats(){const a=await getHistory(),groups={};a.forEach(x=>{groups[x.currency]??=[];groups[x.currency].push(x)});$("statsContent").innerHTML=Object.keys(groups).length?Object.entries(groups).map(([cur,items])=>{const realItems=items.filter(x=>x.type==="real"),hypItems=items.filter(x=>x.type!=="real"),sum=list=>list.reduce((s,x)=>s+Number(x.profit||0),0),total=sum(items),realTotal=sum(realItems),hypTotal=sum(hypItems),wins=items.filter(x=>x.profit>0).length,loss=items.filter(x=>x.profit<0).length,invest=items.reduce((s,x)=>s+Number(x.cost||0),0);return `<div class="stat-card"><span>Moneda: ${esc(cur)}</span><b class="${total>=0?"positive":"negative"}">${money(total,cur)}</b><span>Resultado combinado · ${items.length} registros</span><p>Reales declarados: <strong class="${realTotal>=0?"positive":"negative"}">${money(realTotal,cur)}</strong> (${realItems.length})</p><p>Hipotéticos: <strong class="${hypTotal>=0?"positive":"negative"}">${money(hypTotal,cur)}</strong> (${hypItems.length})</p><p>${wins} positivos · ${loss} negativos</p><p>Coste registrado: ${money(invest,cur)}</p></div>`}).join(""):`<div class="panel empty">Guarda registros para consultar estadísticas por moneda.</div>`}
const compareNames=["Alternativa A","Alternativa B","Alternativa C","Alternativa D"];
$("compareInputs").innerHTML=compareNames.map((name,i)=>`<div class="compare-card"><h4>${name}</h4><label>Compra <input type="number" min="0" step="any" id="cb${i}" value="${300+i*2}"></label><label>Venta <input type="number" min="0" step="any" id="cs${i}" value="315"></label><label>Comisión compra % <input type="number" min="0" max="99.99" step="any" id="cpb${i}" value="0"></label><label>Comisión venta % <input type="number" min="0" max="99.99" step="any" id="cps${i}" value="0"></label></div>`).join("");
$("compareBtn").onclick=()=>{try{const base=data();const results=compareNames.map((name,i)=>{const r=calculateTrade({...base,buyPrice:$(`cb${i}`).value,sellPrice:$(`cs${i}`).value,buyPct:$(`cpb${i}`).value,sellPct:$(`cps${i}`).value});return {name,r}});const best=[...results].sort((a,b)=>b.r.profit-a.r.profit)[0];$("compareResults").innerHTML=results.map(x=>`<div class="compare-item"><span class="muted">${x.name}${x===best?" · Mejor resultado":""}</span><strong class="${x.r.profit>=0?"positive":"negative"}">${fmt(x.r.profit)}</strong><span class="muted">ROI: ${x.r.roi?.toFixed(2)??"—"} %</span><br><span class="muted">Equilibrio: ${money(x.r.breakEven)}</span></div>`).join("")}catch(e){$("compareResults").textContent=e.message}};
$("simBtn").onclick=()=>{try{const r=simulate({capital:$("simCapital").value,rate:$("simRate").value,count:$("simCount").value,reinvest:$("simReinvest").value});$("simResult").innerHTML=`Capital final hipotético<strong>${money(r.final)}</strong>Variación: ${money(r.change)} (${r.percent.toFixed(2)} %)`}catch(e){$("simResult").textContent=e.message}};

// FASE 4: inventario, capital disponible y conversión con tasas manuales.
let averageSnapshot=null;
let purchaseIndex=0;
function addPurchaseRow(values={qty:"",price:"",feePct:"0",feeFixed:"0",expenses:"0"}){
  const i=purchaseIndex++;
  const row=document.createElement("div"); row.className="purchase-row"; row.dataset.purchase="1";
  row.innerHTML=`<div class="purchase-row-head"><strong>Compra ${i+1}</strong><button type="button" class="small-btn remove-purchase">Quitar</button></div><label>Cantidad <input class="p-qty" type="number" min="0" step="any" value="${esc(values.qty)}"></label><label>Precio unitario <input class="p-price" type="number" min="0" step="any" value="${esc(values.price)}"></label><label>Comisión (%) <input class="p-pct" type="number" min="0" max="99.999999" step="any" value="${esc(values.feePct)}"></label><label>Comisión fija <input class="p-fixed" type="number" min="0" step="any" value="${esc(values.feeFixed)}"></label><label>Gastos <input class="p-expenses" type="number" min="0" step="any" value="${esc(values.expenses)}"></label>`;
  $("purchaseRows").append(row);
}
const inventoryKey="p2pmate.inventory.v1";
function readPurchaseRows(){return [...$("purchaseRows").querySelectorAll(".purchase-row")].map(row=>({qty:row.querySelector(".p-qty").value,price:row.querySelector(".p-price").value,feePct:row.querySelector(".p-pct").value,feeFixed:row.querySelector(".p-fixed").value,expenses:row.querySelector(".p-expenses").value}));}
function persistInventory(){try{localStorage.setItem(inventoryKey,JSON.stringify({asset:$("invAsset").value,currency:$("invCurrency").value,purchases:readPurchaseRows()}));}catch{ /* El cálculo sigue disponible aunque el navegador bloquee el almacenamiento. */ }}
function loadInventory(){try{const saved=JSON.parse(localStorage.getItem(inventoryKey)||"null");if(!saved||!Array.isArray(saved.purchases)||!saved.purchases.length)return false;$("invAsset").value=[...$("invAsset").options].some(o=>o.value===saved.asset)?saved.asset:"QUSD";$("invCurrency").value=[...$("invCurrency").options].some(o=>o.value===saved.currency)?saved.currency:"BANK_CUP";$("purchaseRows").innerHTML="";saved.purchases.forEach(item=>addPurchaseRow(item));return true;}catch{return false;}}
addPurchaseRow({qty:"10",price:"300"});
if(!loadInventory())persistInventory();
$("addPurchaseBtn").onclick=()=>{addPurchaseRow();persistInventory();};
$("purchaseRows").addEventListener("input",persistInventory);
$("invAsset").addEventListener("change",persistInventory);$("invCurrency").addEventListener("change",persistInventory);
$("purchaseRows").addEventListener("click",e=>{if(e.target.classList.contains("remove-purchase")){const rows=$("purchaseRows").querySelectorAll(".purchase-row");if(rows.length<=1){$("avgResult").textContent="Debe quedar al menos una compra.";return;}e.target.closest(".purchase-row").remove();persistInventory();}});
$("avgBtn").onclick=()=>{try{
  const rows=[...$("purchaseRows").querySelectorAll(".purchase-row")];
  const purchases=rows.map(row=>({qty:row.querySelector(".p-qty").value,price:row.querySelector(".p-price").value,feePct:row.querySelector(".p-pct").value,feeFixed:row.querySelector(".p-fixed").value,expenses:row.querySelector(".p-expenses").value}));
  const result=calculateAverageCost(purchases); averageSnapshot={...result,asset:$("invAsset").value.trim().toUpperCase(),currency:$("invCurrency").value.trim().toUpperCase()};
  $("avgResult").innerHTML=`<strong>${money(result.totalQty)} ${esc(averageSnapshot.asset)}</strong><span>Cantidad acumulada</span><strong>${money(result.totalCost,averageSnapshot.currency)}</strong><span>Coste total de adquisición</span><strong>${money(result.averagePrice,averageSnapshot.currency)}</strong><span>Coste promedio por unidad</span>`;
}catch(e){averageSnapshot=null;$("avgResult").textContent=e.message;}};
$("partialBtn").onclick=()=>{try{if(!averageSnapshot)throw new Error("Calcula primero el coste promedio del inventario.");const r=calculatePartialSale({totalQty:averageSnapshot.totalQty,averagePrice:averageSnapshot.averagePrice,sellQty:$("partialQty").value,sellPrice:$("partialPrice").value,sellPct:$("partialPct").value,sellFixed:$("partialFixed").value,expenses:$("partialExpenses").value});const cur=averageSnapshot.currency;$("partialResult").innerHTML=`<strong class="${r.realized>=0?"positive":"negative"}">${money(r.realized,cur)}</strong><span>Resultado de esta venta parcial (estimado)</span><span>Coste asignado: ${money(r.allocatedCost,cur)} · Ingreso neto: ${money(r.net,cur)}</span><span>Inventario restante: ${money(r.remainingQty)} ${esc(averageSnapshot.asset)} · Coste restante: ${money(r.remainingCost,cur)}</span>`;}catch(e){$("partialResult").textContent=e.message;}};
$("capitalBtn").onclick=()=>{try{const r=calculateCapital({capital:$("capTotal").value,committed:$("capCommitted").value,reserve:$("capReserve").value});const cur=$("capCurrency").value;$("capitalResult").innerHTML=`<strong>${money(r.available,cur)}</strong><span>Capital disponible (${r.availablePercent.toFixed(2)} %)</span><span>Comprometido: ${money(r.committed,cur)} (${r.committedPercent.toFixed(2)} %)</span><span>Reserva: ${money(r.reserve,cur)} (${r.reservePercent.toFixed(2)} %)</span>`;}catch(e){$("capitalResult").textContent=e.message;}};
$("convertBtn").onclick=()=>{try{const r=convertAmount({amount:$("convAmount").value,rate:$("convRate").value,feePct:$("convFee").value});const from=$("convFrom").value,to=$("convTo").value;$("convertResult").innerHTML=`<strong>${money(r.net,to)}</strong><span>Resultado neto estimado</span><span>Bruto: ${money(r.gross,to)} · Comisión: ${money(r.fee,to)}</span><span>Tasa utilizada: 1 ${esc(from)} = ${money(r.rate,to)}</span>`;}catch(e){$("convertResult").textContent=e.message;}};

let ratesLoaded=false;
function formatRate(value){return new Intl.NumberFormat("es",{maximumFractionDigits:8}).format(value);}
async function loadRates(){
  const button=$("refreshRatesBtn"), status=$("ratesStatus"), updated=$("ratesUpdated"), rows=$("ratesRows");
  if(!button||!status||!rows)return;
  button.disabled=true;button.textContent="Consultando…";status.textContent="Consultando la API pública de QvaPay…";
  try{
    const data=await fetchP2PAverages();
    if(!data.length){rows.innerHTML='<tr><td colspan="6" class="muted">La API no devolvió promedios disponibles. Puedes continuar con tasas manuales.</td></tr>';status.textContent="Consulta completada · Sin muestras disponibles";updated.textContent="";}
    else{
      rows.innerHTML=data.map(item=>`<tr><td>${esc(item.coin)}<br><span class="muted">${esc(item.name)}</span></td><td>${formatRate(item.average)}</td><td>${formatRate(item.averageBuy)}</td><td>${formatRate(item.averageSell)}</td><td>${item.count}</td><td>${item.windowHours?item.windowHours+" h":"—"}</td></tr>`).join("");
      const dates=data.map(x=>x.updatedAt).filter(Boolean).sort();
      updated.textContent=dates.length?`Última actualización informada: ${new Date(dates[dates.length-1]).toLocaleString()}`:"La API no informó fecha de actualización";
      status.textContent=`${data.length} opciones admitidas recibidas · Promedios de operaciones completadas`;
    }
    ratesLoaded=true;
  }catch(error){
    status.textContent="No se pudieron cargar las tasas.";
    updated.textContent="Comprueba tu conexión o inténtalo más tarde.";
    rows.innerHTML=`<tr><td colspan="6" class="muted">${esc(error.message)} La calculadora y el conversor manual siguen disponibles.</td></tr>`;
  }finally{button.disabled=false;button.textContent="Actualizar tasas";}
}
$("refreshRatesBtn")?.addEventListener("click",loadRates);

async function start(){
  qvapayIntegration=await initializeQvaPay({onStatus:state=>{const chip=document.querySelector(".hero-chip");if(chip)chip.textContent=state.message;}});
  const status=await initStorage();
  $("storageStatus").textContent=status.mode==="IndexedDB"?"Almacenamiento: IndexedDB · datos guardados localmente en este navegador.":"Almacenamiento alternativo: localStorage · exporta copias periódicas.";
  calculate();await renderHistory();await renderStats();
}
start().catch(e=>{$("storageStatus").textContent=`No se pudo iniciar el almacenamiento: ${e.message}`;});
