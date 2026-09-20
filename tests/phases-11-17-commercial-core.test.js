import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createStandaloneHost} from '../runtime/host.mjs';
import {createCropExpense} from '../src/finance.js';
import {getUiContract,normalizeFormValues} from '../web/ui/contracts.js';

const password='Qa-Commercial-Core-2026!';
async function withHost(work){const root=await mkdtemp(join(tmpdir(),'agro-lavoura-commercial-core-'));const host=await createStandaloneHost({dataDir:root});try{return await work(host);}finally{await host.close().catch(()=>{});await rm(root,{recursive:true,force:true}).catch(()=>{});}}
async function auth(host,username='commercial-admin'){await host.backend.bootstrap({username,password});const login=await host.backend.login({username,password});return{sessionId:login.session.id,token:login.token};}

async function seedAgriculturalCore(host,credentials,{operationId=null}={}){
  const field=await host.backend.action({screenId:'fields',action:'save',auth:credentials,input:{code:'T04',name:'Talhão 4',farmUnitName:'Fazenda Boa Vista',areaName:'Área Norte',areaHa:50}});
  const input=await host.backend.action({screenId:'inputs',action:'save',auth:credentials,input:{name:'Glifosato',unit:'L',category:'Herbicida',unitCost:10}});
  const season=await host.backend.action({screenId:'seasons',action:'save',auth:credentials,input:{crop:'Soja',periodName:'2026/27',varietyName:'Cultivar X',cycleDays:120,fieldIds:[field.payload.id],budget:50000}});
  await host.backend.action({screenId:'inventory',action:'receive',auth:credentials,input:{sku:input.payload.id,quantity:200,lotNumber:'LOT-01',occurredAt:'2026-09-19T12:00:00.000Z'}});
  const operation=await host.backend.action({screenId:'operations',action:'schedule',auth:credentials,input:{...(operationId?{id:operationId}:{}),seasonId:season.payload.id,fieldId:field.payload.id,typeName:'Pulverização',scheduledAt:'2026-09-20T12:00:00.000Z',machineName:'Pulverizador 01',operatorName:'João'}});
  await host.backend.action({screenId:'operations',action:'start',auth:credentials,input:{id:operation.payload.id,startedAt:'2026-09-20T12:05:00.000Z'}});
  return {field:field.payload,input:input.payload,season:season.payload,operation:operation.payload};
}

test('phases 11-12 build farm > area > field > season > variety without user-facing ids or cents',async()=>withHost(async host=>{
  const credentials=await auth(host,'model-admin');
  const seeded=await seedAgriculturalCore(host,credentials);
  const farmUnits=await host.presentation.services.repos.farmUnits.list();
  const farmAreas=await host.presentation.services.repos.farmAreas.list();
  const varieties=await host.presentation.services.repos.varieties.list();
  assert.equal(farmUnits.length,1);assert.equal(farmUnits[0].payload.name,'Fazenda Boa Vista');
  assert.equal(farmAreas.length,1);assert.equal(farmAreas[0].payload.name,'Área Norte');assert.equal(farmAreas[0].payload.farmUnitId,farmUnits[0].payload.id);
  assert.equal(seeded.field.farmUnitId,farmUnits[0].payload.id);assert.equal(seeded.field.areaGroupId,farmAreas[0].payload.id);
  assert.equal(varieties.length,1);assert.equal(seeded.season.varietyId,varieties[0].payload.id);assert.equal(seeded.season.cycleDays,120);assert.equal(seeded.season.budgetMinor,5_000_000);
  assert.equal(seeded.input.unitCostMinor,1000);
  for(const [screenId,actionName] of [['fields','save'],['seasons','save'],['inputs','save'],['inventory','receive'],['finance','addExpense']]){
    const names=getUiContract(screenId).actions[actionName].fields.map(item=>item.name);
    assert.equal(names.includes('id'),false,`${screenId}.${actionName} must not ask for id`);
    assert.equal(names.some(name=>/Minor$/i.test(name)),false,`${screenId}.${actionName} must not expose minor units`);
  }
  const moneyField=getUiContract('finance').actions.addExpense.fields.find(item=>item.name==='amount');
  assert.equal(normalizeFormValues([moneyField],{amount:'1234.56'}).amount,1234.56);
}));

test('phases 13-17 complete one agricultural command with stock, cost and field-notebook effects',async()=>withHost(async host=>{
  const credentials=await auth(host,'flow-admin');
  const seeded=await seedAgriculturalCore(host,credentials);
  const result=await host.backend.action({screenId:'operations',action:'complete',auth:credentials,input:{id:seeded.operation.id,completedAt:'2026-09-20T14:00:00.000Z',actualAreaHa:50,inputUsages:['Glifosato | 2 L/ha'],laborCost:100,machineCost:200,otherCost:0,notes:'Aplicação concluída sem intercorrências.'}});
  assert.equal(result.payload.status,'completed');
  assert.equal(result.payload.actualAreaHa,50);
  assert.equal(result.payload.actualCostMinor,130000);
  assert.equal(result.payload.costPerHaMinor,2600);
  assert.equal(result.payload.inputUsages[0].quantity,100);
  assert.equal(await host.presentation.services.inventory.available(seeded.input.id),100);
  const finance=await host.presentation.services.finance.list();
  const expense=finance.find(record=>record.payload.metadata?.operationId===seeded.operation.id);
  assert.ok(expense);assert.equal(expense.payload.amountMinor,130000);assert.equal(expense.payload.metadata.costBreakdown.inputsMinor,100000);
  const notebook=await host.presentation.services.repos.fieldNotebook.list();
  const entry=notebook.find(record=>record.payload.operationId===seeded.operation.id);
  assert.ok(entry);assert.equal(entry.payload.fieldId,seeded.field.id);assert.equal(entry.payload.costPerHaMinor,2600);assert.equal(entry.payload.inputUsages[0].quantity,100);
  const operations=await host.backend.load({screenId:'operations',auth:credentials});
  assert.equal(operations.costs.byField[seeded.field.id].amountMinor,130000);
  assert.equal(operations.costs.byField[seeded.field.id].costPerHaMinor,2600);
}));

test('phase 13 rolls back operation and inventory when a later financial side-effect fails',async()=>withHost(async host=>{
  const credentials=await auth(host,'rollback-admin');
  const seeded=await seedAgriculturalCore(host,credentials,{operationId:'op-rollback'});
  await host.presentation.services.finance.save(createCropExpense({id:'operation-cost:op-rollback',seasonId:seeded.season.id,fieldId:seeded.field.id,amountMinor:1,description:'Conflict fixture',category:'qa'}),{expectedVersion:0});
  await assert.rejects(host.backend.action({screenId:'operations',action:'complete',auth:credentials,input:{id:'op-rollback',completedAt:'2026-09-20T14:00:00.000Z',actualAreaHa:50,inputUsages:['Glifosato | 2 L/ha'],laborCost:100,machineCost:200}}),/Version conflict|version conflict/i);
  const operation=await host.presentation.services.repos.operations.get('op-rollback');
  assert.equal(operation.payload.status,'in-progress');
  assert.equal(await host.presentation.services.inventory.available(seeded.input.id),200);
  const notebook=await host.presentation.services.repos.fieldNotebook.list();
  assert.equal(notebook.some(record=>record.payload.operationId==='op-rollback'),false);
}));
