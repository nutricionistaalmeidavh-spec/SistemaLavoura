# ArtiSys Lavoura Fases 7 e 8 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar ensaio de cutover não destrutivo com banco legado real e certificação de release fail-closed para ArtiSys Lavoura.

**Architecture:** A Fase 7 copia o banco legado para sandbox, aplica o host standalone e verifica integridade lógica e hash do original. A Fase 8 orquestra evidências frescas do commit atual e só certifica quando QA, cutover, Playwright e instalador Windows passam.

**Tech Stack:** Node.js 22, `node:sqlite`, Electron, Vite, Playwright, electron-builder/NSIS.

**Spec:** `docs/superpowers/specs/2026-09-18-phases-7-8-design.md`

## Global Constraints

- `productId` deve permanecer `agro-lavoura`.
- banco deve permanecer `artisys-safras-talhoes.sqlite`.
- migration obrigatória deve permanecer `agro-lavoura/001-initial.sql`.
- banco legado original nunca pode ser aberto em modo de escrita pelo ensaio.
- evidências de F5, F7 e Playwright devem pertencer ao mesmo commit certificado.
- núcleo obrigatório continua R$0, self-hosted e open source.
- monorepo legado permanece rollback/reference.

---

### Task 1: Evidência vinculada ao commit

**Files:**
- Create: `tooling/evidence.mjs`
- Modify: `tooling/qa-phase5.mjs`
- Test: `tests/evidence.test.js`

**Interfaces:**
- Produces: `currentCommit(): Promise<string>` e `writeEvidence(path, payload): Promise<object>`.

- [ ] **Step 1: Write the failing test**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import {currentCommit} from '../tooling/evidence.mjs';

