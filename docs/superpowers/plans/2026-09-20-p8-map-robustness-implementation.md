# P8 Map Robustness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Harden the existing offline-map/GIS stack so interrupted installs, corrupt packages, low disk, malformed geometry, cross-state farms, and large datasets fail safely without breaking P0-P7 or adding a mandatory paid/cloud dependency.

**Architecture:** Extend the current `map-package-manager`, planner, GIS domain, agricultural read model, and offline-map UI in place. Filesystem package replacement becomes journaled/recoverable, installed packages gain local integrity metadata and health states, GIS boundaries gain strict topology checks, and agricultural-map relationship lookups become indexed rather than repeatedly filtered. P8 remains additive: field data and PWA mode continue working even when no basemap is installed.

**Tech Stack:** Node.js 22 ESM, Electron 44, React 19, local filesystem/SQLite architecture already present, PMTiles CLI v1.31.2, Playwright 1.55, GitHub Actions Windows/Linux.

**Spec:** `docs/superpowers/specs/2026-09-20-p8-map-robustness-design.md`

## Global Constraints

- Mandatory core remains local-first and R$0 to operate.
- No paid API, ArtiSys server, mandatory account, or new cloud dependency.
- Existing P0-P7 behavior and screen/action contracts remain compatible.
- Installed map failures must never mutate agricultural domain data.
- A new/updated PMTiles file is never promoted before `pmtiles verify` succeeds.
- Existing pre-P8 map metadata remains readable and is reported `unverified` until explicit verification.
- Existing invalid legacy field geometry is surfaced, never silently rewritten.
- No SQLite migration is required for P8 map-package transaction/integrity state.
- Node runtime floor remains `>=22`.
- Windows automatic PMTiles extraction remains Windows x64 desktop only.
- P6/P7 Playwright process isolation must be preserved.

## Review Focus

1. **Damaged metadata JSON with an intact PMTiles file:** snapshot must surface an integrity/recovery state without deleting the file; Task 3 pins this case.
2. **Backup exists but the transaction journal is incomplete or malformed:** reconciliation must not discard both candidates; Task 2 pins recovery precedence.
3. **Farm bounds touch state-package boundaries exactly:** full-coverage logic must accept boundary contact only when the full rectangle remains covered; Task 4 pins edge-inclusive coverage.
4. **Polygon with repeated vertices/collinear segments:** strict topology must reject truly degenerate/self-crossing rings without rejecting a valid ring solely for redundant collinear points; Task 5 pins both cases.
5. **PWA/mobile with no desktop provider after P8 UI changes:** field mode remains usable and offline-map controls remain non-destructive/disabled; Task 6 and Task 7 pin this fallback.

---

### Task 1: Stable map-package errors and strict catalog refresh

**Files:**
- Modify: `runtime/map-package-manager.mjs`
- Test: `tests/p8-map-robustness.test.js`
- Extend: `tests/map-package-manager.test.js`

**Interfaces:**
- Produces: `MapPackageError extends Error` with `{code, retryable, cause}`.
- Produces: `normalizeMapPackageError(error, fallbackCode)` returning `MapPackageError`.
- Reuses: `validateMapManifest(input)` from `src/map-package-planner.js`.
- `refreshCatalog(url?)` must preserve the previous cached/on-disk valid catalog when the remote fetch/validation fails.

- [ ] **Step 1: Write the failing error-model tests**

Add to `tests/p8-map-robustness.test.js`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import {MapPackageError,normalizeMapPackageError} from '../runtime/map-package-manager.mjs';

