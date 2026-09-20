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

test('operations load exposes the complete commercial operational read model',async()=>withHost(async host=>{
  const data=await host.presentation.load('operations',{});
  assert.ok(data.commercial,'operations must expose commercial read model');
  assert.equal(typeof data.commercial.climate?.totalRainMm,'number');
  assert.ok(Array.isArray(data.commercial.alerts));
  assert.ok(Array.isArray(data.commercial.requirements));
  assert.ok(Array.isArray(data.commercial.rainfall));
  assert.equal(typeof data.commercial.fieldMobile?.offlineReady,'boolean');
  assert.ok(Array.isArray(data.commercial.fieldMobile?.pendingOperations));
  assert.ok(Array.isArray(data.commercial.fieldMobile?.openScouting));
  assert.ok(Array.isArray(data.commercial.fieldMobile?.recentRainfall));
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

test('reports UI renders comparisons, advanced indicators and the consolidated management report',()=>{
  const source=read('web/ui/reports.jsx');
  for(const key of ['seasonComparison','fieldComparison','indicators','report','alerts']){
    assert.match(source,new RegExp(key),`reports does not surface commercial.${key}`);
  }
  assert.match(source,/report\.indicators/,'management report indicators must be rendered');
  assert.match(source,/report\.seasonComparison/,'management report season comparison must be rendered');
  assert.match(source,/report\.fieldComparison/,'management report field comparison must be rendered');
});

test('operations UI renders the complete operational analytics without truncating histories',()=>{
  const source=read('web/ui/operations.jsx');
  for(const key of ['planningProgress','gantt','applications','scouting','requirements','fieldMobile','rainfall']){
    assert.match(source,new RegExp(key),`operations does not surface ${key}`);
  }
  assert.doesNotMatch(source,/gantt\.slice\(/,'gantt history must not be truncated');
  assert.doesNotMatch(source,/applications\.slice\(/,'application history must not be truncated');
  assert.doesNotMatch(source,/scouting\.slice\(/,'scouting history must not be truncated');
  assert.doesNotMatch(source,/rainfall\.slice\(/,'rainfall history must not be truncated');
});

test('operation scheduling lets the user plan inputs so future requirements can be calculated',()=>{
  const source=read('web/ui/operations.jsx');
  assert.match(source,/plannedInputs/,'schedule form must expose planned input lines');
  assert.match(source,/inputItems/,'planned input lines must be converted to backend inputItems');
  assert.match(source,/Previsão de insumos/,'future input requirements must be visible to the user');
});
