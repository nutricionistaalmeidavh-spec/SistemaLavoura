import assert from 'node:assert/strict';
import {mkdtemp,mkdir,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createStandaloneHost} from '../runtime/host.mjs';
import {currentCommit,writeEvidence} from './evidence.mjs';

const contract=JSON.parse(await readFile(new URL('../qa/product-contract.json',import.meta.url),'utf8'));
const artifactDir=fileURLToPath(new URL('../qa-artifacts/',import.meta.url));
const summaryPath=join(artifactDir,'phase5-summary.json');
const credential=['Qa','Standalone','2026!'].join('-');
const line=(s,l,d='')=>process.stdout.write(`[${s}] ${l}${d?` - ${d}`:''}\n`);
const actionKey=(screenId,action)=>`${screenId}.${action}`;
const declaredActions=Object.entries(contract.actions).flatMap(([screenId,actions])=>actions.map(action=>actionKey(screenId,action)));
const assertSubset=(actual,expected,label)=>{for(const item of expected)assert.ok(actual.includes(item),`${label} missing contracted item ${item}`);};
let root,host;
const exercised=new Set(),passed=new Set(),failures=[];
const summary={phase:5,productId:contract.productId,status:'failed',screens:[],checks:{},actionCoverage:{declared:declaredActions.length,exercised:0,passed:0,failed:[],untested:[...declaredActions],results:[]},commit:await currentCommit()};
const syncCoverage=()=>{summary.actionCoverage.exercised=exercised.size;summary.actionCoverage.passed=passed.size;summary.actionCoverage.failed=failures.map(item=>item.key);summary.actionCoverage.untested=declaredActions.filter(key=>!exercised.has(key));};