test('P8 normalizes disk, network and verification errors into stable map codes',()=>{
  const disk=normalizeMapPackageError(Object.assign(new Error('no space'),{code:'ENOSPC'}),'MAP_EXTRACT_FAILED');
  assert.ok(disk instanceof MapPackageError);
  assert.equal(disk.code,'MAP_DISK_FULL');
  assert.equal(disk.retryable,true);
  const verify=normalizeMapPackageError(new Error('verify failed'),'MAP_VERIFY_FAILED');
  assert.equal(verify.code,'MAP_VERIFY_FAILED');
});
```

Add a catalog-preservation test using a temp `dataDir`: first return one valid manifest, call `refreshCatalog()`, then return malformed JSON/manifest and assert rejection code `MAP_CATALOG_INVALID`; a new manager over the same `dataDir` must still expose the prior `catalogVersion` in `snapshot()`.

- [ ] **Step 2: Run the RED tests**

Run:

```bash
node --test tests/p8-map-robustness.test.js tests/map-package-manager.test.js
```

Expected: FAIL because `MapPackageError`/`normalizeMapPackageError` do not exist and `refreshCatalog()` still accepts only shallow shape validation.

- [ ] **Step 3: Implement the stable error boundary**

In `runtime/map-package-manager.mjs`, import `validateMapManifest` and add:

```js
export class MapPackageError extends Error {
  constructor(code,message,{retryable=false,cause=null}={}){
    super(message,{cause});
    this.name='MapPackageError';
    this.code=code;
    this.retryable=Boolean(retryable);
  }
}

export function normalizeMapPackageError(error,fallbackCode='MAP_RECOVERY_FAILED'){
  if(error instanceof MapPackageError)return error;
  if(error?.code==='ENOSPC')return new MapPackageError('MAP_DISK_FULL','Espaço em disco insuficiente para concluir o mapa.',{retryable:true,cause:error});
  return new MapPackageError(fallbackCode,error?.message||'Falha no gerenciamento do mapa.',{retryable:['MAP_CATALOG_UNAVAILABLE','MAP_SOURCE_UNAVAILABLE','MAP_EXTRACT_FAILED'].includes(fallbackCode),cause:error});
}
```

Wrap network/catalog boundaries with codes:

```js
async function refreshCatalog(url=DEFAULT_MANIFEST_URL){
  await init();
  let response;
  try{response=await fetchImpl(url,{redirect:'follow'});}catch(error){throw normalizeMapPackageError(error,'MAP_CATALOG_UNAVAILABLE');}
  if(!response.ok)throw new MapPackageError('MAP_CATALOG_UNAVAILABLE',`Catálogo de mapas indisponível (${response.status}).`,{retryable:true});
  let value;
  try{value=validateMapManifest(await response.json());}catch(error){throw new MapPackageError('MAP_CATALOG_INVALID','O catálogo de mapas recebido é inválido.',{cause:error});}
  catalogCache=value;
  await atomicJson(catalogPath,value);
  return value;
}
```

Do not overwrite `catalogPath` until semantic validation passes.

- [ ] **Step 4: Run tests GREEN**

Run:

```bash
node --test tests/p8-map-robustness.test.js tests/map-package-manager.test.js
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add runtime/map-package-manager.mjs tests/p8-map-robustness.test.js tests/map-package-manager.test.js
git commit -m "feat: add stable P8 map errors and catalog validation"
```

---

### Task 2: Journaled package promotion and startup reconciliation

**Files:**
- Modify: `runtime/map-package-manager.mjs`
- Test: `tests/p8-map-robustness.test.js`
- Extend: `tests/map-package-manager.test.js`

**Interfaces:**
- Produces internal journal path: `<packages>/<packageId>.transaction.json`.
- Produces internal `reconcilePackages()` called by `init()` before listing/snapshot use.
- Journal shape: `{version:1,id,finalFile,backupFile,tempFile,metadataFile,stage,startedAt}`.
- Promotion stages are exactly: `verified-temp`, `backup-created`, `final-promoted`, `metadata-written`.

- [ ] **Step 1: Write interrupted-update and stale-temp tests**

Use real temp directories and fake CLI execution. Cover:

```js
test('P8 restores backup when interrupted after old final was moved away',async()=>{
  // create final metadata + move the known-good PMTiles to .bak
  // create transaction journal at stage "backup-created"
  // construct a new manager and call snapshot()
  // assert final PMTiles is restored, backup/journal removed, installed entry remains
});

test('P8 keeps valid final and removes stale backup after interrupted metadata cleanup',async()=>{
  // final + metadata + .bak + journal(stage:"metadata-written")
  // snapshot() -> final remains, backup/journal disappear
});

