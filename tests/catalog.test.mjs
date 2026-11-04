import test from "node:test";
import assert from "node:assert/strict";
import { OPTIONS, OPTION_CODES, isAllowedOption, normalizeOption } from "../public/modules/catalog.js";
import { normalizeAverages } from "../public/modules/qvapay.js";
import { addRecord, getHistory, restoreBackup, saveHistory } from "../public/modules/storage.js";

class MemoryStorage { constructor(){this.data=new Map()} getItem(k){return this.data.has(k)?this.data.get(k):null} setItem(k,v){this.data.set(k,String(v))} removeItem(k){this.data.delete(k)} }
globalThis.localStorage = new MemoryStorage();
delete globalThis.indexedDB;

test("el catálogo contiene exactamente ocho códigos",()=>{
  assert.deepEqual(OPTION_CODES,["QUSD","BANK_CUP","BANK_MLC","CLASICA","ETECSA","BANDECPREPAGO","TROPIPAY","ZELLE"]);
  assert.equal(OPTIONS.length,8);
});
test("acepta únicamente códigos admitidos",()=>{
  for(const code of OPTION_CODES) assert.equal(isAllowedOption(code),true);
  for(const code of ["USDT","BTC","USD","CUP","ETH","CUSTOM",""]) assert.equal(isAllowedOption(code),false);
});
test("normaliza minúsculas sin ampliar catálogo",()=>{
  assert.equal(normalizeOption("bank_cup"),"BANK_CUP");
  assert.throws(()=>normalizeOption("USDT"),/ocho opciones admitidas/);
});
test("tasas QvaPay descarta cualquier código fuera del catálogo",()=>{
  const rows=normalizeAverages({QUSD:{average:1.1},BANK_CUP:{average:250},USDT:{average:1},BTC:{average:60000},ZELLE:{average:1}});
  assert.deepEqual(rows.map(x=>x.coin),["BANK_CUP","QUSD","ZELLE"]);
});
test("el historial rechaza registros con opciones no admitidas",async()=>{
  await assert.rejects(()=>addRecord({asset:"USDT",currency:"BANK_CUP",profit:1}),/ocho opciones admitidas/);
  await assert.rejects(()=>addRecord({asset:"QUSD",currency:"USD",profit:1}),/ocho opciones admitidas/);
  assert.equal((await getHistory()).length,0);
});
test("el historial acepta solo combinaciones del catálogo",async()=>{
  await addRecord({asset:"QUSD",currency:"BANK_CUP",profit:1});
  const rows=await getHistory();
  assert.equal(rows.length,1);
  assert.equal(rows[0].asset,"QUSD");
  assert.equal(rows[0].currency,"BANK_CUP");
});
test("la restauración rechaza copias con opciones externas",async()=>{
  const backup={app:"P2P Mate",backupVersion:1,records:[{id:"x",asset:"BTC",currency:"BANK_CUP",profit:1}]};
  await assert.rejects(()=>restoreBackup(backup),/ocho opciones admitidas/);
});

test("guardar una lista de historial tampoco permite opciones externas",async()=>{
  await assert.rejects(()=>saveHistory([{id:"bad",asset:"ETH",currency:"ZELLE",profit:0}]),/ocho opciones admitidas/);
});
