import assert from 'node:assert/strict';
import {mkdtemp,mkdir,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createStandaloneHost} from '../runtime/host.mjs';
import {currentCommit,writeEvidence} from './evidence.mjs';

const contract=JSON.parse(await readFile(new URL('../qa/p2-contract.json',import.meta.url),'utf8'));
const artifactDir=fileURLToPath(new URL('../qa-artifacts/',import.meta.url));const summaryPath=join(artifactDir,'p2-summary.json');
const password='Qa-P2-Functional-2026!';const key=(screen,action)=>`${screen}.${action}`;
const declaredActions=Object.entries(contract.actions).flatMap(([screen,actions])=>actions.map(action=>key(screen,action)));
const exercised=new Set(),passed=new Set(),failures=[],modulePassed=new Set(),moduleFailures=[];let root,host;
const summary={phase:'P2',productId:contract.productId,status:'failed',checks:{},actionCoverage:{declared:declaredActions.length,exercised:0,passed:0,failed:[],untested:[...declaredActions],results:[]},moduleCoverage:{declared:contract.modules.length,passed:0,failed:[],results:[]},commit:await currentCommit()};
const sync=()=>{summary.actionCoverage.exercised=exercised.size;summary.actionCoverage.passed=passed.size;summary.actionCoverage.failed=failures.map(x=>x.key);summary.actionCoverage.untested=declaredActions.filter(x=>!exercised.has(x));summary.moduleCoverage.passed=modulePassed.size;summary.moduleCoverage.failed=moduleFailures.map(x=>x.module);};
const line=(status,label)=>process.stdout.write(`[${status}] ${label}\n`);
try{
 await mkdir(artifactDir,{recursive:true});root=await mkdtemp(join(tmpdir(),'agro-lavoura-p2-qa-'));host=await createStandaloneHost({dataDir:root});
 await host.backend.bootstrap({username:'p2-qa-admin',password});const login=await host.backend.login({username:'p2-qa-admin',password});const auth={sessionId:login.session.id,token:login.token};
 const services=host.presentation.services,security=services.security;
 async function exercise(screenId,action,input={}){const actionKey=key(screenId,action);exercised.add(actionKey);try{const result=await host.backend.action({screenId,action,input,auth,context:{qa:true}});passed.add(actionKey);summary.actionCoverage.results.push({key:actionKey,status:'passed'});line('PASS',actionKey);sync();return result;}catch(error){failures.push({key:actionKey,error:error?.message??String(error)});summary.actionCoverage.results.push({key:actionKey,status:'failed',error:error?.message??String(error)});sync();throw error;}}
 async function moduleCheck(name,work){try{await work();modulePassed.add(name);summary.moduleCoverage.results.push({module:name,status:'passed'});line('PASS',`module ${name}`);}catch(error){moduleFailures.push({module:name,error:error?.message??String(error)});summary.moduleCoverage.results.push({module:name,status:'failed',error:error?.message??String(error)});throw error;}finally{sync();}}
 await host.backend.action({screenId:'fields',action:'save',auth,input:{id:'field-p2',code:'P2',name:'Talhão P2',farmUnitId:'farm-p2',areaHa:12}});
 const capture=await exercise('overview','capture',{id:'cap-p2',fileId:'capture-file-p2',name:'vistoria.jpg',mimeType:'image/jpeg',bytesBase64:'/9j/',entityType:'field',entityId:'field-p2',source:'camera'});
 const uploaded=await exercise('fields','uploadFile',{id:'field-file-p2',name:'mapa.txt',mimeType:'text/plain',bytesBase64:'bWFwYQ==',entityId:'field-p2'});
 await exercise('fields','removeFile',{id:'field-file-p2'});
 const pdf=await exercise('reports','pdf',{type:'season-summary',title:'Resumo P2',rows:[{seasonId:'season-p2',crop:'Soja',areaHa:12,harvestQuantity:100,yieldPerHa:8.3,costMinor:5000}]});
 const checklist=await exercise('operations','createChecklist',{id:'check-p2',entityId:'operation-p2',title:'Pré-operação',items:[{id:'epi',label:'Conferir EPI',required:true}]});
 await exercise('operations','setChecklistItem',{id:'check-p2',itemId:'epi',checked:true});
 const completed=await exercise('operations','completeChecklist',{id:'check-p2'});
 const catalog=await exercise('settings','upsertCatalog',{id:'soybean',type:'crop',name:'Soja',active:true});
 const flag=await exercise('settings','setFeatureFlag',{key:'checklists.enforceBeforeOperationComplete',value:true});
 await moduleCheck('capture',async()=>{assert.equal(capture.payload.fileId,'capture-file-p2');assert.equal((await services.capture.list({entityId:'field-p2'})).length,1);});
 await moduleCheck('files',async()=>{const file=await services.files.get('capture-file-p2');assert.match(file.payload.sha256,/^[0-9a-f]{64}$/);});
 await moduleCheck('upload',async()=>{assert.equal(uploaded.payload.size,4);assert.equal(await services.files.get('field-file-p2'),null);});
 await moduleCheck('pdf',async()=>{assert.equal(pdf.mimeType,'application/pdf');assert.ok(pdf.size>100);assert.equal(new TextDecoder().decode(pdf.content.slice(0,8)).startsWith('%PDF-1.'),true);});
 await moduleCheck('checklists',async()=>{assert.equal(checklist.payload.status,'open');assert.equal(completed.payload.status,'completed');});
 await moduleCheck('catalog',async()=>{assert.equal(catalog.payload.type,'crop');assert.equal((await services.agriculturalCatalog.search('soja')).length,1);});
 await moduleCheck('feature-flags',async()=>{assert.equal(flag.payload.value,true);assert.equal(await services.featureFlags.enabled('checklists.enforceBeforeOperationComplete'),true);});
 sync();assert.equal(summary.actionCoverage.declared,9);assert.equal(summary.actionCoverage.exercised,9);assert.equal(summary.actionCoverage.passed,9);assert.deepEqual(summary.actionCoverage.failed,[]);assert.deepEqual(summary.actionCoverage.untested,[]);assert.equal(summary.moduleCoverage.declared,7);assert.equal(summary.moduleCoverage.passed,7);assert.deepEqual(summary.moduleCoverage.failed,[]);
 for(const actionKey of declaredActions){const audit=await security.listAudit({...auth,action:`${actionKey}:success`});assert.ok(audit.length>=1,`Missing P2 audit success for ${actionKey}`);}
 summary.checks.businessAudit=true;summary.checks.p0ActionContract=contract.p0ActionContract;summary.checks.p1ActionContract=contract.p1ActionContract;summary.checks.p2ActionContract=contract.p2ActionContract;summary.checks.totalActionContract=contract.totalActionContract;summary.status='passed';summary.finishedAt=new Date().toISOString();await writeEvidence(summaryPath,summary);line('PASS','P2 7/7 modules, 9/9 actions, 37 total actions');
}catch(error){sync();summary.error=error.stack??error.message;summary.finishedAt=new Date().toISOString();await writeEvidence(summaryPath,summary).catch(()=>{});line('FAIL',error.message);process.exitCode=1;}finally{await host?.close?.().catch(()=>{});if(root&&process.env.ARTISYS_QA_KEEP!=='1')await rm(root,{recursive:true,force:true}).catch(()=>{});}