test('P8 removes orphan .part files that are not referenced by an active transaction',async()=>{
  // create farm-x.part-old.pmtiles
  // snapshot(); assert file missing afterwards
});
```

Review Focus case: malformed journal + `.bak` must leave backup untouched and surface recovery failure rather than deleting it.

- [ ] **Step 2: Run tests RED**

```bash
node --test tests/p8-map-robustness.test.js
```

Expected: FAIL because no reconciliation/journal mechanism exists.

- [ ] **Step 3: Implement transaction helpers and reconciliation**

Add focused helpers inside `runtime/map-package-manager.mjs`:

```js
const journalPath=id=>join(packages,`${id}.transaction.json`);
const writeJournal=(id,value)=>atomicJson(journalPath(id),{version:1,id,...value});

async function reconcileTransaction(record){
  const finalPath=join(packages,basename(record.finalFile));
  const backupPath=join(packages,basename(record.backupFile));
  const tempPath=join(packages,basename(record.tempFile));
  const metadataPath=join(packages,basename(record.metadataFile));
  const finalExists=await exists(finalPath);
  const backupExists=await exists(backupPath);
  if(!finalExists&&backupExists)await rename(backupPath,finalPath);
  else if(finalExists&&backupExists&&await exists(metadataPath))await rm(backupPath,{force:true});
  await rm(tempPath,{force:true});
  if(await exists(finalPath))await rm(journalPath(record.id),{force:true});
}
```

`reconcilePackages()` must:

1. enumerate `*.transaction.json`;
2. parse each fail-closed;
3. reconcile only valid version-1 journals whose basenames remain inside `packages`;
4. keep malformed journal/backup evidence and record a recovery issue rather than deleting it;
5. remove orphan `.part-*.pmtiles` not referenced by a valid journal.

Make `init()` idempotently call reconciliation once per manager instance after directories exist.

Change `installFarmMap()` promotion to:

```js
await writeJournal(recordId,{stage:'verified-temp',finalFile:basename(finalPath),backupFile:basename(backupPath),tempFile:basename(tempPath),metadataFile:`${recordId}.json`,startedAt:new Date().toISOString()});
if(await exists(finalPath)){
  await rm(backupPath,{force:true});
  await rename(finalPath,backupPath);
  await writeJournal(recordId,{...journal,'stage':'backup-created'});
}
await rename(tempPath,finalPath);
await writeJournal(recordId,{...journal,'stage':'final-promoted'});
await atomicJson(metadataPath,record);
await writeJournal(recordId,{...journal,'stage':'metadata-written'});
await rm(backupPath,{force:true});
await rm(journalPath(recordId),{force:true});
```

Normalize any `ENOSPC` arising in extraction/promotion/metadata write to `MAP_DISK_FULL`. In the catch path restore `.bak` when final is absent; do not delete a known-good final.

- [ ] **Step 4: Run focused tests GREEN**

```bash
node --test tests/p8-map-robustness.test.js tests/map-package-manager.test.js
```

Expected: PASS including malformed-journal preservation and stale-temp cleanup.

- [ ] **Step 5: Commit**

```bash
git add runtime/map-package-manager.mjs tests/p8-map-robustness.test.js tests/map-package-manager.test.js
git commit -m "feat: recover interrupted offline map installs"
```

---

### Task 3: Local integrity metadata, health states, and explicit verification

**Files:**
- Modify: `runtime/map-package-manager.mjs`
- Modify: `src/presentation-p5.js`
- Test: `tests/p8-map-robustness.test.js`
- Extend: `tests/map-package-manager.test.js`

**Interfaces:**
- Produces metadata fields: `metadataVersion:1`, `sha256`, `verifiedAt`, `catalogVersion`.
- Produces `verifyFarmMap({id}) -> {id,health,size,sha256,verifiedAt,...}`.
- `snapshot().installed[]` gains `health` in `healthy|unverified|missing|corrupt|outdated`.
- `offline-maps` screen gains action `verifyFarmMap`.

- [ ] **Step 1: Write health and verification tests**

Add tests for:

```js
test('P8 reports legacy package unverified then upgrades metadata after explicit verification',async()=>{
  // legacy metadata has no metadataVersion/sha256
  // snapshot -> health === 'unverified'
  // verifyFarmMap -> fake CLI verify succeeds, local sha computed, metadataVersion === 1, health === 'healthy'
});