try{
  await mkdir(artifactDir,{recursive:true});
  root=await mkdtemp(join(tmpdir(),`${contract.productId}-phase5-`));
  host=await createStandaloneHost({dataDir:root});
  assert.equal((await host.backend.authState()).hasUsers,false);
  await host.backend.bootstrap({username:'qa-admin',password:credential});
  const logged=await host.backend.login({username:'qa-admin',password:credential});
  const auth={sessionId:logged.session.id,token:logged.token};
  await host.backend.validate(auth);summary.checks.authentication=true;line('PASS','Autenticação');

  const meta=await host.backend.describe();
  assert.equal(meta.productId,contract.productId);
  assertSubset(meta.navigation.map(x=>x.id),contract.screens,'navigation');
  assertSubset(meta.screens.map(x=>x.id),contract.screens,'screens');
  for(let i=0;i<contract.screens.length;i+=1){
    const id=contract.screens[i];await host.backend.load({screenId:id,auth,context:{}});
    const desc=meta.screens.find(x=>x.id===id),expected=contract.actions[id]??[];
    const actual=Object.keys(host.presentation.screen(id).actions??{}),definitions=Object.keys(desc?.actionDefinitions??{});
    assertSubset(actual,expected,`screen ${id}`);assertSubset(definitions,expected,`screen definition ${id}`);
    summary.screens.push({id,contractedActions:expected.length,totalActions:actual.length,loaded:true});
    line('PASS',`Tela ${i+1}/${contract.screens.length}: ${id}`,`${expected.length} ações P0 / ${actual.length} totais`);
  }
  summary.checks.surface=true;

  const securityModule=await import('../src/security.js');
  assert.ok((securityModule.SECURITY_POLICY?.admin??[]).includes('*'));assert.ok(Array.isArray(securityModule.SECURITY_POLICY?.viewer));summary.checks.rbacContract=true;line('PASS','Contrato RBAC');

  async function exercise(screenId,action,input={}){
    const key=actionKey(screenId,action),first=!exercised.has(key);if(first)exercised.add(key);
    try{const result=await host.backend.action({screenId,action,input,auth,context:{qa:true}});if(first){passed.add(key);summary.actionCoverage.results.push({key,status:'passed'});line('PASS',`Ação ${key}`);}syncCoverage();return result;}
    catch(error){failures.push({key,error:error?.message??String(error)});if(first)summary.actionCoverage.results.push({key,status:'failed',error:error?.message??String(error)});syncCoverage();throw error;}
  }

  const t0='2026-09-19T12:00:00.000Z';
  await exercise('fields','save',{id:'field-qa',code:'QA-01',name:'Talhão QA',farmUnitId:'farm-qa',areaHa:12});
  await exercise('seasons','save',{id:'season-qa',crop:'Soja',productionPeriodId:'2026-27',fieldIds:['field-qa']});
  await exercise('operations','schedule',{id:'operation-complete',seasonId:'season-qa',fieldId:'field-qa',typeId:'planting',scheduledAt:t0,inputItems:[]});
  await exercise('operations','start',{id:'operation-complete',startedAt:'2026-09-19T13:00:00.000Z'});
  await exercise('operations','complete',{id:'operation-complete',completedAt:'2026-09-19T14:00:00.000Z',actualCostMinor:45000,notes:'QA P0'});
  await exercise('operations','schedule',{id:'operation-cancel',seasonId:'season-qa',fieldId:'field-qa',typeId:'spraying',scheduledAt:'2026-09-20T12:00:00.000Z',inputItems:[]});
  await exercise('operations','cancel',{id:'operation-cancel',reason:'QA cancellation',cancelledAt:'2026-09-19T15:00:00.000Z'});
  await exercise('inputs','save',{id:'input-qa',name:'Fertilizante QA',unit:'kg',category:'fertilizante',unitCostMinor:250});
  await exercise('harvest','create',{id:'harvest-qa',seasonId:'season-qa',fieldId:'field-qa',quantity:6000,unit:'kg',areaHa:12,harvestedAt:'2026-09-19T16:00:00.000Z'});
  await exercise('inventory','receive',{id:'movement-in',sku:'input-qa',quantity:100,lotNumber:'LOT-QA',occurredAt:'2026-09-19T12:10:00.000Z'});
  await exercise('inventory','consume',{id:'movement-out',sku:'input-qa',quantity:20,lotNumber:'LOT-QA',occurredAt:'2026-09-19T12:20:00.000Z'});
  await exercise('finance','addExpense',{id:'expense-qa',seasonId:'season-qa',fieldId:'field-qa',amountMinor:100000,description:'Insumos QA',category:'insumos'});
  await exercise('finance','addIncome',{id:'income-qa',seasonId:'season-qa',fieldId:'field-qa',amountMinor:250000,description:'Venda QA'});
  const csv=await exercise('reports','csv',{type:'season-summary',rows:[{seasonId:'season-qa',crop:'Soja',areaHa:12,harvestQuantity:6000,yieldPerHa:500,costMinor:100000}]});
  await exercise('reports','issue',{id:'report-qa',type:'season-summary',format:'csv',content:csv.content,title:'Resumo QA',metadata:{qa:true}});
  await exercise('fields','remove',{id:'field-qa'});
  const functionalBackup=await exercise('settings','backup',{id:'phase5-functional'});await exercise('settings','restore',{id:functionalBackup.id});

  syncCoverage();assert.equal(summary.actionCoverage.declared,17);assert.equal(summary.actionCoverage.exercised,17);assert.equal(summary.actionCoverage.passed,17);assert.deepEqual(summary.actionCoverage.failed,[]);assert.deepEqual(summary.actionCoverage.untested,[]);summary.checks.functionalActions=true;
  const security=host.presentation.services.security;for(const key of declaredActions){const auditRows=await security.listAudit({...auth,action:`${key}:success`});assert.ok(auditRows.length>=1,`Missing success audit for ${key}`);}summary.checks.businessAudit=true;line('PASS','Cobertura funcional','17/17 ações P0 executadas');

  await host.persistence.putRecord('qa.phase5','sentinel',{value:'before'},{expectedVersion:0});const backup=await host.recovery.createBackup({id:'phase5-known-good'});await host.persistence.putRecord('qa.phase5','sentinel',{value:'after'},{expectedVersion:1});await host.recovery.restoreBackup(backup.id);assert.equal((await host.persistence.getRecord('qa.phase5','sentinel')).payload.value,'before');summary.checks.backupRestore=true;line('PASS','Backup/restore');
  await host.close();host=null;host=await createStandaloneHost({dataDir:root});const again=await host.backend.login({username:'qa-admin',password:credential});const restartedAuth={sessionId:again.session.id,token:again.token};await host.backend.validate(restartedAuth);assert.equal((await host.persistence.getRecord('qa.phase5','sentinel')).payload.value,'before');assert.equal((await host.persistence.health()).ok,true);summary.checks.restartPersistence=true;
  summary.status='passed';summary.screenCount=contract.screens.length;summary.actionCount=declaredActions.length;summary.finishedAt=new Date().toISOString();await writeEvidence(summaryPath,summary);line('PASS','FASE 5',`${summary.screenCount} telas P0, 17/17 ações P0 funcionais`);
}catch(error){syncCoverage();summary.error=error.stack??error.message;summary.finishedAt=new Date().toISOString();await writeEvidence(summaryPath,summary).catch(()=>{});line('FAIL','FASE 5',error.message);process.exitCode=1;}
finally{await host?.close?.().catch(()=>{});if(root&&process.env.ARTISYS_QA_KEEP!=='1')await rm(root,{recursive:true,force:true}).catch(()=>{});}
