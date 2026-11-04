import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeAverages,fetchP2PAverages} from '../public/modules/qvapay.js';

test('normaliza tasas públicas y conserva metadatos de muestra',()=>{
  const rows=normalizeAverages({BANK_CUP:{name:'Transferencia CUP',average:250.5,average_buy:248,count:45,window_hours:24,updated_at:'2026-10-31T10:00:00Z'},EMPTY:{average:0}});
  assert.equal(rows.length,1);
  assert.equal(rows[0].coin,'BANK_CUP');
  assert.equal(rows[0].average,250.5);
  assert.equal(rows[0].averageBuy,248);
  assert.equal(rows[0].count,45);
  assert.equal(rows[0].windowHours,24);
});

test('respuesta vacía produce una lista vacía',()=>{
  assert.deepEqual(normalizeAverages({}),[]);
  assert.deepEqual(normalizeAverages(null),[]);
});

test('consulta usa endpoint público y acepta JSON',async()=>{
  let requested='';
  const rows=await fetchP2PAverages({fetchImpl:async(url,options)=>{
    requested=url;
    assert.equal(options.method,'GET');
    return {ok:true,json:async()=>({BANK_MLC:{average:1.2,count:3,window_hours:72}})};
  }});
  assert.equal(requested,'https://api.qvapay.com/p2p/averages');
  assert.equal(rows[0].coin,'BANK_MLC');
});

test('consulta comunica errores HTTP',async()=>{
  await assert.rejects(()=>fetchP2PAverages({fetchImpl:async()=>({ok:false,status:503})}),/HTTP 503/);
});