test('P8 reports missing and corrupt packages without deleting metadata automatically',async()=>{
  // missing file -> health missing
  // wrong file size/hash -> health corrupt
  // assert metadata remains present
});
```

Review Focus: invalid metadata JSON next to an intact PMTiles file must not delete the PMTiles; `snapshot()` records a recovery/integrity issue and leaves the file in place.

Add an `outdated` test: cached catalog version/sourceDate newer than metadata -> health `outdated`, but the package remains listed and usable.

- [ ] **Step 2: Run RED**

```bash
node --test tests/p8-map-robustness.test.js tests/map-package-manager.test.js
```

Expected: FAIL because installed records have no health/verification API.

- [ ] **Step 3: Implement streaming SHA and cheap snapshot health**

Add:

```js
async function sha256File(path){
  const {createReadStream}=await import('node:fs');
  return new Promise((resolveDigest,reject)=>{
    const hash=createHash('sha256');
    const stream=createReadStream(path);
    stream.on('data',chunk=>hash.update(chunk));
    stream.on('error',reject);
    stream.on('end',()=>resolveDigest(hash.digest('hex')));
  });
}
```

On successful install, compute SHA after `pmtiles verify` and before promotion, then persist:

```js
metadataVersion:1,
sha256:digest,
verifiedAt:new Date().toISOString(),
catalogVersion:catalogCache?.releaseVersion??null
```

`installed()` must perform only cheap checks by default: metadata parse, file existence, `stat().size`, metadata-version/hash presence, and cached catalog freshness. Do not hash multi-GB files on every load.

`verifyFarmMap({id})` must:

1. load metadata safely;
2. require file existence or return `missing`;
3. run PMTiles CLI `verify`;
4. stream SHA-256;
5. compare to existing SHA when present;
6. upgrade legacy metadata only after verification succeeds;
7. return `corrupt` without deleting file/metadata when CLI/hash fails.

- [ ] **Step 4: Wire presentation action**

In `src/presentation-p5.js`, add:

```js
const verifyMapDefinition=Object.freeze({
  name:'verifyFarmMap',label:'Verificar integridade',
  description:'Verifica o pacote PMTiles local sem alterar dados agrícolas.',
  intent:'secondary',confirm:null,requiresSelection:true,fields:Object.freeze([])
});
```

Add action:

```js
verifyFarmMap:input=>{
  if(typeof mapPackages?.verifyFarmMap!=='function')throw new Error('Verificação de mapas requer o aplicativo desktop.');
  return mapPackages.verifyFarmMap(input);
}
```

and expose the definition next to install/remove.

- [ ] **Step 5: Run GREEN**

```bash
node --test tests/p8-map-robustness.test.js tests/map-package-manager.test.js tests/p4-p5-field-offline.test.js
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add runtime/map-package-manager.mjs src/presentation-p5.js tests/p8-map-robustness.test.js tests/map-package-manager.test.js tests/p4-p5-field-offline.test.js
git commit -m "feat: verify offline map package integrity"
```

---

### Task 4: Complete multi-state coverage planning

**Files:**
- Modify: `src/map-package-planner.js`
- Extend: `tests/p4-p5-field-offline.test.js`
- Test: `tests/p8-map-robustness.test.js`

**Interfaces:**
- Produces internal/exported `boundsFullyCovered(targetBounds, sourceBounds[]) -> boolean` for deterministic testability.
- `buildFarmMapDownloadPlan()` keeps existing result shape but throws when available state bounds do not cover the entire farm rectangle.
- `sources` remains stable in manifest order.

- [ ] **Step 1: Write full-coverage tests**

Create a manifest fixture with two adjacent state bounds and a farm spanning both.

```js
test('P8 accepts a farm fully covered by two adjacent state packages',()=>{
  const plan=buildFarmMapDownloadPlan({/* farm spans left+right package */});
  assert.deepEqual(plan.sources.map(item=>item.id),['left','right']);
});

