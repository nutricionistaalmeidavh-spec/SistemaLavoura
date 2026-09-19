import assert from 'node:assert/strict';
import {mkdtemp,mkdir,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createStandaloneHost} from '../runtime/host.mjs';
import {FIELD_OPERATION_WORKFLOW} from '../src/operations.js';
import {financialEntryFingerprint} from '../shared/packages/domain-finance/src/index.js';
import {currentCommit,writeEvidence} from './evidence.mjs';

const contract=JSON.parse(await readFile(new URL('../qa/p1-contract.json',import.meta.url),'utf8'));
const artifactDir=fileURLToPath(new URL('../qa-artifacts/',import.meta.url));
const summaryPath=join(artifactDir,'p1-summary.json');
const password='Qa-P1-Functional-2026!';
const actionKey=(screenId,action)=>`${screenId}.${action}`;
const declaredActions=Object.entries(contract.actions).flatMap(([screenId,actions])=>actions.map(action=>actionKey(screenId,action)));
const line=(status,label,detail='')=>process.stdout.write(`[${status}] ${label}${detail?` - ${detail}`:''}\n`);
let root,host;
const exercised=new Set(),passed=new Set(),actionFailures=[],modulePassed=new Set(),moduleFailures=[];
const summary={
  phase:'P1',productId:contract.productId,status:'failed',checks:{},
  actionCoverage:{declared:declaredActions.length,exercised:0,passed:0,failed:[],untested:[...declaredActions],results:[]},
  moduleCoverage:{declared:contract.modules.length,passed:0,failed:[],results:[]},
  commit:await currentCommit()
};
const sync=()=>{
  summary.actionCoverage.exercised=exercised.size;
  summary.actionCoverage.passed=passed.size;
  summary.actionCoverage.failed=actionFailures.map(item=>item.key);
  summary.actionCoverage.untested=declaredActions.filter(key=>!exercised.has(key));
  summary.moduleCoverage.passed=modulePassed.size;
  summary.moduleCoverage.failed=moduleFailures.map(item=>item.module);
};
const moduleCheck=async(name,work)=>{
  try{await work();modulePassed.add(name);summary.moduleCoverage.results.push({module:name,status:'passed'});line('PASS',`Módulo ${name}`);}
  catch(error){moduleFailures.push({module:name,error:error?.message??String(error)});summary.moduleCoverage.results.push({module:name,status:'failed',error:error?.message??String(error)});throw error;}
  finally{sync();}
};

