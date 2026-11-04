import test, { beforeEach } from "node:test";
import assert from "node:assert/strict";
import { initStorage, getHistory, addRecord, updateRecord, deleteRecord, createBackup, restoreBackup, saveHistory } from "../public/modules/storage.js";

class MemoryStorage {
  constructor(){ this.data = new Map(); }
  getItem(key){ return this.data.has(key) ? this.data.get(key) : null; }
  setItem(key,value){ this.data.set(key,String(value)); }
  removeItem(key){ this.data.delete(key); }
}

globalThis.localStorage = new MemoryStorage();
delete globalThis.indexedDB;

beforeEach(async()=>{
  localStorage = new MemoryStorage();
  await saveHistory([]);
});

test("guarda y recupera registros hipotéticos y reales declarados", async()=>{
  await initStorage();
  await addRecord({type:"hypothetical",asset:"QUSD",currency:"BANK_CUP",profit:10,inputs:{qty:"1"}});
  await addRecord({type:"real",asset:"ZELLE",currency:"BANK_MLC",profit:-2,inputs:{qty:"0.1"}});
  const rows=await getHistory();
  assert.equal(rows.length,2);
  assert.equal(rows[0].type,"real");
  assert.equal(rows[0].asset,"ZELLE");
  assert.equal(rows[1].type,"hypothetical");
});

test("editar conserva el identificador y la fecha original", async()=>{
  const [created]=await addRecord({type:"hypothetical",asset:"ETECSA",currency:"BANK_MLC",profit:5,inputs:{qty:"1"}});
  const original=(await getHistory())[0];
  await updateRecord(original.id,{type:"real",profit:8,inputs:{qty:"2"}});
  const updated=(await getHistory())[0];
  assert.equal(updated.id,original.id);
  assert.equal(updated.date,original.date);
  assert.equal(updated.type,"real");
  assert.equal(updated.profit,8);
});

test("elimina un registro concreto", async()=>{
  await addRecord({type:"real",asset:"ZELLE",currency:"BANK_MLC",profit:1});
  const [second]=await addRecord({type:"hypothetical",asset:"ETECSA",currency:"BANK_MLC",profit:2});
  await deleteRecord(second.id);
  const rows=await getHistory();
  assert.equal(rows.length,1);
  assert.equal(rows[0].asset,"ZELLE");
});

test("crea y restaura una copia JSON válida", async()=>{
  await addRecord({type:"real",asset:"ZELLE",currency:"BANK_MLC",profit:25,inputs:{qty:"1"}});
  const backup=await createBackup();
  await saveHistory([]);
  await restoreBackup(backup);
  assert.equal((await getHistory()).length,1);
  assert.equal((await getHistory())[0].profit,25);
});

test("rechaza copias inválidas sin borrar los datos actuales", async()=>{
  await addRecord({type:"real",asset:"ZELLE",currency:"BANK_MLC",profit:25});
  await assert.rejects(()=>restoreBackup({app:"otra app",backupVersion:1,records:[]}));
  assert.equal((await getHistory()).length,1);
});

test("la restauración rechaza fechas y tipos de registro inválidos", async()=>{
  const base={id:"bad-1",type:"hypothetical",asset:"QUSD",currency:"BANK_CUP",profit:1,date:"not-a-date"};
  await assert.rejects(()=>restoreBackup({app:"P2P Mate",backupVersion:1,records:[base]}),/fecha/);
  await assert.rejects(()=>restoreBackup({app:"P2P Mate",backupVersion:1,records:[{...base,date:"2026-11-02T00:00:00.000Z",type:"unknown"}]}),/tipo/);
});

test("la restauración rechaza entradas anidadas con campos o valores inválidos", async()=>{
  const base={id:"bad-2",type:"hypothetical",asset:"QUSD",currency:"BANK_CUP",profit:1,inputs:{qty:"1",unexpected:{nested:true}}};
  await restoreBackup({app:"P2P Mate",backupVersion:1,records:[base]});
  const [row]=await getHistory();
  assert.equal(row.inputs.unexpected,undefined);
  await assert.rejects(()=>restoreBackup({app:"P2P Mate",backupVersion:1,records:[{...base,inputs:{qty:{bad:true}}}]}),/campo qty/);
});
