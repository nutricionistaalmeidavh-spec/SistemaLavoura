import { createFunctionalPresentation } from '../shared/packages/ui-shell/src/functional.js';
import { createEntityRepository } from '../shared/packages/vertical-persistence/src/repository.js';
import { createProductEventBus } from '../shared/packages/product-eventbus/src/index.js';
import { createProductSettings } from '../shared/packages/product-settings/src/index.js';
import { createAgroShellModel } from './ui.js';
import { createCropRepositories,createFarmUnit,createFarmArea,createCropVariety,createFieldOperationType,createField } from './catalog.js';
import { scheduleFieldOperation, startFieldOperation, cancelFieldOperation, createHarvestLot, cropYieldSummary } from './operations.js';
import { createCropExpense, createHarvestIncome, cropFinancialMetrics, agriculturalCostSummary } from './finance.js';
import { createInventoryService } from './inventory.js';
import { createDocumentService } from './documents.js';
import { createSecurityService } from './security.js';
import { createCropAlertService } from './alerts.js';
import { createPlanningService } from './planning.js';
import { createReportingService } from './reporting.js';
import { createProductSearch } from './search.js';
import { buildDashboardSnapshot } from './dashboard.js';
import { previewCropImport, applyCropImport } from './data-exchange.js';
import { createFeatureFlags } from './feature-flags.js';
import { createFileService } from './files.js';
import { createCaptureService } from './capture.js';
import { createChecklistService } from './checklists.js';
import { createAgriculturalCatalog } from './agricultural-catalog.js';
import { createAgriculturalPdfService } from './product-pdf.js';
import { createAgriculturalWorkflow } from './agricultural-workflow.js';

const rows = records => records.map(record => record.payload);
const requireRecord = (record, label) => { if (!record) throw new Error(`${label} not found.`); return record; };
const fold=value=>String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLocaleLowerCase('pt-BR');
const idFor=(prefix,value)=>typeof value==='string'&&value.trim()?value.trim():(globalThis.crypto?.randomUUID?.()??`${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`);
const toMinor=value=>value==null||value===''?null:Math.round(Number(value)*100);
const option=(value,label)=>Object.freeze({value:String(value),label:String(label)});
export const PRODUCT_DEFAULT_SETTINGS=Object.freeze({'inventory.lowStockThreshold':10,'planning.lookAheadDays':30,'alerts.enabled':true,'reporting.csvDelimiter':','});

