import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createStandaloneHost} from '../runtime/host.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=relative=>fs.readFileSync(path.join(root,relative),'utf8');

async function withHost(work){
  const dataDir=await mkdtemp(join(tmpdir(),'agro-lavoura-ui-parity-'));
  const host=await createStandaloneHost({dataDir});
  try{return await work(host);}finally{
    await host.close().catch(()=>{});
    await rm(dataDir,{recursive:true,force:true}).catch(()=>{});
  }
}

test('dashboard load exposes the commercial management read model consumed by the UI',async()=>withHost(async host=>{
  const data=await host.presentation.load('overview',{});
  assert.ok(data.commercial,'overview must expose commercial read model');
  assert.ok(data.commercial.management,'overview must expose management snapshot');
  assert.ok(Array.isArray(data.commercial.alerts),'overview must expose intelligent alerts');
}));

test('operations load exposes commercial climate and alerts alongside advanced operational read models',async()=>withHost(async host=>{
  const data=await host.presentation.load('operations',{});
  assert.ok(data.commercial,'operations must expose commercial read model');
  assert.equal(typeof data.commercial.climate?.totalRainMm,'number');
  assert.ok(Array.isArray(data.commercial.alerts));
  assert.ok('planningProgress' in data);
  assert.ok(Array.isArray(data.gantt));
  assert.ok(Array.isArray(data.applications));
  assert.ok(Array.isArray(data.scouting));
}));

test('dashboard UI exposes search, alert lifecycle actions and capture',()=>{
  const source=read('web/ui/dashboard.jsx');
  for(const action of ['search','acknowledgeAlert','snoozeAlert','dismissAlert','capture']){
    assert.match(source,new RegExp(`onRun\\(['\"]${action}['\"]`),`dashboard action ${action} is not exposed`);
  }
  assert.match(source,/fileToBase64/,'capture must support a user-selected file');
  assert.match(source,/fileId/,'capture must send the file identity required by the capture service');
});

test('reports UI renders advanced commercial comparisons and indicators already produced by backend',()=>{
  const source=read('web/ui/reports.jsx');
  for(const key of ['seasonComparison','fieldComparison','indicators','report','alerts']){
    assert.match(source,new RegExp(key),`reports does not surface commercial.${key}`);
  }
});

test('operations UI renders planning progress, gantt, applications and scouting',()=>{
  const source=read('web/ui/operations.jsx');
  for(const key of ['planningProgress','gantt','applications','scouting']){
    assert.match(source,new RegExp(key),`operations does not surface ${key}`);
  }
});