test('P8 rejects partial multi-state coverage even when one package intersects',()=>{
  assert.throws(()=>buildFarmMapDownloadPlan({/* right state unavailable */}),/complete map coverage/i);
});
```

Review Focus: a farm whose `maxLongitude` equals one package's `maxLongitude` must be accepted when all other edges are covered; add an exact-edge case.

- [ ] **Step 2: Run RED**

```bash
node --test tests/p4-p5-field-offline.test.js tests/p8-map-robustness.test.js
```

Expected: partial coverage currently produces a plan instead of failing.

- [ ] **Step 3: Implement rectangle union coverage**

Implement deterministic interval sweep without GIS dependencies:

```js
export function boundsFullyCovered(target,sources){
  const [minX,minY,maxX,maxY]=target;
  const xs=[minX,maxX,...sources.flatMap(b=>[Math.max(minX,b[0]),Math.min(maxX,b[2])])]
    .filter(x=>x>=minX&&x<=maxX).sort((a,b)=>a-b);
  const cuts=[...new Set(xs)];
  for(let i=0;i<cuts.length-1;i+=1){
    const left=cuts[i],right=cuts[i+1];
    if(right<=left)continue;
    const mid=(left+right)/2;
    const ys=sources.filter(b=>b[0]<=mid&&b[2]>=mid)
      .map(b=>[Math.max(minY,b[1]),Math.min(maxY,b[3])])
      .filter(([a,z])=>z>=a).sort((a,b)=>a[0]-b[0]);
    let cursor=minY;
    for(const [a,z] of ys){if(a>cursor+1e-10)break;cursor=Math.max(cursor,z);}
    if(cursor<maxY-1e-10)return false;
  }
  return cuts[0]===minX&&cuts.at(-1)===maxX;
}
```

After selecting `states`, call:

```js
if(!boundsFullyCovered(bounds,states.map(map=>map.bounds)))throw new Error('Available map packages do not provide complete map coverage for this farm.');
```

- [ ] **Step 4: Run GREEN**

```bash
node --test tests/p4-p5-field-offline.test.js tests/p8-map-robustness.test.js
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/map-package-planner.js tests/p4-p5-field-offline.test.js tests/p8-map-robustness.test.js
git commit -m "feat: require complete multi-state map coverage"
```

---

### Task 5: Strict GIS topology and linear agricultural-map assembly

**Files:**
- Modify: `src/gis-import.js`
- Modify: `src/agricultural-map.js`
- Extend: `tests/p6-gis-import.test.js`
- Extend/Create: `tests/p8-map-robustness.test.js`

**Interfaces:**
- Produces/export `validatePolygonRingTopology(ring,path)` used by `normalizeGisGeometry()`.
- Agricultural snapshot keeps current shape and adds `unmappedFields[].invalidGeometry` when applicable.
- No external GIS package is introduced for topology validation.

- [ ] **Step 1: Write topology RED tests**

Add to `tests/p6-gis-import.test.js`:

```js
test('P8 rejects bow-tie and zero-area field boundaries',()=>{
  assert.throws(()=>normalizeGisGeometry({type:'Polygon',coordinates:[[
    [0,0],[2,2],[0,2],[2,0],[0,0]
  ]]}),/self-intersect/i);
  assert.throws(()=>normalizeGisGeometry({type:'Polygon',coordinates:[[
    [0,0],[1,0],[2,0],[0,0]
  ]]}),/degenerate|area/i);
});
```

Review Focus: add one valid polygon containing a redundant collinear vertex; it must normalize successfully.

- [ ] **Step 2: Implement topology validation**

Add helpers to `src/gis-import.js`:

```js
const orientation=(a,b,c)=>Math.sign((b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]));
const ringArea=ring=>Math.abs(ring.slice(0,-1).reduce((sum,p,i)=>{
  const q=ring[(i+1)%(ring.length-1)];
  return sum+p[0]*q[1]-q[0]*p[1];
},0))/2;
```

Implement `validatePolygonRingTopology` to require three distinct non-closing vertices, `ringArea > 1e-14`, and reject intersections between non-adjacent segments. Adjacent segments and first/last shared endpoint are allowed.

Call it from `validatePolygonStructure()` after closure validation.

- [ ] **Step 3: Write legacy-geometry and large-fixture RED tests**

In `tests/p8-map-robustness.test.js`:

```js
test('P8 degrades one malformed legacy geometry without losing valid fields',()=>{
  const snapshot=buildAgriculturalMapSnapshot({
    fields:[{id:'good'},{id:'bad'}],
    geometries:[
      {fieldId:'good',type:'Polygon',coordinates:[[0,0],[1,0],[1,1],[0,0]]},
      {fieldId:'bad',type:'Polygon',coordinates:[[999,999],[1,0],[1,1]]}
    ]
  });
  assert.equal(snapshot.fields.length,1);
  assert.equal(snapshot.unmappedFields.find(item=>item.id==='bad').invalidGeometry,true);
});
```

Large fixture: generate 5,000 fields/geometries plus one operation/scouting/rainfall record per field, call `buildAgriculturalMapSnapshot()`, assert `fields.length===5000`, summary counts remain correct, and elapsed time is below a generous `10_000ms` on CI. The implementation structure, not the exact timer, is the main regression guard.

- [ ] **Step 4: Refactor agricultural-map lookup to indexes**

Add a helper:

```js
function groupByField(records,key='fieldId'){
  const map=new Map();
  for(const record of records){
    const id=String(record?.[key]??'');
    if(!id)continue;
    const bucket=map.get(id);if(bucket)bucket.push(record);else map.set(id,[record]);
  }
  return map;
}
```

Prebuild indexes for scouting, field image files, rainfall, operations, applications, and geometries once. Replace per-field full-array `.filter()` scans with `index.get(String(field.id))??[]`.

Geometry normalization must become strict for stored field boundaries: any invalid WGS84 point/structure marks that field invalid rather than dropping only the bad point. Preserve rendering of valid records.

- [ ] **Step 5: Run GREEN**

```bash
node --test tests/p6-gis-import.test.js tests/p8-map-robustness.test.js tests/p3-agricultural-map.test.js
```

Expected: PASS including 5,000-field fixture.

- [ ] **Step 6: Commit**

```bash
git add src/gis-import.js src/agricultural-map.js tests/p6-gis-import.test.js tests/p8-map-robustness.test.js tests/p3-agricultural-map.test.js
git commit -m "feat: harden GIS topology and large map snapshots"
```

---

### Task 6: Package-health UI and actionable recovery states

**Files:**
- Modify: `web/ui/offline-maps.jsx`
- Modify: `web/ui/offline-maps.css` if health badges require styles
- Extend: `tests/p4-p5-field-offline.test.js`
- Test: `tests/p8-map-robustness.test.js`

**Interfaces:**
- Consumes: `provider.installed[].health`, `verifyFarmMap` action, and `MapPackageError.code` transported through the existing RPC error message/object boundary.
- Produces: health labels in Portuguese and explicit `Verificar integridade` action for installed desktop packages.

- [ ] **Step 1: Add UI contract tests**

Assert source contains stable health mapping and explicit action:

```js
test('P8 offline map UI exposes integrity verification and health guidance',()=>{
  const ui=fs.readFileSync(new URL('../web/ui/offline-maps.jsx',import.meta.url),'utf8');
  assert.match(ui,/verifyFarmMap/);
  assert.match(ui,/healthy/);
  assert.match(ui,/unverified/);
  assert.match(ui,/corrupt/);
  assert.match(ui,/outdated/);
  assert.match(ui,/Verificar integridade/);
});
```

Add PWA fallback assertion: when `provider.available===false`, no verify/install call can be triggered; existing field-mode fallback copy remains present.

- [ ] **Step 2: Run RED**

```bash
node --test tests/p4-p5-field-offline.test.js tests/p8-map-robustness.test.js
```

Expected: FAIL because no health UI/action exists.

- [ ] **Step 3: Implement health/error presentation**

In `web/ui/offline-maps.jsx`, define:

```js
const HEALTH_COPY=Object.freeze({
  healthy:{label:'Verificado',tone:'ok'},
  unverified:{label:'Não verificado',tone:'warning'},
  outdated:{label:'Atualização disponível',tone:'warning'},
  missing:{label:'Arquivo ausente',tone:'danger'},
  corrupt:{label:'Falha de integridade',tone:'danger'}
});
const ERROR_COPY=Object.freeze({
  MAP_DISK_FULL:'Libere espaço em disco e tente novamente.',
  MAP_CATALOG_UNAVAILABLE:'Não foi possível atualizar o catálogo. Os mapas já instalados continuam disponíveis.',
  MAP_SOURCE_UNAVAILABLE:'A fonte do mapa está indisponível. Tente novamente quando houver conexão.',
  MAP_VERIFY_FAILED:'O pacote baixado não passou na verificação e não substituiu o mapa anterior.',
  MAP_PACKAGE_CORRUPT:'O mapa local falhou na verificação de integridade.'
});
```

Add `verify(item)` calling `onRun('verifyFarmMap',{id:item.id})`, then `reload()`.

Render health badge per installed map. Show `Verificar integridade` only when desktop provider is available. Preserve `Remover` and installation controls.

If the existing RPC layer exposes only `.message`, keep stable Portuguese messages generated by `MapPackageError`; do not parse OS strings. If it preserves `.code`, prefer `ERROR_COPY[error.code]`.

- [ ] **Step 4: Run GREEN and build**

```bash
node --test tests/p4-p5-field-offline.test.js tests/p8-map-robustness.test.js
npm run build:web
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add web/ui/offline-maps.jsx web/ui/offline-maps.css tests/p4-p5-field-offline.test.js tests/p8-map-robustness.test.js
git commit -m "feat: show offline map package health"
```

---

### Task 7: P8 E2E isolation, CI gate, status, and full regression certification

**Files:**
- Create: `tests/e2e/p8-map-robustness.spec.mjs`
- Modify: `tooling/qa-web.mjs`
- Create: `.github/workflows/p8-map-robustness.yml`
- Modify: `PRODUCT_STATUS.md`
- Modify: `README.md` only if its phase summary still stops at P7
- Test: `tests/p8-map-robustness.test.js`

**Interfaces:**
- `partitionE2eFiles()` gains mandatory specialized `p8-map-robustness.spec.mjs` and returns `p8` partition.
- `runQaWeb()` order becomes baseline P0-P5 -> P6 -> P7 -> P8, each specialized segment in a fresh Playwright process.
- P8 workflow must run Node 22, `npm test`, `npm run build:web`, Chromium, P8 E2E, and `npm run compat:contract`.

- [ ] **Step 1: Write the P8 browser-visible fallback journey**

`tests/e2e/p8-map-robustness.spec.mjs` must use the real web runtime without a desktop provider:

```js
import {test,expect} from '@playwright/test';

