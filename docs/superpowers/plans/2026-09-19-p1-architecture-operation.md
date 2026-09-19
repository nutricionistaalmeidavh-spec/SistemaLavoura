# P1 Arquitetura e Operação Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Integrar os 12 itens do P1 ao Sistema Lavoura mantendo P0, 10 telas, local-first e zero dependência paga obrigatória.

**Architecture:** Contratos genéricos ArtiSys ficam em snapshots locais pequenos, enquanto wrappers de produto usam `vertical-persistence`. O dispatcher de comandos registra eventos duráveis na mesma fronteira transacional e entrega handlers após commit. P1 enriquece as telas existentes com novos dados e ações sem criar navegação obrigatória.

**Tech Stack:** Node 22+, ESM, Electron, React/Vite, SQLite, IndexedDB/MemoryStorage, Node test runner, Playwright, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-09-19-p1-architecture-operation-design.md`

## Global Constraints

- Core obrigatório R$0/local-first/self-hosted.
- Sem serviço cloud ou pago obrigatório.
- Desktop e PWA continuam suportados.
- P0 continua verde e as 17 ações P0 não mudam de semântica.
- Utilidades fixado em `4a138a9d77775f5be1e43244b9d45ca8586742c5`.
- Mutação iniciada por usuário continua passando por RBAC, audit-log e comando.

## Review Focus

- Falha de subscriber do EventBus não pode perder evento nem bloquear comandos seguintes.
- Transição inválida de operação deve falhar sem gravação parcial.
- Importação inválida ou falha no meio deve deixar zero gravação parcial.
- Restore/restart não pode perder settings ou corromper alertas.
- Busca/exportação devem ser determinísticas com acentos, campos ausentes e strings contendo delimitadores.

---

### Task 1: Primitivas reutilizáveis P1

**Files:**
- Create: `shared/vendor/release-modules/artisys-workflow-engine/src/index.mjs`
- Create: `shared/vendor/release-modules/artisys-alerts/src/index.mjs`
- Create: `shared/vendor/release-modules/artisys-search/src/index.mjs`
- Create: `shared/vendor/release-modules/artisys-exporter/src/index.mjs`
- Create: `shared/vendor/release-modules/artisys-importer/src/index.mjs`
- Create: `shared/vendor/release-modules/artisys-reporting/src/index.mjs`
- Create: `shared/vendor/release-modules/artisys-planning/src/index.mjs`
- Create: `tests/p1-primitives.test.js`

**Interfaces:**
- Produces deterministic workflow, alert lifecycle, local search, import/export, reporting and planning contracts.
- No runtime dependencies.

- [ ] Write tests for allowed/forbidden workflow transitions, alert lifecycle, accent-insensitive search, CSV quoting, importer duplicate detection, reporting aggregates and planning conflicts.
- [ ] Verify tests fail while modules are absent.
- [ ] Add reviewed snapshots from `utilidades` at the pinned commit.
- [ ] Run `node --test tests/p1-primitives.test.js` and require zero failures.
- [ ] Commit `feat: add P1 reusable operation primitives`.

### Task 2: EventBus durável e Settings persistentes

**Files:**
- Create: `shared/packages/product-eventbus/src/index.js`
- Create: `shared/packages/product-settings/src/index.js`
- Modify: `runtime/commands.mjs`
- Modify: `src/presentation.js`
- Create: `tests/p1-platform-services.test.js`

**Interfaces:**
- `createProductEventBus(persistence,{namespace})` -> `{publish,subscribe,flush,list}`.
- `createProductSettings(persistence,{namespace,defaults})` -> `{get,set,delete,merge,snapshot}`.
- Command dispatcher emits `agro.<screen>.<action>.completed` with `commandId` after successful domain work.

- [ ] Write RED tests for durable outbox, retry after subscriber failure, settings persistence after reopen and command event creation.
- [ ] Implement persistence-backed outbox and subscriber registry.
- [ ] Implement namespaced settings repository.
- [ ] Wire event creation into transactional command flow and delivery after commit.
- [ ] Run platform-service tests and P0 command tests.
- [ ] Commit `feat: add durable eventbus and settings`.

### Task 3: Workflow, Inventory e Alerts agrícolas

**Files:**
- Modify: `src/operations.js`
- Create: `src/alerts.js`
- Modify: `src/inventory.js`
- Modify: `src/presentation.js`
- Modify: `src/security.js` only if an explicit action permission is required.
- Create: `tests/p1-operations-alerts.test.js`

**Interfaces:**
- `FIELD_OPERATION_WORKFLOW` controls operation states.
- `createCropAlertService(persistence,settings)` persists alert lifecycle.
- Event subscribers react to operation schedule and inventory movements.

- [ ] Write RED tests for invalid workflow transition, scheduled-operation alert, low-stock alert and alert acknowledge/snooze/dismiss.
- [ ] Replace duplicated state checks with workflow engine transitions while preserving existing object shape.
- [ ] Add persistent alert service and event handlers.
- [ ] Add inventory low-stock query based on settings.
- [ ] Expose alert actions on Overview and include alerts in dashboard load.
- [ ] Run new tests plus `tests/p0-product-qa.test.js`.
- [ ] Commit `feat: integrate workflows inventory thresholds and alerts`.

### Task 4: Planning, Reporting, Dashboard, Search e Finance Domain

**Files:**
- Create: `src/planning.js`
- Create: `src/reporting.js`
- Create: `src/search.js`
- Create: `src/dashboard.js`
- Modify: `shared/packages/domain-finance/src/index.js`
- Modify: `src/finance.js`
- Modify: `src/presentation.js`
- Create: `tests/p1-read-models.test.js`

**Interfaces:**
- `createPlanningService(repos)` validates/saves plans and returns progress/conflicts.
- `createReportingService()` returns summary/export-friendly read models.
- `createProductSearch(repos,finance)` builds index on demand.
- `buildDashboardSnapshot(...)` aggregates operational KPIs.
- `financialEntryFingerprint(entry)` is deterministic.

- [ ] Write RED tests for plan conflict/progress, grouped reporting, dashboard KPIs, accent-insensitive cross-entity search and stable finance fingerprint.
- [ ] Implement product services with no duplicate source-of-truth state.
- [ ] Add fingerprint to crop expense/income creation.
- [ ] Extend Overview/Operations/Reports load outputs and P1 actions.
- [ ] Run read-model tests and domain tests.
- [ ] Commit `feat: add P1 planning reporting dashboard search and finance insights`.

### Task 5: Importer e Exporter integrados

**Files:**
- Create: `src/data-exchange.js`
- Modify: `src/presentation.js`
- Create: `tests/p1-data-exchange.test.js`

**Interfaces:**
- `previewCropImport({target,rows,mapping})` supports `fields|inputs`.
- `applyCropImport(plan,{repos,persistence})` is atomic at command boundary.
- `exportCropRows(rows,{format,...options})` supports `csv|json|xlsx-model`.

- [ ] Write RED tests for invalid target, required-field failures, duplicates, rollback on second-row failure, CSV delimiter quoting and JSON determinism.
- [ ] Implement preview/apply using ArtiSys importer primitives and domain validators.
- [ ] Expose `settings.previewImport`, `settings.applyImport` and `reports.export`.
- [ ] Run data-exchange tests and P0 phase5.
- [ ] Commit `feat: integrate agricultural import and export`.

### Task 6: Product QA P1 e CI

**Files:**
- Create: `qa/p1-contract.json`
- Create: `tooling/qa-p1.mjs`
- Create: `tests/p1-product-qa.test.js`
- Modify: `tooling/qa-phase5.mjs`
- Modify: `package.json`
- Create: `.github/workflows/p1-architecture-operation.yml`

**Interfaces:**
- `npm run p1` executes P0 regression + P1 functional QA.
- P1 summary writes `qa-artifacts/p1-summary.json` with modules and action coverage.

- [ ] Define all P1 actions and capability checks in contract.
- [ ] Make Phase 5 require P0 actions as a subset rather than reject P1 additions.
- [ ] Exercise every P1 action against a real standalone host.
- [ ] Add Linux job for `npm run p1` + compatibility.
- [ ] Add Windows job for full `release:certify` plus `npm run qa:p1`.
- [ ] Upload QA artifacts and installer.
- [ ] Commit `test: certify P1 architecture and operation`.

### Task 7: Manifesto, dependências e status

**Files:**
- Modify: `vertical.manifest.json`
- Modify: `docs/DEPENDENCY_INVENTORY.md`
- Modify: `PRODUCT_STATUS.md`
- Create: `docs/P1_OPERATION.md`

**Interfaces:**
- Documentation names the exact pinned utilidades SHA and mandatory/embedded P1 capabilities.

- [ ] Mark implemented P1 modules and preserve P2 as future scope.
- [ ] Document no paid/core dependency and recovery semantics.
- [ ] Run full `npm run p1` on CI HEAD.
- [ ] Open PR against `main`.
- [ ] Require Linux and Windows green before merge.
- [ ] Merge only after fresh verification and run P1 workflow once again on `main`.
