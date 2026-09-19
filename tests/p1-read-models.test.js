import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createStandaloneHost} from '../runtime/host.mjs';
import {financialEntryFingerprint} from '../shared/packages/domain-finance/src/index.js';
import {createPlanningService} from '../src/planning.js';
import {createReportingService} from '../src/reporting.js';
import {createProductSearch} from '../src/search.js';
import {buildDashboardSnapshot} from '../src/dashboard.js';

async function withHost(work){const root=await mkdtemp(join(tmpdir(),'agro-lavoura-readmodels-'));const host=await createStandaloneHost({dataDir:root});try{return await work(host);}finally{await host.close().catch(()=>{});await rm(root,{recursive:true,force:true}).catch(()=>{});}}

test('planning persists plans and returns progress plus resource conflicts',async()=>withHost(async host=>{
  const planning=createPlanningService(host.presentation.services.repos);
  await planning.save({id:'plan-1',seasonId:'season-1',tasks:[
    {id:'a',title:'Plantio Norte',start:'2026-09-20',end:'2026-09-22',progress:50,resourceId:'tractor-1'},
    {id:'b',title:'Plantio Sul',start:'2026-09-21',end:'2026-09-23',progress:100,resourceId:'tractor-1',dependencies:['a']}
  ]});
  const snapshot=await planning.snapshot();
  assert.equal(snapshot.plans.length,1);
  assert.equal(snapshot.progress,75);
  assert.deepEqual(snapshot.conflicts,[{planId:'plan-1',resourceId:'tractor-1',firstTaskId:'a',secondTaskId:'b'}]);
}));

test('reporting summarizes grouped agricultural rows and exports them',()=>{
  const reporting=createReportingService();
  const rows=[{crop:'Soja',amount:10},{crop:'Soja',amount:20},{crop:'Milho',amount:5}];
  assert.deepEqual(reporting.summary(rows,{groupField:'crop',valueField:'amount',op:'sum'}),{Milho:5,Soja:30});
  assert.match(reporting.export(rows,{format:'csv'}),/Soja,10/);
  assert.equal(reporting.export(rows,{format:'json'}),JSON.stringify(rows));
});

test('search spans agricultural entities and ignores accents',async()=>withHost(async host=>{
  await host.presentation.services.repos.fields.save({id:'f1',code:'CAFE-01',name:'Talhão Café Sul',farmUnitId:'farm-1',areaHa:8},{expectedVersion:0});
  await host.presentation.services.repos.inputs.save({id:'i1',name:'Adubo Nitrogênio',unit:'kg',category:'fertilizante'},{expectedVersion:0});
  const search=createProductSearch({repos:host.presentation.services.repos,finance:host.presentation.services.finance});
  const cafe=await search.query('cafe');
  assert.equal(cafe[0].document.kind,'field');
  const nitrogenio=await search.query('nitro');
  assert.equal(nitrogenio[0].document.id,'i1');
}));

test('financial fingerprint is deterministic and normalized',()=>{
  const a={id:'e1',direction:'expense',amountMinor:1000,currency:'BRL',description:'  ADUBO Café ',partyId:'p1',allocation:{kind:'crop-field',id:'f1'},metadata:{seasonId:'s1'}};
  const b={...a,description:'adubo café'};
  assert.equal(financialEntryFingerprint(a),financialEntryFingerprint(b));
  assert.match(financialEntryFingerprint(a),/^[0-9a-f]{16}$/);
}));

test('dashboard aggregates fields operations harvest finance alerts inventory and planning',async()=>{
  const snapshot=await buildDashboardSnapshot({
    fields:[{areaHa:10},{areaHa:15}],seasons:[{}],operations:[{status:'completed'},{status:'planned'}],harvestLots:[{quantity:100,areaHa:10}],entries:[{direction:'income',amountMinor:5000,settlements:[]},{direction:'expense',amountMinor:2000,settlements:[]}],alerts:[{status:'active',dueAt:'2026-09-19T10:00:00.000Z'}],inventory:{state:{sku1:{sku:'sku1',onHand:4,reserved:0}}},lowStockThreshold:5,planning:{plans:[{}],progress:50,conflicts:[{resourceId:'tractor'}]},now:'2026-09-19T12:00:00.000Z'
  });
  assert.equal(snapshot.fields.count,2);assert.equal(snapshot.fields.areaHa,25);
  assert.equal(snapshot.operations.completed,1);
  assert.equal(snapshot.harvest.quantity,100);
  assert.equal(snapshot.finance.marginMinor,3000);
  assert.equal(snapshot.alerts.due,1);
  assert.equal(snapshot.inventory.lowStock,1);
  assert.equal(snapshot.planning.conflicts,1);
});