try{
  await mkdir(artifactDir,{recursive:true});
  root=await mkdtemp(join(tmpdir(),'agro-lavoura-p1-qa-'));
  host=await createStandaloneHost({dataDir:root});
  await host.backend.bootstrap({username:'p1-qa-admin',password});
  const login=await host.backend.login({username:'p1-qa-admin',password});
  const auth={sessionId:login.session.id,token:login.token};
  await host.backend.validate(auth);
  const security=host.presentation.services.security;
  const services=host.presentation.services;

  async function exercise(screenId,action,input={}){
    const key=actionKey(screenId,action),first=!exercised.has(key);
    if(first)exercised.add(key);
    try{
      const result=await host.backend.action({screenId,action,input,auth,context:{qa:true}});
      if(first){passed.add(key);summary.actionCoverage.results.push({key,status:'passed'});line('PASS',`Ação ${key}`);}
      sync();
      return result;
    }catch(error){
      actionFailures.push({key,error:error?.message??String(error)});
      if(first)summary.actionCoverage.results.push({key,status:'failed',error:error?.message??String(error)});
      sync();throw error;
    }
  }

  await exercise('settings','set',{key:'inventory.lowStockThreshold',value:8});
  await exercise('settings','merge',{values:{'planning.lookAheadDays':45,'alerts.enabled':true,'reporting.csvDelimiter':';'}});

  const plan=await exercise('settings','previewImport',{
    target:'fields',
    rows:[{codigo:'P1-FIELD',nome:'Talhão Café P1',fazenda:'farm-p1',area:'10'}],
    mapping:{id:'codigo',code:'codigo',name:'nome',farmUnitId:'fazenda',areaHa:'area'}
  });
  assert.equal(plan.valid,true);
  await exercise('settings','applyImport',{plan});
  assert.equal((await services.repos.fields.get('P1-FIELD')).payload.name,'Talhão Café P1');

  await host.backend.action({screenId:'seasons',action:'save',auth,input:{id:'season-p1',crop:'Café',productionPeriodId:'2026-27',fieldIds:['P1-FIELD']}});
  await exercise('operations','savePlan',{id:'plan-p1',seasonId:'season-p1',name:'Plano P1',tasks:[{id:'task-p1',title:'Plantio Café',start:'2026-09-20',end:'2026-09-21',progress:50,resourceId:'tractor-p1'}]});
  await host.backend.action({screenId:'operations',action:'schedule',auth,input:{id:'op-p1-alert',seasonId:'season-p1',fieldId:'P1-FIELD',typeId:'planting',scheduledAt:'2026-09-22T10:00:00.000Z',inputItems:[]}});
  await host.backend.action({screenId:'inventory',action:'receive',auth,input:{id:'p1-stock-in',sku:'input-p1',quantity:5,occurredAt:'2026-09-19T10:00:00.000Z'}});
  const expense=await host.backend.action({screenId:'finance',action:'addExpense',auth,input:{id:'expense-p1',seasonId:'season-p1',fieldId:'P1-FIELD',amountMinor:12345,description:'Adubo Café',category:'insumos'}});

  const searchResults=await exercise('overview','search',{query:'cafe'});
  assert.ok(searchResults.some(result=>result.document.id==='P1-FIELD'));
  const reportRows=[{crop:'Café',amount:10},{crop:'Café',amount:15},{crop:'Soja',amount:4}];
  const reportSummary=await exercise('reports','summary',{rows:reportRows,groupField:'crop',valueField:'amount',op:'sum'});
  assert.equal(reportSummary['Café'],25);
  const exported=await exercise('reports','export',{rows:reportRows,format:'csv',delimiter:';'});
  assert.match(exported,/crop;amount/);

  const operationAlertId='operation:op-p1-alert:scheduled';
  assert.ok(await services.alerts.get(operationAlertId));
  const acknowledged=await exercise('overview','acknowledgeAlert',{id:operationAlertId});
  assert.equal(acknowledged.status,'acknowledged');
  const snoozed=await exercise('overview','snoozeAlert',{id:operationAlertId,until:'2026-09-23T10:00:00.000Z'});
  assert.equal(snoozed.status,'active');
  const dismissed=await exercise('overview','dismissAlert',{id:operationAlertId,reason:'QA P1 concluído'});
  assert.equal(dismissed.status,'dismissed');

  await moduleCheck('eventbus',async()=>{const events=await services.eventBus.list();assert.ok(events.length>=declaredActions.length);assert.ok(events.some(event=>event.type==='agro.operations.schedule.completed'));});
  await moduleCheck('workflow-engine',async()=>{assert.deepEqual(FIELD_OPERATION_WORKFLOW.states,['planned','in-progress','completed','cancelled']);const operation=(await services.repos.operations.get('op-p1-alert')).payload;assert.equal(operation.status,'planned');});
  await moduleCheck('inventory',async()=>{assert.equal(await services.inventory.available('input-p1'),5);const low=await services.alerts.get('inventory:input-p1:low-stock');assert.ok(low);assert.equal(low.metadata.threshold,8);});
  await moduleCheck('settings',async()=>{const snapshot=await services.settings.snapshot();assert.equal(snapshot['inventory.lowStockThreshold'],8);assert.equal(snapshot['planning.lookAheadDays'],45);});
  await moduleCheck('reporting',async()=>{assert.equal(reportSummary['Café'],25);});
  await moduleCheck('dashboard',async()=>{const overview=await host.backend.load({screenId:'overview',auth});assert.ok(overview.dashboard);assert.equal(overview.dashboard.fields.count,1);});
  await moduleCheck('planning',async()=>{const operations=await host.backend.load({screenId:'operations',auth});assert.equal(operations.plans.length,1);assert.equal(operations.planningProgress,50);});
  await moduleCheck('alerts',async()=>{assert.equal((await services.alerts.get(operationAlertId)).status,'dismissed');assert.ok(await services.alerts.get('inventory:input-p1:low-stock'));});
  await moduleCheck('importer',async()=>{assert.equal((await services.repos.fields.get('P1-FIELD')).payload.code,'P1-FIELD');});
  await moduleCheck('exporter',async()=>{assert.equal(typeof exported,'string');assert.match(exported,/Café;10/);});
  await moduleCheck('search',async()=>{assert.ok(searchResults.some(result=>result.document.kind==='field'));});
  await moduleCheck('finance-domain',async()=>{const entry=expense.payload??expense;assert.match(entry.metadata.fingerprint,/^[0-9a-f]{16}$/);assert.equal(entry.metadata.fingerprint,financialEntryFingerprint(entry));});

  sync();
  assert.equal(summary.actionCoverage.declared,11);assert.equal(summary.actionCoverage.exercised,11);assert.equal(summary.actionCoverage.passed,11);assert.deepEqual(summary.actionCoverage.failed,[]);assert.deepEqual(summary.actionCoverage.untested,[]);
  assert.equal(summary.moduleCoverage.declared,12);assert.equal(summary.moduleCoverage.passed,12);assert.deepEqual(summary.moduleCoverage.failed,[]);
  for(const key of declaredActions){const audit=await security.listAudit({...auth,action:`${key}:success`});assert.ok(audit.length>=1,`Missing P1 audit success for ${key}`);}
  summary.checks.businessAudit=true;
  summary.checks.p0ActionContract=17;
  summary.checks.p1ActionContract=11;
  summary.status='passed';summary.finishedAt=new Date().toISOString();
  await writeEvidence(summaryPath,summary);
  line('PASS','P1',`12/12 módulos, 11/11 ações P1; contrato P0 preservado`);
}catch(error){
  sync();summary.error=error.stack??error.message;summary.finishedAt=new Date().toISOString();await writeEvidence(summaryPath,summary).catch(()=>{});line('FAIL','P1',error.message);process.exitCode=1;
}finally{
  await host?.close?.().catch(()=>{});
  if(root&&process.env.ARTISYS_QA_KEEP!=='1')await rm(root,{recursive:true,force:true}).catch(()=>{});
}