test('currentCommit returns a full git sha', async()=>{
  assert.match(await currentCommit(), /^[0-9a-f]{40}$/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/evidence.test.js`
Expected: FAIL because `tooling/evidence.mjs` does not exist.

- [ ] **Step 3: Write minimal implementation**

Use `process.execPath` with `process.env.npm_execpath` only for npm subprocesses; for Git use `execFile('git',['rev-parse','HEAD'])`. `writeEvidence` must add `{commit,generatedAt}` and write JSON atomically through a temporary file plus rename.

- [ ] **Step 4: Add commit to Phase 5 evidence**

Import `currentCommit` in `tooling/qa-phase5.mjs` and include the returned SHA in `phase5-summary.json` for both pass and fail paths.

- [ ] **Step 5: Run tests**

Run: `node --test tests/evidence.test.js && npm run phase5`
Expected: PASS and `qa-artifacts/phase5-summary.json` contains a 40-character `commit`.

- [ ] **Step 6: Commit**

```bash
git add tooling/evidence.mjs tooling/qa-phase5.mjs tests/evidence.test.js
git commit -m "test: bind qa evidence to current commit"
```

### Task 2: Snapshot lógico de SQLite

**Files:**
- Create: `tooling/sqlite-snapshot.mjs`
- Test: `tests/sqlite-snapshot.test.js`

**Interfaces:**
- Produces: `snapshotSqlite(path): {tables: Record<string,{rows:number,sha256:string}>}`.
- Produces: `assertLegacyTablesPreserved(before, after, ignoredTables)`.

- [ ] **Step 1: Write failing preservation test**

Create a temporary SQLite file with table `customer_data`, insert two rows, snapshot it, add a new migration table, snapshot again, and assert `customer_data` digest is unchanged.

- [ ] **Step 2: Run test and confirm RED**

Run: `node --test tests/sqlite-snapshot.test.js`
Expected: FAIL because snapshot helpers do not exist.

- [ ] **Step 3: Implement deterministic snapshot**

Use `DatabaseSync`; list tables from `sqlite_master`, inspect columns with `PRAGMA table_info`, serialize rows deterministically, encode binary values as hex, hash each table with SHA-256, and close the database in `finally`.

- [ ] **Step 4: Implement preservation assertion**

For every table present in `before`, require same row count and digest in `after` except explicitly ignored internal tables: `__artisys_migrations`, `__artisys_record_history` and `__artisys_records` only when the test documents why that table is intentionally mutated and restored before final comparison.

- [ ] **Step 5: Run test GREEN**

Run: `node --test tests/sqlite-snapshot.test.js`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add tooling/sqlite-snapshot.mjs tests/sqlite-snapshot.test.js
git commit -m "test: add deterministic legacy database snapshot"
```

### Task 3: Fase 7 — ensaio de cutover

**Files:**
- Create: `tooling/phase7-cutover.mjs`
- Test: `tests/phase7-cutover.test.js`
- Modify: `runtime/host.mjs` only if `schemaState` is not exposed through `host.persistence`.

**Interfaces:**
- Consumes: `ARTISYS_LEGACY_DB`.
- Produces: `qa-artifacts/phase7-summary.json`.

- [ ] **Step 1: Write failing no-source test**

Test that invoking the phase without `ARTISYS_LEGACY_DB` exits nonzero and prints `ARTISYS_LEGACY_DB is required`.

- [ ] **Step 2: Write failing non-destructive cutover test**

Create a temporary legacy-compatible database named `artisys-safras-talhoes.sqlite`, hash it, run the cutover tool against it, then assert original hash is unchanged and summary status is `passed`.

- [ ] **Step 3: Run both tests RED**

Run: `node --test tests/phase7-cutover.test.js`
Expected: FAIL because phase7 tool is missing.

- [ ] **Step 4: Implement sandbox cutover**

Algorithm: validate source path → hash original → snapshot original → copy to temp directory with exact database filename → open `createStandaloneHost({dataDir: tempDir})` → validate product and migrations → close → snapshot upgraded copy → backup → write `qa.cutover/sentinel` → close/reopen → assert sentinel → restore backup → assert sentinel absent → close → snapshot final copy → compare all preexisting legacy tables → hash original again → require same hash → write evidence with current commit.

- [ ] **Step 5: Verify migrations**

Require `schemaState().migrations` to contain `agro-lavoura/001-initial.sql`; if `schemaState` is not currently exposed by the host adapter, expose it as a straight proxy to the underlying persistence implementation.

- [ ] **Step 6: Run tests GREEN**

Run: `node --test tests/phase7-cutover.test.js`
Expected: PASS, source database hash unchanged.

- [ ] **Step 7: Commit**

```bash
git add tooling/phase7-cutover.mjs tests/phase7-cutover.test.js runtime/host.mjs
git commit -m "test: add non destructive legacy cutover rehearsal"
```

### Task 4: Playwright evidence wrapper

**Files:**
- Create: `tooling/qa-web.mjs`
- Modify: `package.json`
- Test: `tests/qa-web-evidence.test.js`

**Interfaces:**
- Produces: `qa-artifacts/playwright-summary.json` with `{status,commit,exitCode,startedAt,finishedAt}`.

- [ ] **Step 1: Write failing evidence-format test**

Test a helper exported from `qa-web.mjs` that builds summary payloads and requires a Git SHA plus exit code.

- [ ] **Step 2: Run RED**

Run: `node --test tests/qa-web-evidence.test.js`
Expected: FAIL because wrapper is missing.

- [ ] **Step 3: Implement wrapper**

Spawn `npm run qa:web:raw` using `process.execPath` plus `process.env.npm_execpath`, inherit stdio, capture exit code, and always write evidence with current commit.

- [ ] **Step 4: Split package scripts**

Set `qa:web:raw` to `playwright test` and `qa:web` to `node tooling/qa-web.mjs`.

- [ ] **Step 5: Run GREEN**

Run: `node --test tests/qa-web-evidence.test.js`
Then: `npm run qa:web`
Expected: wrapper evidence exists and exit code matches Playwright.

- [ ] **Step 6: Commit**

```bash
git add tooling/qa-web.mjs tests/qa-web-evidence.test.js package.json
git commit -m "test: persist playwright release evidence"
```

### Task 5: Fase 8 — certificador fail-closed

**Files:**
- Create: `tooling/certify-release.mjs`
- Test: `tests/certify-release.test.js`
- Modify: `package.json`

**Interfaces:**
- Consumes: F5, F7 and Playwright summaries plus `release/ArtiSys-Lavoura-Setup-*.exe`.
- Produces: `qa-artifacts/release-certification.json`.

- [ ] **Step 1: Write stale-evidence failing test**

Build synthetic evidence where F5 commit differs from current commit and assert certification rejects it.

- [ ] **Step 2: Write missing-installer failing test**

Use matching evidence files with no installer and assert rejection.

- [ ] **Step 3: Run RED**

Run: `node --test tests/certify-release.test.js`
Expected: FAIL because certifier is missing.

- [ ] **Step 4: Implement certifier**

Require all evidence statuses `passed`, require each evidence commit equals `git rev-parse HEAD`, locate newest `ArtiSys-Lavoura-Setup-*.exe`, require size > 1 MiB, compute SHA-256 of installer, and write certification JSON only after all assertions pass.

- [ ] **Step 5: Add release orchestration scripts**

Package scripts:
```json
{
  "phase7": "node tooling/phase7-cutover.mjs",
  "phase8:certify": "node tooling/certify-release.mjs",
  "release:certify": "npm run phase5 && npm run phase7 && npm run qa:web && npm run check && npm run build:win && npm run phase8:certify"
}
```

- [ ] **Step 6: Run GREEN**

Run: `node --test tests/certify-release.test.js`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add tooling/certify-release.mjs tests/certify-release.test.js package.json
git commit -m "feat: add fail closed standalone release certification"
```

### Task 6: Final verification and documentation

**Files:**
- Modify: `PRODUCT_STATUS.md`
- Create: `docs/PHASES_7_8.md`
- Modify: `.woodpecker/verify.yml`

**Interfaces:**
- Produces documented commands for local Windows certification and CI-safe non-release QA.

- [ ] **Step 1: Update Woodpecker**

Keep CI non-destructive: `npm install --no-audit --no-fund`, `npm run check`, `npm run phase5`, and `npm run qa:web`. Do not run Phase 7 in CI because it requires a real customer legacy database path.

- [ ] **Step 2: Document Windows certification**

Document exact command:
```powershell
$env:ARTISYS_LEGACY_DB="C:\caminho\artisys-safras-talhoes.sqlite"; npm run release:certify
```

- [ ] **Step 3: Run full fresh verification**

Run:
```powershell
npm install --no-audit --no-fund
npx playwright install chromium
npm run check
npm run phase5
$env:ARTISYS_LEGACY_DB="C:\caminho\artisys-safras-talhoes.sqlite"; npm run phase7
npm run qa:web
npm run build:win
npm run phase8:certify
```
Expected: every command exits 0 and certification status is `passed`.

- [ ] **Step 4: Confirm rollback remains intact**

Verify no files were removed from `SistemasNichadosAgroFrota` as part of this plan.

- [ ] **Step 5: Commit docs only after fresh verification**

```bash
git add PRODUCT_STATUS.md docs/PHASES_7_8.md .woodpecker/verify.yml
git commit -m "docs: record standalone release certification gate"
```
