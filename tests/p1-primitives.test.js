import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorkflowDefinition,createWorkflowInstance,transitionWorkflow} from '../shared/vendor/release-modules/artisys-workflow-engine/src/index.mjs';
import {createAlert,acknowledgeAlert,snoozeAlert,dismissAlert,listDueAlerts} from '../shared/vendor/release-modules/artisys-alerts/src/index.mjs';
import {buildSearchIndex,searchIndex} from '../shared/vendor/release-modules/artisys-search/src/index.mjs';
import {toCsv,exportRows} from '../shared/vendor/release-modules/artisys-exporter/src/index.mjs';
import {createImportPlan} from '../shared/vendor/release-modules/artisys-importer/src/index.mjs';
import {groupBy,aggregate} from '../shared/vendor/release-modules/artisys-reporting/src/index.mjs';
import {validatePlan,calculateProgress,findResourceConflicts} from '../shared/vendor/release-modules/artisys-planning/src/index.mjs';

test('workflow engine enforces allowed transitions',()=>{
  const definition=createWorkflowDefinition({id:'field-operation',initialState:'planned',states:['planned','in-progress','completed'],transitions:[{id:'start',from:'planned',to:'in-progress',event:'start'},{id:'complete',from:'in-progress',to:'completed',event:'complete'}]});
  const instance=createWorkflowInstance({id:'op-1',workflowId:'field-operation',state:'planned'});
  assert.throws(()=>transitionWorkflow(definition,instance,'completed',{event:'complete'}),/transition not allowed/);
  const started=transitionWorkflow(definition,instance,'in-progress',{event:'start'});
  assert.equal(started.state,'in-progress');
  assert.equal(started.history.length,1);
});

test('alert lifecycle supports due acknowledge snooze and dismiss',()=>{
  const alert=createAlert({id:'a1',entityRef:{kind:'operation',id:'op-1'},title:'Operação vencida',dueAt:'2026-09-19T10:00:00.000Z',severity:'warning'});
  assert.equal(listDueAlerts([alert],{now:'2026-09-19T11:00:00.000Z'}).length,1);
  const acknowledged=acknowledgeAlert(alert,{actorId:'u1',at:'2026-09-19T11:01:00.000Z'});
  assert.equal(acknowledged.status,'acknowledged');
  const snoozed=snoozeAlert(alert,{until:'2026-09-20T10:00:00.000Z'});
  assert.equal(snoozed.snoozedUntil,'2026-09-20T10:00:00.000Z');
  const dismissed=dismissAlert(snoozed,{actorId:'u1',reason:'resolvido',at:'2026-09-19T11:02:00.000Z'});
  assert.equal(dismissed.status,'dismissed');
});

test('search is accent insensitive and prefix aware',()=>{
  const index=buildSearchIndex([{id:'1',name:'Talhão Café Sul',description:'Área produtiva'}],{fields:['name','description'],weights:{name:2}});
  const results=searchIndex(index,'talh caf');
  assert.equal(results.length,1);
  assert.equal(results[0].document.id,'1');
});

test('exporter quotes delimiter and supports deterministic json',()=>{
  const rows=[{name:'Talhão, Norte',crop:'Soja'},{name:'Sul',crop:'Milho'}];
  assert.match(toCsv(rows,{columns:['name','crop']}),/^name,crop\r\n"Talhão, Norte",Soja/);
  assert.equal(exportRows(rows,{format:'json'}),JSON.stringify(rows));
});

test('importer detects duplicates after mapping',()=>{
  const plan=createImportPlan([{codigo:'T1',nome:'Norte'},{codigo:'T1',nome:'Duplicado'}],{mapping:{id:'codigo',name:'nome'},schema:{required:['id','name']},duplicateKey:'id'});
  assert.equal(plan.valid,false);
  assert.equal(plan.duplicates.length,1);
  assert.equal(plan.errors.some(error=>error.code==='duplicate'),true);
});

test('reporting groups and aggregates finite values',()=>{
  const rows=[{crop:'Soja',amount:10},{crop:'Soja',amount:20},{crop:'Milho',amount:5}];
  const groups=groupBy(rows,'crop');
  assert.equal(groups.Soja.length,2);
  assert.equal(aggregate(groups.Soja,'amount','sum'),30);
  assert.equal(aggregate(rows,'amount','avg'),35/3);
});

test('planning validates tasks progress and resource conflicts',()=>{
  const tasks=validatePlan([
    {id:'a',title:'Plantio A',start:'2026-09-20',end:'2026-09-22',progress:50,resourceId:'tractor-1'},
    {id:'b',title:'Plantio B',start:'2026-09-21',end:'2026-09-23',progress:100,resourceId:'tractor-1',dependencies:['a']}
  ]);
  assert.equal(calculateProgress(tasks),75);
  assert.deepEqual(findResourceConflicts(tasks),[{resourceId:'tractor-1',firstTaskId:'a',secondTaskId:'b'}]);
});
