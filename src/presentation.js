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

const rows = (records) => records.map((record) => record.payload);
const requireRecord = (record, label) => { if (!record) throw new Error(`${label} not found.`); return record; };
export const PRODUCT_DEFAULT_SETTINGS=Object.freeze({
  'inventory.lowStockThreshold':10,
  'planning.lookAheadDays':30,
  'alerts.enabled':true,
  'reporting.csvDelimiter':','
});

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
  const shell = createAgroShellModel({ capabilities });

  eventBus.subscribe('agro.operations.schedule.completed',async event=>{
    if(await settings.get('alerts.enabled')===false)return;
    const input=event.payload?.input??{};
    if(!input.id||!input.scheduledAt)return;
    await alerts.upsert({id:`operation:${input.id}:scheduled`,entityRef:{kind:'operation',id:String(input.id)},title:`Operação programada: ${input.typeId??input.id}`,dueAt:input.scheduledAt,severity:'warning',metadata:{seasonId:input.seasonId??null,fieldId:input.fieldId??null,typeId:input.typeId??null,commandId:event.metadata?.commandId??null}});
  });
  const inventoryAlertHandler=async event=>{
    if(await settings.get('alerts.enabled')===false)return;
    const input=event.payload?.input??{};if(!input.sku)return;
    const threshold=Number(await settings.get('inventory.lowStockThreshold'));
    const available=await inventory.available(input.sku);
    if(!Number.isFinite(threshold)||available>=threshold)return;
    await alerts.upsert({id:`inventory:${input.sku}:low-stock`,entityRef:{kind:'inventory',id:String(input.sku)},title:`Estoque baixo: ${input.sku}`,dueAt:new Date().toISOString(),severity:'critical',metadata:{sku:String(input.sku),available,threshold,commandId:event.metadata?.commandId??null}});
  };
  eventBus.subscribe('agro.inventory.receive.completed',inventoryAlertHandler);
  eventBus.subscribe('agro.inventory.consume.completed',inventoryAlertHandler);

  async function mutateOperation(id, transform, input) {
    const current = requireRecord(await repos.operations.get(id), 'Field operation');
    return repos.operations.save(transform(current.payload, input), { expectedVersion: current.version });
  }

  const screens = {
    overview: {
      kind: 'dashboard',
      async load() {
        const [fields, seasons, operations, harvestLots, entries,alertItems] = await Promise.all([
          repos.fields.list(), repos.seasons.list(), repos.operations.list(), repos.harvestLots.list(), finance.list(),alerts.list()
        ]);
        const yieldSummary = cropYieldSummary(rows(harvestLots));
        const financial = cropFinancialMetrics(rows(entries), {});
        return Object.freeze({
          cards: Object.freeze({ fields: fields.length, seasons: seasons.length, completedOperations: rows(operations).filter((operation) => operation.status === 'completed').length, harvestQuantity: yieldSummary.quantity, resultMinor: financial.marginMinor, activeAlerts: alertItems.filter(item=>item.status!=='dismissed').length }),
          yield: yieldSummary,
          financial,
          alerts:Object.freeze(alertItems.filter(item=>item.status!=='dismissed'))
        });
      },
      actions:{
        acknowledgeAlert:({id},context={})=>alerts.acknowledge(id,{actorId:context.actorId??'system'}),
        snoozeAlert:({id,until})=>alerts.snooze(id,{until}),
        dismissAlert:({id,reason},context={})=>alerts.dismiss(id,{actorId:context.actorId??'system',reason})
      }
    },
    fields: { kind: 'table-form', load: async () => ({ rows: await repos.fields.list() }), actions: { save: (entity, options) => repos.fields.save(entity, options ?? {}), remove: ({ id, expectedVersion }) => repos.fields.remove(id, { expectedVersion }) } },
    seasons: { kind: 'table-form', load: async () => ({ rows: await repos.seasons.list() }), actions: { save: (entity, options) => repos.seasons.save(entity, options ?? {}) } },
    operations: {
      kind: 'workflow',
      load: async () => ({ rows: await repos.operations.list() }),
      actions: {
        schedule: (input) => repos.operations.save(scheduleFieldOperation(input), { expectedVersion: 0 }),
        start: ({ id, ...input }) => mutateOperation(id, startFieldOperation, input),
        complete: ({ id, ...input }) => mutateOperation(id, completeFieldOperation, input),
        cancel: ({ id, ...input }) => mutateOperation(id, cancelFieldOperation, input)
      }
    },
    inputs: { kind: 'table-form', load: async () => ({ rows: await repos.inputs.list() }), actions: { save: (entity, options) => repos.inputs.save(entity, options ?? {}) } },
    harvest: { kind: 'table-form', load: async () => ({ rows: await repos.harvestLots.list() }), actions: { create: (input) => repos.harvestLots.save(createHarvestLot(input), { expectedVersion: 0 }) } },
    inventory: { kind: 'inventory', load: async () => inventory.snapshot(), actions: { receive: (input) => inventory.apply({ ...input, kind: 'in' }), consume: (input) => inventory.apply({ ...input, kind: 'out' }) } },
    finance: { kind: 'finance', load: async () => ({ rows: await finance.list() }), actions: { addExpense: (input) => finance.save(createCropExpense(input), { expectedVersion: 0 }), addIncome: (input) => finance.save(createHarvestIncome(input), { expectedVersion: 0 }) } },
    reports: { kind: 'reports', load: async () => ({ definitions: documents.definitions, issued: await persistence.listRecords('issued-documents') }), actions: { csv: ({ type, rows }) => documents.buildCsv(type, rows), issue: (input) => documents.issue(input) } },
    settings: {
      kind: 'settings',
      async load() { return { local: localRuntime ? await localRuntime.startup({ online: false }) : { mode: 'local-first', networkRequired: false }, backups: recovery ? await recovery.listBackups() : [], configuration: await settings.snapshot() }; },
      actions: { backup: (input = {}) => { if (!recovery) throw new Error('Recovery service is not configured.'); return recovery.createBackup(input); }, restore: ({ id, ...options }) => { if (!recovery) throw new Error('Recovery service is not configured.'); return recovery.restoreBackup(id, options); } }
    }
  };

  return createFunctionalPresentation({ shell, screens, services: { security, localRuntime, recovery, persistence, eventBus, settings, alerts, repos, finance, inventory, documents } });
}