test('P8 keeps field data usable when no desktop basemap provider exists',async({page})=>{
  await page.goto('/');
  await page.getByTestId('password').fill('P8-Robustness-2026!');
  await page.getByTestId('auth-submit').click();
  await page.getByTestId('nav-offline-maps').click();
  await expect(page.getByTestId('offline-maps-workspace')).toBeVisible();
  await expect(page.getByText('Somente no desktop Windows')).toBeVisible();
  await expect(page.getByRole('button',{name:'Baixar mapa desta fazenda'})).toBeDisabled();
  await page.getByTestId('nav-field-mode').click();
  await expect(page.getByTestId('field-mode-workspace')).toBeVisible();
});
```

If existing test IDs differ, use the exact IDs already established by P4/P5 rather than inventing another surface.

- [ ] **Step 2: Write the qa-web partition RED test**

Extend `tests/p8-map-robustness.test.js`:

```js
test('P8 keeps P6 P7 and P8 browser suites isolated in fresh processes',async()=>{
  const {partitionE2eFiles}=await import('../tooling/qa-web.mjs');
  const partitions=partitionE2eFiles([
    'full-surface.spec.mjs','p6-gis-import.spec.mjs','p7-satellite.spec.mjs','p8-map-robustness.spec.mjs'
  ]);
  assert.deepEqual(partitions.p8,['tests/e2e/p8-map-robustness.spec.mjs']);
  assert.ok(!partitions.baseline.some(path=>path.includes('p8-map-robustness')));
});
```

- [ ] **Step 3: Run RED**

```bash
node --test tests/p8-map-robustness.test.js
```

Expected: FAIL until `tooling/qa-web.mjs` requires/partitions P8.

- [ ] **Step 4: Extend qa-web without weakening P6/P7 isolation**

Change:

```js
const SPECIALIZED=Object.freeze(['p6-gis-import.spec.mjs','p7-satellite.spec.mjs','p8-map-robustness.spec.mjs']);
```

and return:

```js
p8:Object.freeze(['tests/e2e/p8-map-robustness.spec.mjs'])
```

Then in `runQaWeb()`:

```js
if(exitCode===0)exitCode=await runPlaywright(partitions.p8,'p8-map-robustness');
```

Do not merge P8 into baseline, P6, or P7 processes.

- [ ] **Step 5: Add P8 workflow**

Create `.github/workflows/p8-map-robustness.yml`:

```yaml
name: P8 map robustness
on:
  pull_request:
    branches: [main]
    paths:
      - 'runtime/map-package-manager.mjs'
      - 'src/map-package-planner.js'
      - 'src/gis-import.js'
      - 'src/agricultural-map.js'
      - 'src/presentation-p5.js'
      - 'web/ui/offline-maps.jsx'
      - 'web/ui/offline-maps.css'
      - 'tooling/qa-web.mjs'
      - 'tests/p8-map-robustness.test.js'
      - 'tests/e2e/p8-map-robustness.spec.mjs'
      - '.github/workflows/p8-map-robustness.yml'
  workflow_dispatch:
