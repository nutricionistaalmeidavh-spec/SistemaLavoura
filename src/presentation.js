import { createFunctionalPresentation } from '../shared/packages/ui-shell/src/functional.js';
import { createEntityRepository } from '../shared/packages/vertical-persistence/src/repository.js';
import { createProductEventBus } from '../shared/packages/product-eventbus/src/index.js';
import { createProductSettings } from '../shared/packages/product-settings/src/index.js';
import { createAgroShellModel } from './ui.js';
import { createCropRepositories } from './catalog.js';
import { scheduleFieldOperation, startFieldOperation, completeFieldOperation, cancelFieldOperation, createHarvestLot, cropYieldSummary } from './operations.js';
import { createCropExpense, createHarvestIncome, cropFinancialMetrics } from './finance.js';
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

const rows = records => records.map(record => record.payload);
const requireRecord = (record, label) => { if (!record) throw new Error(`${label} not found.`); return record; };
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
  const shell = createAgroShellModel({ capabilities });

  eventBus.subscribe('agro.operations.schedule.completed',async event=>{if(await settings.get('alerts.enabled')===false)return;const input=event.payload?.input??{};if(!input.id||!input.scheduledAt)return;await alerts.upsert({id:`operation:${input.id}:scheduled`,entityRef:{kind:'operation',id:String(input.id)},title:`Operação programada: ${input.typeId??input.id}`,dueAt:input.scheduledAt,severity:'warning',metadata:{seasonId:input.seasonId??null,fieldId:input.fieldId??null,typeId:input.typeId??null,commandId:event.metadata?.commandId??null}});});
  const inventoryAlertHandler=async event=>{if(await settings.get('alerts.enabled')===false)return;const input=event.payload?.input??{};if(!input.sku)return;const threshold=Number(await settings.get('inventory.lowStockThreshold'));const available=await inventory.available(input.sku);if(!Number.isFinite(threshold)||available>=threshold)return;await alerts.upsert({id:`inventory:${input.sku}:low-stock`,entityRef:{kind:'inventory',id:String(input.sku)},title:`Estoque baixo: ${input.sku}`,dueAt:new Date().toISOString(),severity:'critical',metadata:{sku:String(input.sku),available,threshold,commandId:event.metadata?.commandId??null}});};
  eventBus.subscribe('agro.inventory.receive.completed',inventoryAlertHandler);eventBus.subscribe('agro.inventory.consume.completed',inventoryAlertHandler);
  async function mutateOperation(id, transform, input) {const current=requireRecord(await repos.operations.get(id),'Field operation');return repos.operations.save(transform(current.payload,input),{expectedVersion:current.version});}
  async function ensureChecklistReady(operationId){if(await featureFlags.enabled('checklists.enforceBeforeOperationComplete')===false)return;const linked=await checklists.list({entityType:'operation',entityId:operationId});if(linked.length===0)throw new Error('A completed checklist is required before completing this operation.');if(linked.some(record=>record.payload.status!=='completed'))throw new Error('All required operation checklists must be completed first.');}

  const screens = {
    overview:{kind:'dashboard',async load(){const [fieldRecords,seasonRecords,operationRecords,harvestRecords,entryRecords,alertItems,inventoryState,planningState,threshold]=await Promise.all([repos.fields.list(),repos.seasons.list(),repos.operations.list(),repos.harvestLots.list(),finance.list(),alerts.list(),inventory.snapshot(),planning.snapshot(),settings.get('inventory.lowStockThreshold')]);const fields=rows(fieldRecords),seasons=rows(seasonRecords),operations=rows(operationRecords),harvestLots=rows(harvestRecords),entries=rows(entryRecords);const dashboard=await buildDashboardSnapshot({fields,seasons,operations,harvestLots,entries,alerts:alertItems,inventory:inventoryState,lowStockThreshold:threshold,planning:planningState});const yieldSummary=cropYieldSummary(harvestLots),financial=cropFinancialMetrics(entries,{});return Object.freeze({cards:Object.freeze({fields:fields.length,seasons:seasons.length,completedOperations:operations.filter(operation=>operation.status==='completed').length,harvestQuantity:yieldSummary.quantity,resultMinor:financial.marginMinor,activeAlerts:dashboard.alerts.active,lowStock:dashboard.inventory.lowStock,planningConflicts:dashboard.planning.conflicts}),yield:yieldSummary,financial,alerts:Object.freeze(alertItems.filter(item=>item.status!=='dismissed')),dashboard});},actions:{search:({query,limit=20,kind=null})=>search.query(query,{limit,kind}),acknowledgeAlert:({id},context={})=>alerts.acknowledge(id,{actorId:context.actorId??'system'}),snoozeAlert:({id,until})=>alerts.snooze(id,{until}),dismissAlert:({id,reason},context={})=>alerts.dismiss(id,{actorId:context.actorId??'system',reason}),capture:input=>capture.capture(input)}},
    fields:{kind:'table-form',async load(){return{rows:await repos.fields.list(),files:await files.list({entityType:'field'})};},actions:{save:(entity,options)=>repos.fields.save(entity,options??{}),remove:({id,expectedVersion})=>repos.fields.remove(id,{expectedVersion}),uploadFile:input=>files.upload({...input,entityType:'field'}),removeFile:({id})=>files.remove(id)}},
    seasons:{kind:'table-form',load:async()=>({rows:await repos.seasons.list()}),actions:{save:(entity,options)=>repos.seasons.save(entity,options??{})}},
    operations:{kind:'workflow',async load(){const [operationRows,planningState,checklistRows]=await Promise.all([repos.operations.list(),planning.snapshot(),checklists.list({entityType:'operation'})]);return{rows:operationRows,plans:planningState.plans,planningProgress:planningState.progress,planningConflicts:planningState.conflicts,calendar:planningState.calendar,gantt:planningState.gantt,checklists:checklistRows};},actions:{schedule:input=>repos.operations.save(scheduleFieldOperation(input),{expectedVersion:0}),start:({id,...input})=>mutateOperation(id,startFieldOperation,input),complete:async({id,...input})=>{await ensureChecklistReady(id);return mutateOperation(id,completeFieldOperation,input);},cancel:({id,...input})=>mutateOperation(id,cancelFieldOperation,input),savePlan:(input,options)=>planning.save(input,options??{}),createChecklist:input=>checklists.create({...input,entityType:'operation'}),setChecklistItem:({id,itemId,...input})=>checklists.setItem(id,itemId,input),completeChecklist:({id})=>checklists.complete(id)}},
    inputs:{kind:'table-form',load:async()=>({rows:await repos.inputs.list()}),actions:{save:(entity,options)=>repos.inputs.save(entity,options??{})}},
    harvest:{kind:'table-form',load:async()=>({rows:await repos.harvestLots.list()}),actions:{create:input=>repos.harvestLots.save(createHarvestLot(input),{expectedVersion:0})}},
    inventory:{kind:'inventory',load:async()=>inventory.snapshot(),actions:{receive:input=>inventory.apply({...input,kind:'in'}),consume:input=>inventory.apply({...input,kind:'out'})}},
    finance:{kind:'finance',load:async()=>({rows:await finance.list()}),actions:{addExpense:input=>finance.save(createCropExpense(input),{expectedVersion:0}),addIncome:input=>finance.save(createHarvestIncome(input),{expectedVersion:0})}},
    reports:{kind:'reports',load:async()=>({definitions:documents.definitions,issued:await persistence.listRecords('issued-documents')}),actions:{csv:({type,rows})=>documents.buildCsv(type,rows),issue:input=>documents.issue(input),summary:({rows,groupField,valueField,op})=>reporting.summary(rows,{groupField,valueField,op}),export:async({rows,format='csv',...options})=>reporting.export(rows,{format,delimiter:options.delimiter??await settings.get('reporting.csvDelimiter'),...options}),pdf:({type,title=null,rows=[]})=>pdf.build(type,{title,rows})}},
    settings:{kind:'settings',async load(){return{local:localRuntime?await localRuntime.startup({online:false}):{mode:'local-first',networkRequired:false},backups:recovery?await recovery.listBackups():[],configuration:await settings.snapshot(),featureFlags:await featureFlags.snapshot(),catalog:await agriculturalCatalog.list()};},actions:{backup:(input={})=>{if(!recovery)throw new Error('Recovery service is not configured.');return recovery.createBackup(input);},restore:({id,...options})=>{if(!recovery)throw new Error('Recovery service is not configured.');return recovery.restoreBackup(id,options);},set:({key,value})=>settings.set(key,value),merge:({values})=>settings.merge(values),previewImport:input=>previewCropImport(input),applyImport:({plan})=>applyCropImport(plan,{repos}),upsertCatalog:input=>agriculturalCatalog.upsert(input),setFeatureFlag:({key,value})=>featureFlags.set(key,value)}}
  };
  return createFunctionalPresentation({shell,screens,services:{security,localRuntime,recovery,persistence,eventBus,settings,alerts,repos,finance,inventory,documents,planning,reporting,search,featureFlags,files,capture,checklists,agriculturalCatalog,pdf}});
}