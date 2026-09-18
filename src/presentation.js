import { createFunctionalPresentation } from '../shared/packages/ui-shell/src/functional.js';
import { createEntityRepository } from '../shared/packages/vertical-persistence/src/repository.js';
import { createAgroShellModel } from './ui.js';
import { createCropRepositories } from './catalog.js';
import { scheduleFieldOperation, startFieldOperation, completeFieldOperation, cancelFieldOperation, createHarvestLot, cropYieldSummary } from './operations.js';
import { createCropExpense, createHarvestIncome, cropFinancialMetrics } from './finance.js';
import { createInventoryService } from './inventory.js';
import { createDocumentService } from './documents.js';
import { createSecurityService } from './security.js';

const rows = (records) => records.map((record) => record.payload);
const requireRecord = (record, label) => { if (!record) throw new Error(`${label} not found.`); return record; };

export function createAgroLavouraPresentation({ persistence, localRuntime = null, recovery = null, capabilities = [] } = {}) {
  if (!persistence?.putRecord) throw new TypeError('Persistence adapter is required.');
  const repos = createCropRepositories(persistence);
  const finance = createEntityRepository(persistence, { collection: 'agro-lavoura.finance' });
  const inventory = createInventoryService(persistence);
  const documents = createDocumentService(persistence);
  const security = createSecurityService(persistence);
  const shell = createAgroShellModel({ capabilities });

  async function mutateOperation(id, transform, input) {
    const current = requireRecord(await repos.operations.get(id), 'Field operation');
    return repos.operations.save(transform(current.payload, input), { expectedVersion: current.version });
  }

  const screens = {
    overview: {
      kind: 'dashboard',
      async load() {
        const [fields, seasons, operations, harvestLots, entries] = await Promise.all([
          repos.fields.list(), repos.seasons.list(), repos.operations.list(), repos.harvestLots.list(), finance.list()
        ]);
        const yieldSummary = cropYieldSummary(rows(harvestLots));
        const financial = cropFinancialMetrics(rows(entries), {});
        return Object.freeze({
          cards: Object.freeze({ fields: fields.length, seasons: seasons.length, completedOperations: rows(operations).filter((operation) => operation.status === 'completed').length, harvestQuantity: yieldSummary.quantity, resultMinor: financial.marginMinor }),
          yield: yieldSummary,
          financial
        });
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
      async load() { return { local: localRuntime ? await localRuntime.startup({ online: false }) : { mode: 'local-first', networkRequired: false }, backups: recovery ? await recovery.listBackups() : [] }; },
      actions: { backup: (input = {}) => { if (!recovery) throw new Error('Recovery service is not configured.'); return recovery.createBackup(input); }, restore: ({ id, ...options }) => { if (!recovery) throw new Error('Recovery service is not configured.'); return recovery.restoreBackup(id, options); } }
    }
  };

  return createFunctionalPresentation({ shell, screens, services: { security, localRuntime, recovery } });
}