export function createAgroLavouraPresentation({ persistence, localRuntime = null, recovery = null, capabilities = [] } = {}) {
  if (!persistence?.putRecord) throw new TypeError('Persistence adapter is required.');
  const repos = createCropRepositories(persistence);
  const finance = createEntityRepository(persistence, { collection: 'agro-lavoura.finance' });
  const inventory = createInventoryService(persistence);
  const documents = createDocumentService(persistence);
  const security = createSecurityService(persistence);
  const eventBus = createProductEventBus(persistence,{namespace:'agro-lavoura'});
  const settings = createProductSettings(persistence,{namespace:'agro-lavoura',defaults:PRODUCT_DEFAULT_SETTINGS});
  const alerts = createCropAlertService(persistence,{namespace:'agro-lavoura'});
  const planning = createPlanningService(repos);
  const reporting = createReportingService();
  const search = createProductSearch({repos,finance});
  const featureFlags=createFeatureFlags(persistence);
  const files=createFileService(persistence,{flags:featureFlags});
  const capture=createCaptureService({persistence,files,flags:featureFlags});
  const checklists=createChecklistService(persistence,{flags:featureFlags});
  const agriculturalCatalog=createAgriculturalCatalog(persistence,{flags:featureFlags});
  const pdf=createAgriculturalPdfService({documents,flags:featureFlags});
  const agriculturalWorkflow=createAgriculturalWorkflow({repos,inventory,finance});
  const shell = createAgroShellModel({ capabilities });

  const findByName=async(repo,name)=>rows(await repo.list()).find(item=>fold(item.name)===fold(name))??null;
  async function resolveFarm({farmUnitId=null,farmUnitName=null}={}){
    if(farmUnitId)return farmUnitId;
    if(!farmUnitName)throw new TypeError('Fazenda is required.');
    const existing=await findByName(repos.farmUnits,farmUnitName);if(existing)return existing.id;
    const created=await repos.farmUnits.save(createFarmUnit({name:farmUnitName}),{expectedVersion:0});return created.payload.id;
  }
  async function resolveArea({areaGroupId=null,areaName=null,farmUnitId}={}){
    if(areaGroupId)return areaGroupId;if(!areaName)return null;
    const existing=rows(await repos.farmAreas.list()).find(item=>item.farmUnitId===farmUnitId&&fold(item.name)===fold(areaName));if(existing)return existing.id;
    const created=await repos.farmAreas.save(createFarmArea({farmUnitId,name:areaName}),{expectedVersion:0});return created.payload.id;
  }
  async function resolveVariety({varietyId=null,varietyName=null,crop,cycleDays=null}={}){
    if(varietyId)return varietyId;if(!varietyName)return null;
    const existing=rows(await repos.varieties.list()).find(item=>fold(item.crop)===fold(crop)&&fold(item.name)===fold(varietyName));if(existing)return existing.id;
    const created=await repos.varieties.save(createCropVariety({crop,name:varietyName,cycleDays}),{expectedVersion:0});return created.payload.id;
  }
  async function resolveOperationType({typeId=null,typeName=null}={}){
    if(typeId)return typeId;if(!typeName)throw new TypeError('Tipo de operação is required.');
    const existing=await findByName(repos.operationTypes,typeName);if(existing)return existing.id;
    const created=await repos.operationTypes.save(createFieldOperationType({name:typeName}),{expectedVersion:0});return created.payload.id;
  }
  async function referenceData(){
    const [farmUnits,farmAreas,fields,seasons,inputs,operationTypes]=await Promise.all([repos.farmUnits.list(),repos.farmAreas.list(),repos.fields.list(),repos.seasons.list(),repos.inputs.list(),repos.operationTypes.list()]);
    const farmRows=rows(farmUnits),areaRows=rows(farmAreas),fieldRows=rows(fields),seasonRows=rows(seasons),inputRows=rows(inputs),typeRows=rows(operationTypes);
    const farmById=new Map(farmRows.map(item=>[item.id,item]));
    const areaById=new Map(areaRows.map(item=>[item.id,item]));
    return Object.freeze({
      farmUnitOptions:Object.freeze(farmRows.map(item=>option(item.id,item.name))),
      areaOptions:Object.freeze(areaRows.map(item=>option(item.id,`${farmById.get(item.farmUnitId)?.name??'Fazenda'} · ${item.name}`))),
      fieldOptions:Object.freeze(fieldRows.map(item=>option(item.id,`${farmById.get(item.farmUnitId)?.name??'Fazenda'} > ${areaById.get(item.areaGroupId)?.name?`${areaById.get(item.areaGroupId).name} > `:''}${item.name} — ${Number(item.areaHa).toLocaleString('pt-BR')} ha`))),
      seasonOptions:Object.freeze(seasonRows.map(item=>option(item.id,`${item.crop} ${item.periodName??item.productionPeriodId}${item.varietyName?` · ${item.varietyName}`:''}`))),
      inputOptions:Object.freeze(inputRows.map(item=>option(item.id,`${item.name} (${item.unit})`))),
      operationTypeOptions:Object.freeze(typeRows.map(item=>option(item.id,item.name)))
    });
  }

  eventBus.subscribe('agro.operations.schedule.completed',async event=>{if(await settings.get('alerts.enabled')===false)return;const input=event.payload?.input??{},operationId=event.payload?.entityId??input.id;if(!operationId||!input.scheduledAt)return;await alerts.upsert({id:`operation:${operationId}:scheduled`,entityRef:{kind:'operation',id:String(operationId)},title:`Operação programada: ${input.typeName??input.typeId??operationId}`,dueAt:input.scheduledAt,severity:'warning',metadata:{seasonId:input.seasonId??null,fieldId:input.fieldId??null,typeId:input.typeId??null,commandId:event.metadata?.commandId??null}});});
  const inventoryAlertHandler=async event=>{if(await settings.get('alerts.enabled')===false)return;const input=event.payload?.input??{};if(!input.sku)return;const threshold=Number(await settings.get('inventory.lowStockThreshold'));const available=await inventory.available(input.sku);if(!Number.isFinite(threshold)||available>=threshold)return;await alerts.upsert({id:`inventory:${input.sku}:low-stock`,entityRef:{kind:'inventory',id:String(input.sku)},title:`Estoque baixo: ${input.sku}`,dueAt:new Date().toISOString(),severity:'critical',metadata:{sku:String(input.sku),available,threshold,commandId:event.metadata?.commandId??null}});};
  eventBus.subscribe('agro.inventory.receive.completed',inventoryAlertHandler);eventBus.subscribe('agro.inventory.consume.completed',inventoryAlertHandler);
  async function mutateOperation(id, transform, input) {const current=requireRecord(await repos.operations.get(id),'Field operation');return repos.operations.save(transform(current.payload,input),{expectedVersion:current.version});}
  async function ensureChecklistReady(operationId){if(await featureFlags.enabled('checklists.enforceBeforeOperationComplete')===false)return;const linked=await checklists.list({entityType:'operation',entityId:operationId});if(linked.length===0)throw new Error('A completed checklist is required before completing this operation.');if(linked.some(record=>record.payload.status!=='completed'))throw new Error('All required operation checklists must be completed first.');}
  async function saveField(entity,options={}){
    const id=idFor('field',entity.id);
    const validationFarmUnitId=entity.farmUnitId??(entity.farmUnitName?'__pending-farm__':null);
    createField({...entity,id,farmUnitId:validationFarmUnitId,areaGroupId:entity.areaGroupId??null});
    const farmUnitId=await resolveFarm(entity),areaGroupId=await resolveArea({...entity,farmUnitId});
    return repos.fields.save({...entity,id,farmUnitId,areaGroupId},{...options,expectedVersion:options.expectedVersion});
  }
  async function saveSeason(entity,options={}){const id=idFor('season',entity.id),varietyId=await resolveVariety(entity),budgetMinor=entity.budgetMinor??toMinor(entity.budget);return repos.seasons.save({...entity,id,productionPeriodId:entity.productionPeriodId??entity.periodName,varietyId,budgetMinor},{...options,expectedVersion:options.expectedVersion});}
  async function saveInput(entity,options={}){const id=idFor('input',entity.id),unitCostMinor=entity.unitCostMinor??toMinor(entity.unitCost);return repos.inputs.save({...entity,id,unitCostMinor},{...options,expectedVersion:options.expectedVersion});}
  async function scheduleOperation(input){const typeId=await resolveOperationType(input);return repos.operations.save(scheduleFieldOperation({...input,id:idFor('operation',input.id),typeId}),{expectedVersion:0});}
  const movementInput=(input,kind)=>({...input,id:idFor('movement',input.id),kind});
  const financeInput=(input,direction)=>({...input,id:idFor(direction,input.id),amountMinor:input.amountMinor??toMinor(input.amount)});

  const screens = {
    overview:{kind:'dashboard',async load(){const [fieldRecords,seasonRecords,operationRecords,harvestRecords,entryRecords,alertItems,inventoryState,planningState,threshold]=await Promise.all([repos.fields.list(),repos.seasons.list(),repos.operations.list(),repos.harvestLots.list(),finance.list(),alerts.list(),inventory.snapshot(),planning.snapshot(),settings.get('inventory.lowStockThreshold')]);const fields=rows(fieldRecords),seasons=rows(seasonRecords),operations=rows(operationRecords),harvestLots=rows(harvestRecords),entries=rows(entryRecords);const dashboard=await buildDashboardSnapshot({fields,seasons,operations,harvestLots,entries,alerts:alertItems,inventory:inventoryState,lowStockThreshold:threshold,planning:planningState});const yieldSummary=cropYieldSummary(harvestLots),financial=cropFinancialMetrics(entries,{}),costs=agriculturalCostSummary(entries,{fields});return Object.freeze({cards:Object.freeze({fields:fields.length,seasons:seasons.length,completedOperations:operations.filter(operation=>operation.status==='completed').length,harvestQuantity:yieldSummary.quantity,resultMinor:financial.marginMinor,activeAlerts:dashboard.alerts.active,lowStock:dashboard.inventory.lowStock,planningConflicts:dashboard.planning.conflicts}),yield:yieldSummary,financial,costs,alerts:Object.freeze(alertItems.filter(item=>item.status!=='dismissed')),dashboard});},actions:{search:({query,limit=20,kind=null})=>search.query(query,{limit,kind}),acknowledgeAlert:({id},context={})=>alerts.acknowledge(id,{actorId:context.actorId??'system'}),snoozeAlert:({id,until})=>alerts.snooze(id,{until}),dismissAlert:({id,reason},context={})=>alerts.dismiss(id,{actorId:context.actorId??'system',reason}),capture:input=>capture.capture(input)}},
    fields:{kind:'table-form',async load(){return{rows:await repos.fields.list(),files:await files.list({entityType:'field'}),references:await referenceData()};},actions:{save:saveField,remove:({id,expectedVersion})=>repos.fields.remove(id,{expectedVersion}),uploadFile:input=>files.upload({...input,entityType:'field'}),removeFile:({id})=>files.remove(id)}},
    seasons:{kind:'table-form',async load(){return{rows:await repos.seasons.list(),references:await referenceData()};},actions:{save:saveSeason}},
    operations:{kind:'workflow',async load(){const [operationRows,planningState,checklistRows,notebookRows,entryRecords,fieldRecords,references]=await Promise.all([repos.operations.list(),planning.snapshot(),checklists.list({entityType:'operation'}),repos.fieldNotebook.list(),finance.list(),repos.fields.list(),referenceData()]);return{rows:operationRows,plans:planningState.plans,planningProgress:planningState.progress,planningConflicts:planningState.conflicts,calendar:planningState.calendar,gantt:planningState.gantt,checklists:checklistRows,notebook:notebookRows,costs:agriculturalCostSummary(rows(entryRecords),{fields:rows(fieldRecords)}),references};},actions:{schedule:scheduleOperation,start:({id,...input})=>mutateOperation(id,startFieldOperation,input),complete:async({id,...input})=>{await ensureChecklistReady(id);const result=await agriculturalWorkflow.completeOperation(id,input);return Object.freeze({...result.record,effects:result.effects});},cancel:({id,...input})=>mutateOperation(id,cancelFieldOperation,input),savePlan:(input,options)=>planning.save({...input,id:idFor('plan',input.id)},options??{}),createChecklist:input=>checklists.create({...input,id:idFor('checklist',input.id),entityType:'operation'}),setChecklistItem:({id,itemId,...input})=>checklists.setItem(id,itemId,input),completeChecklist:({id})=>checklists.complete(id)}},
    inputs:{kind:'table-form',async load(){return{rows:await repos.inputs.list(),references:await referenceData()};},actions:{save:saveInput}},
    harvest:{kind:'table-form',async load(){return{rows:await repos.harvestLots.list(),references:await referenceData()};},actions:{create:input=>repos.harvestLots.save(createHarvestLot({...input,id:idFor('harvest',input.id)}),{expectedVersion:0})}},
    inventory:{kind:'inventory',async load(){return{...await inventory.snapshot(),references:await referenceData()};},actions:{receive:input=>inventory.apply(movementInput(input,'in')),consume:input=>inventory.apply(movementInput(input,'out'))}},
    finance:{kind:'finance',async load(){return{rows:await finance.list(),references:await referenceData()};},actions:{addExpense:input=>finance.save(createCropExpense(financeInput(input,'expense')),{expectedVersion:0}),addIncome:input=>finance.save(createHarvestIncome(financeInput(input,'income')),{expectedVersion:0})}},
    reports:{kind:'reports',load:async()=>({definitions:documents.definitions,issued:await persistence.listRecords('issued-documents')}),actions:{csv:({type,rows})=>documents.buildCsv(type,rows),issue:input=>documents.issue(input),summary:({rows,groupField,valueField,op})=>reporting.summary(rows,{groupField,valueField,op}),export:async({rows,format='csv',...options})=>reporting.export(rows,{format,delimiter:options.delimiter??await settings.get('reporting.csvDelimiter'),...options}),pdf:({type,title=null,rows=[]})=>pdf.build(type,{title,rows})}},
    settings:{kind:'settings',async load(){return{local:localRuntime?await localRuntime.startup({online:false}):{mode:'local-first',networkRequired:false},backups:recovery?await recovery.listBackups():[],configuration:await settings.snapshot(),featureFlags:await featureFlags.snapshot(),catalog:await agriculturalCatalog.list()};},actions:{backup:(input={})=>{if(!recovery)throw new Error('Recovery service is not configured.');return recovery.createBackup(input);},restore:({id,...options})=>{if(!recovery)throw new Error('Recovery service is not configured.');return recovery.restoreBackup(id,options);},set:({key,value})=>settings.set(key,value),merge:({values})=>settings.merge(values),previewImport:input=>previewCropImport(input),applyImport:({plan})=>applyCropImport(plan,{repos}),upsertCatalog:input=>agriculturalCatalog.upsert(input),setFeatureFlag:({key,value})=>featureFlags.set(key,value)}}
  };
  return createFunctionalPresentation({shell,screens,services:{security,localRuntime,recovery,persistence,eventBus,settings,alerts,repos,finance,inventory,documents,planning,reporting,search,featureFlags,files,capture,checklists,agriculturalCatalog,pdf,agriculturalWorkflow}});
}
