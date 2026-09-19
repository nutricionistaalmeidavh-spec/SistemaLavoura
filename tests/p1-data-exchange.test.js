import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createStandaloneHost} from '../runtime/host.mjs';
import {previewCropImport,applyCropImport,exportCropRows} from '../src/data-exchange.js';

const password='Qa-P1-Exchange-2026!';
async function withHost(work){const root=await mkdtemp(join(tmpdir(),'agro-lavoura-exchange-'));const host=await createStandaloneHost({dataDir:root});try{return await work(host);}finally{await host.close().catch(()=>{});await rm(root,{recursive:true,force:true}).catch(()=>{});}}
async function admin(host){await host.backend.bootstrap({username:'exchange-admin',password});const logged=await host.backend.login({username:'exchange-admin',password});return{sessionId:logged.session.id,token:logged.token};}

test('import preview rejects unsupported target and invalid or duplicate rows',()=>{
  assert.throws(()=>previewCropImport({target:'seasons',rows:[],mapping:{}}),/Unsupported import target/);
  const invalid=previewCropImport({target:'fields',rows:[{codigo:'T1'},{codigo:'T1',nome:'Duplicado',fazenda:'F1',area:10}],mapping:{id:'codigo',code:'codigo',name:'nome',farmUnitId:'fazenda',areaHa:row=>Number(row.area)}});
  assert.equal(invalid.valid,false);
  assert.equal(invalid.errors.some(error=>error.code==='required'||error.code==='domain'),true);
  assert.equal(invalid.duplicates.length,1);
});

test('valid field and input import plans apply through repositories',async()=>withHost(async host=>{
  const fieldPlan=previewCropImport({target:'fields',rows:[{codigo:'T1',nome:'Norte',fazenda:'F1',area:'12'}],mapping:{id:'codigo',code:'codigo',name:'nome',farmUnitId:'fazenda',areaHa:row=>Number(row.area)}});
  assert.equal(fieldPlan.valid,true);
  const fieldResult=await applyCropImport(fieldPlan,{repos:host.presentation.services.repos});
  assert.equal(fieldResult.inserted,1);
  assert.equal((await host.presentation.services.repos.fields.get('T1')).payload.name,'Norte');
  const inputPlan=previewCropImport({target:'inputs',rows:[{codigo:'I1',nome:'Adubo',unidade:'kg',categoria:'fertilizante'}],mapping:{id:'codigo',name:'nome',unit:'unidade',category:'categoria'}});
  assert.equal(inputPlan.valid,true);
  await applyCropImport(inputPlan,{repos:host.presentation.services.repos});
  assert.equal((await host.presentation.services.repos.inputs.get('I1')).payload.unit,'kg');
}));

test('backend import apply is atomic when a later row conflicts',async()=>withHost(async host=>{
  const auth=await admin(host);
  await host.presentation.services.repos.fields.save({id:'EXIST',code:'EXIST',name:'Existente',farmUnitId:'F1',areaHa:5},{expectedVersion:0});
  const preview=await host.backend.action({screenId:'settings',action:'previewImport',auth,input:{target:'fields',rows:[{codigo:'NEW',nome:'Novo',fazenda:'F1',area:'8'},{codigo:'EXIST',nome:'Conflito',fazenda:'F1',area:'9'}],mapping:{id:'codigo',code:'codigo',name:'nome',farmUnitId:'fazenda',areaHa:'area'}}});
  assert.equal(preview.valid,true);
  await assert.rejects(host.backend.action({screenId:'settings',action:'applyImport',auth,input:{plan:preview}}),/Version conflict|expected 0/);
  assert.equal(await host.presentation.services.repos.fields.get('NEW'),null);
  assert.equal((await host.presentation.services.repos.fields.get('EXIST')).payload.name,'Existente');
}));

test('export supports csv json and workbook model deterministically',()=>{
  const rows=[{name:'Talhão, Norte',crop:'Soja'}];
  assert.equal(exportCropRows(rows,{format:'json'}),JSON.stringify(rows));
  assert.match(exportCropRows(rows,{format:'csv',delimiter:','}),/"Talhão, Norte",Soja/);
  const workbook=exportCropRows(rows,{format:'xlsx-model',sheetName:'Safra'});
  assert.equal(workbook.sheetName,'Safra');
  assert.deepEqual(workbook.rows,[['Talhão, Norte','Soja']]);
});

test('settings actions persist configurable P1 values',async()=>withHost(async host=>{
  const auth=await admin(host);
  await host.backend.action({screenId:'settings',action:'set',auth,input:{key:'inventory.lowStockThreshold',value:6}});
  await host.backend.action({screenId:'settings',action:'merge',auth,input:{values:{'planning.lookAheadDays':60,'alerts.enabled':false}}});
  const loaded=await host.backend.load({screenId:'settings',auth});
  assert.equal(loaded.configuration['inventory.lowStockThreshold'],6);
  assert.equal(loaded.configuration['planning.lookAheadDays'],60);
  assert.equal(loaded.configuration['alerts.enabled'],false);
}));