permissions:
  contents: read
jobs:
  certify:
    runs-on: ubuntu-latest
    timeout-minutes: 35
    steps:
      - uses: actions/checkout@v7
      - uses: actions/setup-node@v7
        with:
          node-version: 22
      - run: npm install --no-audit --no-fund
      - run: npm test
      - run: npm run build:web
      - run: npx playwright install --with-deps chromium
      - run: npx playwright test tests/e2e/p8-map-robustness.spec.mjs
      - run: npm run compat:contract
```

- [ ] **Step 6: Update canonical status/documentation**

Add P8 to `PRODUCT_STATUS.md` with concrete completed capabilities only:

```md
- P8 robustez de mapas/GIS: recuperação de instalação interrompida, integridade SHA-256, saúde de pacote, cobertura multiestado completa, topologia de polígonos, degradação segura de geometria legada, snapshot indexado para grandes conjuntos e gate E2E isolado.
```

Do not claim commercial certification until the release gates below are actually green.

- [ ] **Step 7: Run the local/full verification commands**

Run in order:

```bash
npm test
npm run build:web
npx playwright test tests/e2e/p8-map-robustness.spec.mjs
npm run qa:web
npm run compat:contract
```

Expected: all PASS; `qa:web` visibly runs four segments: baseline-p0-p5, p6-gis, p7-satellite, p8-map-robustness.

- [ ] **Step 8: Commit**

```bash
git add tests/e2e/p8-map-robustness.spec.mjs tooling/qa-web.mjs .github/workflows/p8-map-robustness.yml PRODUCT_STATUS.md README.md tests/p8-map-robustness.test.js
git commit -m "ci: certify P8 map robustness"
```

- [ ] **Step 9: Open/refresh implementation PR and require remote gates**

The implementation PR may leave draft only after the same HEAD has:

```text
P8 map robustness                         success
P0 hardening / Linux regression           success
P0 hardening / Windows release:certify    success + installer artifact
P1 architecture and operation             success
P2 agricultural product                   success
P6 GIS import                             success
P7 satellite                              success
```

P3/P4/P5 remain covered by the full `npm test` + segmented `qa:web` release path; do not remove their existing workflows/contracts.

- [ ] **Step 10: Whole-branch verification before merge**

Before claiming P8 complete:

```bash
npm test
npm run phase5
npm run compat:contract
```

Then inspect remote GitHub Actions for the exact PR HEAD and confirm Windows `release:certify` produced the installer artifact. If any gate is red, debug that gate; do not merge based only on the P8-specific workflow.

- [ ] **Step 11: Merge only the certified implementation branch**

Use a normal merge commit/PR merge after all gates above are green. After merge, verify `main` points to the expected merge commit and at minimum the push-triggered P0/P1/P2 workflows have started on that merge tree.
