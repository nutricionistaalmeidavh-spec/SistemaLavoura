# P8 Map Robustness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Harden the existing offline-map/GIS stack so interrupted installs, corrupt packages, low disk, malformed geometry, cross-state farms, and large datasets fail safely without breaking P0-P7 or adding a mandatory paid/cloud dependency.

**Architecture:** Extend the existing `map-package-manager`, planner, GIS domain, agricultural read model, presentation layer, and offline-map UI in place. Package replacement becomes journaled and recoverable, installed packages gain local integrity metadata and health states, GIS boundaries gain strict topology checks, and agricultural-map relationship lookups become indexed. Existing manual field polygons remain compatible: a valid unclosed stored ring may be closed in memory for validation/rendering, but persisted legacy data is never silently rewritten.

**Tech Stack:** Node.js 22 ESM, Electron 44, React 19, PMTiles CLI v1.31.2, Playwright 1.55, GitHub Actions Linux/Windows.

**Spec:** `docs/superpowers/specs/2026-09-20-p8-map-robustness-design.md`

## Global Constraints

- Mandatory core remains local-first and R$0 to operate.
- No paid API, ArtiSys server, mandatory account, or new cloud dependency.
- Existing P0-P7 behavior and screen/action contracts remain compatible.
- Installed map failures never mutate agricultural domain data.
- A new/updated PMTiles file is never promoted before `pmtiles verify` succeeds.
- Existing pre-P8 map metadata remains readable and is `unverified` until explicit verification.
- Existing valid manual field geometry stored without a repeated closing point remains readable; P8 may close a copy in memory but must not rewrite it automatically.
- Existing invalid legacy geometry is surfaced, never silently repaired in persistence.
- No SQLite migration is required for map-package transaction/integrity state.
- Node runtime floor remains `>=22`.
- Windows automatic PMTiles extraction remains Windows x64 desktop only.
- P6/P7 Playwright process isolation remains intact.

## Review Focus

1. **Damaged metadata JSON with intact PMTiles:** do not delete the map file; surface a recovery/integrity issue.
2. **Malformed transaction journal with backup present:** never delete both candidates; preserve evidence and fail closed.
3. **Farm bounds touching package edges:** exact shared edges are accepted only when the entire farm rectangle is covered.
4. **Redundant collinear polygon vertices:** valid shape stays valid, while zero-area and self-crossing rings fail.
5. **PWA/mobile without desktop provider:** field mode remains usable and package-management actions remain unavailable/non-destructive.

---

### Task 1: Stable errors and strict catalog refresh

**Files:**
- Modify: `runtime/map-package-manager.mjs`
- Create: `tests/p8-map-robustness.test.js`
- Extend: `tests/map-package-manager.test.js`

**Interfaces:**
- Produces `MapPackageError(code,message,{retryable,cause})`.
- Produces `normalizeMapPackageError(error,fallbackCode)`.
- Reuses `validateMapManifest(input)` from `src/map-package-planner.js`.
- `refreshCatalog(url?)` validates the complete manifest before replacing cache/disk state.

- [ ] **Step 1: Write the RED tests**

Create `tests/p8-map-robustness.test.js` with these initial imports and tests:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {createMapPackageManager,MapPackageError,normalizeMapPackageError} from '../runtime/map-package-manager.mjs';

const validManifest={
  schemaVersion:1,
  releaseVersion:'2026.09.1',
  generatedAt:'2026-09-20T12:00:00Z',
  source:{provider:'Protomaps Basemap daily build',license:'ODbL-1.0'},
  maps:[{id:'sp',name:'São Paulo',kind:'state',available:true,version:'2026.09.1',asset:'sp.pmtiles',size:1000,sha256:'a'.repeat(64),minZoom:7,maxZoom:14,bounds:[-53.2,-25.4,-44.1,-19.7],sourceDate:'2026-09-20'}]
};

test('P8 normalizes ENOSPC into a stable retryable map error',()=>{
  const error=normalizeMapPackageError(Object.assign(new Error('no space'),{code:'ENOSPC'}),'MAP_EXTRACT_FAILED');
  assert.ok(error instanceof MapPackageError);
  assert.equal(error.code,'MAP_DISK_FULL');
  assert.equal(error.retryable,true);
});

test('P8 preserves last valid cached catalog when a refresh is invalid',async()=>{
  const dataDir=await mkdtemp(join(tmpdir(),'lavoura-p8-catalog-'));
  let mode='valid';
  const fetchImpl=async()=>({ok:true,status:200,async json(){return mode==='valid'?validManifest:{schemaVersion:99,maps:[]};}});
  const manager=createMapPackageManager({dataDir,platform:'win32',arch:'x64',fetchImpl});
  await manager.refreshCatalog('https://example.test/maps-manifest.json');
  mode='invalid';
  await assert.rejects(()=>manager.refreshCatalog('https://example.test/maps-manifest.json'),error=>error.code==='MAP_CATALOG_INVALID');
  const reopened=createMapPackageManager({dataDir,platform:'win32',arch:'x64',fetchImpl});
  const snapshot=await reopened.snapshot();
  assert.equal(snapshot.catalogVersion,'2026.09.1');
});
```

- [ ] **Step 2: Run RED**

```bash
node --test tests/p8-map-robustness.test.js tests/map-package-manager.test.js
```

Expected: FAIL because `MapPackageError` and `normalizeMapPackageError` do not exist and `refreshCatalog()` does not semantically validate the full manifest.

- [ ] **Step 3: Implement stable errors and semantic catalog validation**

In `runtime/map-package-manager.mjs` add:

```js
import {validateMapManifest} from '../src/map-package-planner.js';

export class MapPackageError extends Error{
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
  const retryable=new Set(['MAP_CATALOG_UNAVAILABLE','MAP_SOURCE_UNAVAILABLE','MAP_EXTRACT_FAILED']);
  return new MapPackageError(fallbackCode,error?.message||'Falha no gerenciamento do mapa.',{retryable:retryable.has(fallbackCode),cause:error});
}
```

Replace `refreshCatalog()` with:

```js
async function refreshCatalog(url=DEFAULT_MANIFEST_URL){
  await init();
  let response;
  try{response=await fetchImpl(url,{redirect:'follow'});}
  catch(error){throw normalizeMapPackageError(error,'MAP_CATALOG_UNAVAILABLE');}
  if(!response.ok)throw new MapPackageError('MAP_CATALOG_UNAVAILABLE',`Catálogo de mapas indisponível (${response.status}).`,{retryable:true});
  let value;
  try{value=validateMapManifest(await response.json());}
  catch(error){throw new MapPackageError('MAP_CATALOG_INVALID','O catálogo de mapas recebido é inválido.',{cause:error});}
  await atomicJson(catalogPath,value);
  catalogCache=value;
  return value;
}
```

Wrap source-resolution exhaustion in `MAP_SOURCE_UNAVAILABLE` and unsupported CLI runtime in `MAP_UNSUPPORTED_RUNTIME` without changing successful paths.

- [ ] **Step 4: Run GREEN**

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

### Task 2: Journaled promotion and interrupted-install recovery

**Files:**
- Modify: `runtime/map-package-manager.mjs`
- Extend: `tests/p8-map-robustness.test.js`
- Extend: `tests/map-package-manager.test.js`

**Interfaces:**
- Transaction file: `<packages>/<id>.transaction.json`.
- Shape: `{version:1,id,finalFile,backupFile,tempFile,metadataFile,stage,startedAt}`.
- Stages: `verified-temp`, `backup-created`, `final-promoted`, `metadata-written`.
- Internal `reconcilePackages()` runs once from `init()` after directories exist.

- [ ] **Step 1: Add concrete RED recovery tests**

Append imports:

```js
import {mkdir,writeFile,readFile,access} from 'node:fs/promises';
```

Add helper and tests:

```js
const exists=async path=>{try{await access(path);return true;}catch{return false;}};

test('P8 restores known-good backup after interruption at backup-created',async()=>{
  const dataDir=await mkdtemp(join(tmpdir(),'lavoura-p8-recover-'));
  const packages=join(dataDir,'maps','packages');
  await mkdir(packages,{recursive:true});
  const id='farm-farm-1-detailed';
  const finalFile=`${id}.pmtiles`,backupFile=`${finalFile}.bak`,tempFile=`${finalFile}.part-1.pmtiles`;
  await writeFile(join(packages,backupFile),'known-good');
  await writeFile(join(packages,tempFile),'partial');
  await writeFile(join(packages,`${id}.json`),JSON.stringify({id,fileName:finalFile,size:10,profile:'detailed'}));
  await writeFile(join(packages,`${id}.transaction.json`),JSON.stringify({version:1,id,finalFile,backupFile,tempFile,metadataFile:`${id}.json`,stage:'backup-created',startedAt:'2026-09-20T12:00:00Z'}));
  const manager=createMapPackageManager({dataDir,platform:'linux',arch:'x64',fetchImpl:async()=>{throw new Error('offline');}});
  await manager.snapshot();
  assert.equal(await readFile(join(packages,finalFile),'utf8'),'known-good');
  assert.equal(await exists(join(packages,backupFile)),false);
  assert.equal(await exists(join(packages,tempFile)),false);
  assert.equal(await exists(join(packages,`${id}.transaction.json`)),false);
});

test('P8 preserves malformed recovery evidence instead of deleting a backup',async()=>{
  const dataDir=await mkdtemp(join(tmpdir(),'lavoura-p8-bad-journal-'));
  const packages=join(dataDir,'maps','packages');
  await mkdir(packages,{recursive:true});
  await writeFile(join(packages,'farm-farm-1-detailed.pmtiles.bak'),'known-good');
  await writeFile(join(packages,'farm-farm-1-detailed.transaction.json'),'{bad json');
  const manager=createMapPackageManager({dataDir,platform:'linux',arch:'x64',fetchImpl:async()=>{throw new Error('offline');}});
  const snapshot=await manager.snapshot();
  assert.equal(await exists(join(packages,'farm-farm-1-detailed.pmtiles.bak')),true);
  assert.equal(snapshot.recoveryIssues.length,1);
  assert.equal(snapshot.recoveryIssues[0].code,'MAP_RECOVERY_FAILED');
});

test('P8 removes orphan partial PMTiles not referenced by a transaction',async()=>{
  const dataDir=await mkdtemp(join(tmpdir(),'lavoura-p8-orphan-'));
  const packages=join(dataDir,'maps','packages');
  await mkdir(packages,{recursive:true});
  const partial=join(packages,'farm-x.part-orphan.pmtiles');
  await writeFile(partial,'partial');
  const manager=createMapPackageManager({dataDir,platform:'linux',arch:'x64',fetchImpl:async()=>{throw new Error('offline');}});
  await manager.snapshot();
  assert.equal(await exists(partial),false);
});
```

- [ ] **Step 2: Run RED**

```bash
node --test tests/p8-map-robustness.test.js
```

Expected: FAIL because reconciliation and `recoveryIssues` do not exist.

- [ ] **Step 3: Implement reconciliation**

Inside `createMapPackageManager`, add:

```js
let initialized=false;
let recoveryIssues=[];
const journalPath=id=>join(packages,`${id}.transaction.json`);
const writeJournal=(id,value)=>atomicJson(journalPath(id),{version:1,id,...value});
const localName=value=>{
  const name=basename(String(value??''));
  if(!name||name!==String(value))throw new MapPackageError('MAP_RECOVERY_FAILED','Registro de recuperação contém caminho inválido.');
  return name;
};
```

Add:

```js
async function reconcilePackages(){
  const {readdir}=await import('node:fs/promises');
  recoveryIssues=[];
  const names=await readdir(packages),referencedTemps=new Set();
  for(const name of names.filter(value=>value.endsWith('.transaction.json'))){
    const path=join(packages,name);
    try{
      const record=JSON.parse(await readFile(path,'utf8'));
      if(record?.version!==1||!record.id)throw new Error('unsupported transaction journal');
      const finalFile=localName(record.finalFile),backupFile=localName(record.backupFile),tempFile=localName(record.tempFile),metadataFile=localName(record.metadataFile);
      referencedTemps.add(tempFile);
      const finalPath=join(packages,finalFile),backupPath=join(packages,backupFile),tempPath=join(packages,tempFile),metadataPath=join(packages,metadataFile);
      if(!(await exists(finalPath))&&await exists(backupPath))await rename(backupPath,finalPath);
      if(await exists(finalPath)&&await exists(backupPath)&&await exists(metadataPath))await rm(backupPath,{force:true});
      await rm(tempPath,{force:true});
      if(await exists(finalPath))await rm(path,{force:true});
      else recoveryIssues.push({code:'MAP_RECOVERY_FAILED',id:record.id,message:'Não foi possível restaurar o pacote offline.'});
    }catch(error){recoveryIssues.push({code:'MAP_RECOVERY_FAILED',id:name.replace('.transaction.json',''),message:error.message});}
  }
  for(const name of names.filter(value=>/\.part-.*\.pmtiles$/.test(value)))if(!referencedTemps.has(name))await rm(join(packages,name),{force:true});
}
```

Make `init()` call reconciliation once:

```js
async function init(){
  await Promise.all([mkdir(tools,{recursive:true}),mkdir(packages,{recursive:true})]);
  if(!initialized){initialized=true;await reconcilePackages();}
}
```

Expose `recoveryIssues:Object.freeze([...recoveryIssues])` from `snapshot()`.

- [ ] **Step 4: Journal the promotion sequence**

Before replacing the final file define:

```js
const recordId=`farm-${safeId(input.farmUnitId)}-${profile}`;
const metadataPath=join(packages,`${recordId}.json`);
const backupPath=`${finalPath}.bak`;
const journalBase={finalFile:basename(finalPath),backupFile:basename(backupPath),tempFile:basename(tempPath),metadataFile:basename(metadataPath),startedAt:new Date().toISOString()};
```

Use:

```js
await writeJournal(recordId,{...journalBase,stage:'verified-temp'});
if(await exists(finalPath)){
  await rm(backupPath,{force:true});
  await rename(finalPath,backupPath);
  await writeJournal(recordId,{...journalBase,stage:'backup-created'});
}
await rename(tempPath,finalPath);
await writeJournal(recordId,{...journalBase,stage:'final-promoted'});
await atomicJson(metadataPath,record);
await writeJournal(recordId,{...journalBase,stage:'metadata-written'});
await rm(backupPath,{force:true});
await rm(journalPath(recordId),{force:true});
```

Normalize any `ENOSPC` from extraction/promotion/metadata write to `MAP_DISK_FULL`; restore `.bak` only when final is absent.

- [ ] **Step 5: Run GREEN**

```bash
node --test tests/p8-map-robustness.test.js tests/map-package-manager.test.js
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add runtime/map-package-manager.mjs tests/p8-map-robustness.test.js tests/map-package-manager.test.js
git commit -m "feat: recover interrupted offline map installs"
```

---

### Task 3: Integrity metadata, health states, and explicit verification

**Files:**
- Modify: `runtime/map-package-manager.mjs`
- Modify: `src/presentation-p5.js`
- Extend: `tests/p8-map-robustness.test.js`
- Extend: `tests/map-package-manager.test.js`
- Extend: `tests/p4-p5-field-offline.test.js`

**Interfaces:**
- Metadata v1 adds `metadataVersion`, `sha256`, `verifiedAt`, `catalogVersion`.
- `verifyFarmMap({id})` returns a package record with `health`.
- Health enum: `healthy|unverified|missing|corrupt|outdated`.
- `snapshot().installed[]` includes health without hashing every file.
- `offline-maps` gains action `verifyFarmMap`.

- [ ] **Step 1: Add concrete health tests**

Append:

```js
test('P8 upgrades legacy metadata only after explicit verification',async()=>{
  const dataDir=await mkdtemp(join(tmpdir(),'lavoura-p8-legacy-'));
  const packages=join(dataDir,'maps','packages'),cliDir=join(dataDir,'maps','tools','pmtiles-1.31.2');
  await mkdir(packages,{recursive:true});await mkdir(cliDir,{recursive:true});
  await writeFile(join(cliDir,'pmtiles.exe'),'fake-cli');
  await writeFile(join(packages,'farm-farm-1-detailed.pmtiles'),'legacy-map');
  await writeFile(join(packages,'farm-farm-1-detailed.json'),JSON.stringify({id:'farm-farm-1-detailed',farmUnitId:'farm-1',profile:'detailed',fileName:'farm-farm-1-detailed.pmtiles',size:10}));
  const manager=createMapPackageManager({dataDir,platform:'win32',arch:'x64',execFileImpl:async()=>({stdout:'',stderr:''}),fetchImpl:async()=>{throw new Error('offline');}});
  assert.equal((await manager.snapshot()).installed[0].health,'unverified');
  const verified=await manager.verifyFarmMap({id:'farm-farm-1-detailed'});
  assert.equal(verified.health,'healthy');
  const metadata=JSON.parse(await readFile(join(packages,'farm-farm-1-detailed.json'),'utf8'));
  assert.equal(metadata.metadataVersion,1);
  assert.match(metadata.sha256,/^[a-f0-9]{64}$/);
});
```

Add separate temp-dir tests for:
- metadata present/file absent -> `missing`;
- metadata SHA/size for original file then file modified -> `corrupt` after `verifyFarmMap()`;
- invalid metadata JSON plus intact `.pmtiles` -> PMTiles remains and `recoveryIssues` contains one integrity/recovery issue;
- cached catalog `2026.09.2` plus metadata `catalogVersion:'2026.09.1'` -> `outdated` while the package remains listed.

Each test creates the exact metadata/file paths under `<dataDir>/maps/packages` and asserts the files remain after snapshot/verification.

- [ ] **Step 2: Run RED**

```bash
node --test tests/p8-map-robustness.test.js tests/map-package-manager.test.js
```

Expected: FAIL because health/verification do not exist.

- [ ] **Step 3: Add streaming SHA and release comparison**

Add:

```js
async function sha256File(path){
  const {createReadStream}=await import('node:fs');
  return new Promise((resolveDigest,reject)=>{
    const hash=createHash('sha256'),stream=createReadStream(path);
    stream.on('data',chunk=>hash.update(chunk));
    stream.on('error',reject);
    stream.on('end',()=>resolveDigest(hash.digest('hex')));
  });
}
function releaseParts(value){const match=/^(\d{4})\.(\d{2})\.(\d+)$/.exec(String(value??''));return match?[Number(match[1]),Number(match[2]),Number(match[3])]:null;}
function newerRelease(candidate,current){const a=releaseParts(candidate),b=releaseParts(current);if(!a||!b)return false;for(let i=0;i<3;i+=1)if(a[i]!==b[i])return a[i]>b[i];return false;}
```

After PMTiles temp verification, compute SHA before promotion and include:

```js
metadataVersion:1,
sha256:await sha256File(tempPath),
verifiedAt:new Date().toISOString(),
catalogVersion:catalogCache?.releaseVersion??null
```

- [ ] **Step 4: Implement cheap snapshot health and explicit verification**

For each valid metadata record in `installed()` derive health without hashing:

```js
if(!fileExists)health='missing';
else if(metadata.metadataVersion!==1||!metadata.sha256)health='unverified';
else if(actualSize!==metadata.size)health='corrupt';
else if(newerRelease(catalogCache?.releaseVersion,metadata.catalogVersion))health='outdated';
else health='healthy';
```

Implement:

```js
async function verifyFarmMap({id}={}){
  await init();
  const clean=safeId(id),metadataPath=join(packages,`${clean}.json`);
  if(!(await exists(metadataPath)))throw new MapPackageError('MAP_PACKAGE_MISSING','Metadados do mapa local não foram encontrados.');
  const metadata=JSON.parse(await readFile(metadataPath,'utf8')),filePath=join(packages,basename(metadata.fileName));
  if(!(await exists(filePath)))return Object.freeze({...metadata,health:'missing'});
  const cli=await ensureCli();
  try{await execFileImpl(cli,['verify',filePath],{windowsHide:true,maxBuffer:8*1024*1024});}
  catch(error){return Object.freeze({...metadata,health:'corrupt',errorCode:'MAP_PACKAGE_CORRUPT'});}
  const info=await stat(filePath),digest=await sha256File(filePath);
  if(metadata.sha256&&metadata.sha256!==digest)return Object.freeze({...metadata,health:'corrupt',errorCode:'MAP_PACKAGE_CORRUPT'});
  const upgraded={...metadata,metadataVersion:1,size:info.size,sha256:digest,verifiedAt:new Date().toISOString(),catalogVersion:metadata.catalogVersion??catalogCache?.releaseVersion??null};
  await atomicJson(metadataPath,upgraded);
  return Object.freeze({...upgraded,health:newerRelease(catalogCache?.releaseVersion,upgraded.catalogVersion)?'outdated':'healthy'});
}
```

Expose `verifyFarmMap` from the manager.

- [ ] **Step 5: Wire presentation action**

In `src/presentation-p5.js` add:

```js
const verifyMapDefinition=Object.freeze({name:'verifyFarmMap',label:'Verificar integridade',description:'Verifica o pacote PMTiles local sem alterar dados agrícolas.',intent:'secondary',confirm:null,requiresSelection:true,fields:Object.freeze([])});
```

Add:

```js
verifyFarmMap:input=>{
  if(typeof mapPackages?.verifyFarmMap!=='function')throw new Error('Verificação de mapas requer o aplicativo desktop.');
  return mapPackages.verifyFarmMap(input);
}
```

and include `verifyFarmMap:verifyMapDefinition` in `actionDefinitions`.

- [ ] **Step 6: Run GREEN**

```bash
node --test tests/p8-map-robustness.test.js tests/map-package-manager.test.js tests/p4-p5-field-offline.test.js
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add runtime/map-package-manager.mjs src/presentation-p5.js tests/p8-map-robustness.test.js tests/map-package-manager.test.js tests/p4-p5-field-offline.test.js
git commit -m "feat: verify offline map package integrity"
```

---

### Task 4: Complete multi-state coverage planning

**Files:**
- Modify: `src/map-package-planner.js`
- Extend: `tests/p4-p5-field-offline.test.js`
- Extend: `tests/p8-map-robustness.test.js`

**Interfaces:**
- Produces `boundsFullyCovered(targetBounds,sourceBounds) -> boolean`.
- `buildFarmMapDownloadPlan()` keeps its existing return shape and manifest order for `sources`.

- [ ] **Step 1: Add RED coverage tests**

Append:

```js
import {boundsFullyCovered} from '../src/map-package-planner.js';

test('P8 covers a farm rectangle with two adjacent state bounds including shared edges',()=>{
  assert.equal(boundsFullyCovered([0,0,2,1],[[0,0,1,1],[1,0,2,1]]),true);
  assert.equal(boundsFullyCovered([0,0,2,1],[[0,0,1,1]]),false);
});
```

Add a `buildFarmMapDownloadPlan()` test using two synthetic available state entries `left` and `right`, with bounds `[0,0,1,1]` and `[1,0,2,1]`, and a farm polygon spanning `[0.25,0.25,1.75,0.75]`. Assert `sources.map(source=>source.id)` equals `['left','right']`. Clone the manifest with `right.available=false` and assert `/complete map coverage/i`.

- [ ] **Step 2: Run RED**

```bash
node --test tests/p4-p5-field-offline.test.js tests/p8-map-robustness.test.js
```

Expected: FAIL because `boundsFullyCovered` does not exist and partial intersecting coverage is accepted.

- [ ] **Step 3: Implement rectangle-union coverage**

Add:

```js
export function boundsFullyCovered(target,sources){
  if(!validBounds(target)||!Array.isArray(sources)||!sources.length)return false;
  const [minX,minY,maxX,maxY]=target;
  const clipped=sources.filter(validBounds).map(b=>[Math.max(minX,b[0]),Math.max(minY,b[1]),Math.min(maxX,b[2]),Math.min(maxY,b[3])]).filter(b=>b[0]<=b[2]&&b[1]<=b[3]);
  const cuts=[...new Set([minX,maxX,...clipped.flatMap(b=>[b[0],b[2]])])].sort((a,b)=>a-b);
  if(cuts[0]!==minX||cuts.at(-1)!==maxX)return false;
  for(let i=0;i<cuts.length-1;i+=1){
    const left=cuts[i],right=cuts[i+1];
    if(right<=left)continue;
    const x=(left+right)/2;
    const intervals=clipped.filter(b=>b[0]<=x&&b[2]>=x).map(b=>[b[1],b[3]]).sort((a,b)=>a[0]-b[0]);
    let cursor=minY;
    for(const [start,end] of intervals){if(start>cursor+1e-10)break;cursor=Math.max(cursor,end);}
    if(cursor<maxY-1e-10)return false;
  }
  return true;
}
```

After selecting `states`:

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

### Task 5: Strict GIS topology and scalable agricultural read model

**Files:**
- Modify: `src/gis-import.js`
- Modify: `src/agricultural-map.js`
- Extend: `tests/p6-gis-import.test.js`
- Extend: `tests/p3-agricultural-map.test.js`
- Extend: `tests/p8-map-robustness.test.js`

**Interfaces:**
- Produces `validatePolygonRingTopology(ring,path)` used by GIS normalization.
- Stored manual Polygon rings may be closed in memory if first/last differ; persistence is unchanged.
- `unmappedFields[]` gains `invalidGeometry:true` and `reason:'invalid-geometry'` for malformed stored geometry.
- Relationship lookup becomes O(fields + related records), aside from geometry traversal/serialization.

- [ ] **Step 1: Add GIS topology RED tests**

In `tests/p6-gis-import.test.js` add:

```js
test('P8 rejects self-intersecting and zero-area GIS polygons',()=>{
  assert.throws(()=>normalizeGisGeometry({type:'Polygon',coordinates:[[[0,0],[2,2],[0,2],[2,0],[0,0]]]}),/self-intersect/i);
  assert.throws(()=>normalizeGisGeometry({type:'Polygon',coordinates:[[[0,0],[1,0],[2,0],[0,0]]]}),/degenerate|area/i);
});

test('P8 accepts a valid ring with a redundant collinear vertex',()=>{
  const geometry=normalizeGisGeometry({type:'Polygon',coordinates:[[[0,0],[1,0],[2,0],[2,1],[0,1],[0,0]]]});
  assert.equal(geometry.type,'Polygon');
});
```

- [ ] **Step 2: Implement deterministic topology checks**

In `src/gis-import.js` add:

```js
const cross=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
const between=(value,a,b)=>value>=Math.min(a,b)-1e-12&&value<=Math.max(a,b)+1e-12;
const onSegment=(a,b,p)=>Math.abs(cross(a,b,p))<=1e-12&&between(p[0],a[0],b[0])&&between(p[1],a[1],b[1]);
function segmentsIntersect(a,b,c,d){
  const abC=cross(a,b,c),abD=cross(a,b,d),cdA=cross(c,d,a),cdB=cross(c,d,b);
  if(((abC>0&&abD<0)||(abC<0&&abD>0))&&((cdA>0&&cdB<0)||(cdA<0&&cdB>0)))return true;
  return onSegment(a,b,c)||onSegment(a,b,d)||onSegment(c,d,a)||onSegment(c,d,b);
}
const ringArea=ring=>Math.abs(ring.slice(0,-1).reduce((sum,p,index)=>{const q=ring[index+1];return sum+p[0]*q[1]-q[0]*p[1];},0))/2;

export function validatePolygonRingTopology(ring,path='ring'){
  const unique=new Set(ring.slice(0,-1).map(point=>`${point[0]},${point[1]}`));
  if(unique.size<3||ringArea(ring)<=1e-14)throw new TypeError(`${path} Polygon ring is degenerate.`);
  const segmentCount=ring.length-1;
  for(let i=0;i<segmentCount;i+=1){
    for(let j=i+1;j<segmentCount;j+=1){
      const adjacent=j===i+1||(i===0&&j===segmentCount-1);
      if(adjacent)continue;
      if(segmentsIntersect(ring[i],ring[i+1],ring[j],ring[j+1]))throw new TypeError(`${path} Polygon ring is self-intersecting.`);
    }
  }
}
```

Call `validatePolygonRingTopology()` after ring-closure validation for every Polygon/MultiPolygon ring.

- [ ] **Step 3: Add compatibility and large-fixture RED tests**

In `tests/p8-map-robustness.test.js` import `buildAgriculturalMapSnapshot` and add:

```js
test('P8 keeps valid unclosed manual geometry readable without rewriting persistence',()=>{
  const stored={fieldId:'f1',type:'Polygon',coordinates:[[0,0],[1,0],[1,1],[0,1]]};
  const snapshot=buildAgriculturalMapSnapshot({fields:[{id:'f1',name:'Manual'}],geometries:[stored]});
  assert.equal(snapshot.fields.length,1);
  assert.deepEqual(stored.coordinates,[[0,0],[1,0],[1,1],[0,1]]);
});

test('P8 isolates malformed legacy geometry while valid fields continue rendering',()=>{
  const snapshot=buildAgriculturalMapSnapshot({fields:[{id:'good'},{id:'bad'}],geometries:[{fieldId:'good',type:'Polygon',coordinates:[[0,0],[1,0],[1,1],[0,1]]},{fieldId:'bad',type:'Polygon',coordinates:[[999,999],[1,0],[1,1]]}]});
  assert.equal(snapshot.fields.length,1);
  const invalid=snapshot.unmappedFields.find(item=>item.id==='bad');
  assert.equal(invalid.invalidGeometry,true);
  assert.equal(invalid.reason,'invalid-geometry');
});

test('P8 builds a 5000-field snapshot with complete indexed summaries',()=>{
  const count=5000;
  const fields=Array.from({length:count},(_,i)=>({id:`f${i}`,areaHa:1}));
  const geometries=Array.from({length:count},(_,i)=>({fieldId:`f${i}`,type:'Polygon',coordinates:[[i/10000,0],[i/10000+.00005,0],[i/10000+.00005,.00005],[i/10000,.00005]]}));
  const operations=Array.from({length:count},(_,i)=>({id:`o${i}`,fieldId:`f${i}`,status:'planned'}));
  const scouting=Array.from({length:count},(_,i)=>({id:`s${i}`,fieldId:`f${i}`,status:'open'}));
  const started=Date.now();
  const snapshot=buildAgriculturalMapSnapshot({fields,geometries,operations,scouting});
  const elapsed=Date.now()-started;
  assert.equal(snapshot.fields.length,count);
  assert.equal(snapshot.fields[4321].summary.plannedOperations,1);
  assert.equal(snapshot.fields[4321].summary.openScouting,1);
  assert.ok(elapsed<10000,`elapsed=${elapsed}ms`);
});
```

- [ ] **Step 4: Refactor stored-geometry normalization and indexes**

In `src/agricultural-map.js` import `validatePolygonRingTopology` and replace permissive point dropping with:

```js
function strictStoredRing(raw){
  if(!Array.isArray(raw)||raw.length<3)return null;
  const ring=[];
  for(const point of raw){
    if(!Array.isArray(point)||point.length<2)return null;
    const longitude=Number(point[0]),latitude=Number(point[1]);
    if(!Number.isFinite(longitude)||!Number.isFinite(latitude)||longitude<-180||longitude>180||latitude<-90||latitude>90)return null;
    ring.push([longitude,latitude]);
  }
  if(ring[0][0]!==ring.at(-1)[0]||ring[0][1]!==ring.at(-1)[1])ring.push([...ring[0]]);
  try{validatePolygonRingTopology(ring,'stored field boundary');return Object.freeze(ring.map(point=>Object.freeze(point)));}
  catch{return null;}
}
```

Add:

```js
function groupByField(records,key='fieldId'){
  const index=new Map();
  for(const record of records){
    const id=String(record?.[key]??'');
    if(!id)continue;
    if(index.has(id))index.get(id).push(record);else index.set(id,[record]);
  }
  return index;
}
```

Pre-index scouting, image files, rainfall, operations, applications, and geometries before iterating fields. Use map lookups instead of per-field full-array `.filter()` scans. Invalid stored geometry adds an `unmappedFields` item with `{invalidGeometry:true,reason:'invalid-geometry'}`.

- [ ] **Step 5: Run GREEN**

```bash
node --test tests/p6-gis-import.test.js tests/p3-agricultural-map.test.js tests/p8-map-robustness.test.js
```

Expected: PASS including current P3 manual geometry and the 5,000-field fixture.

- [ ] **Step 6: Commit**

```bash
git add src/gis-import.js src/agricultural-map.js tests/p6-gis-import.test.js tests/p3-agricultural-map.test.js tests/p8-map-robustness.test.js
git commit -m "feat: harden GIS topology and large map snapshots"
```

---

### Task 6: Package-health UI and PWA-safe recovery guidance

**Files:**
- Modify: `web/ui/offline-maps.jsx`
- Modify: `web/ui/offline-maps.css` only for health/status styles
- Extend: `tests/p4-p5-field-offline.test.js`
- Extend: `tests/p8-map-robustness.test.js`

**Interfaces:**
- Consumes `provider.installed[].health` and `verifyFarmMap`.
- Desktop packages expose `Verificar integridade`.
- PWA/mobile leaves install/verify unavailable while field mode remains usable.

- [ ] **Step 1: Add RED UI contract test**

Add:

```js
test('P8 offline map UI exposes package health and explicit integrity verification',async()=>{
  const fs=await import('node:fs');
  const ui=fs.readFileSync(new URL('../web/ui/offline-maps.jsx',import.meta.url),'utf8');
  assert.match(ui,/verifyFarmMap/);
  assert.match(ui,/healthy/);
  assert.match(ui,/unverified/);
  assert.match(ui,/outdated/);
  assert.match(ui,/missing/);
  assert.match(ui,/corrupt/);
  assert.match(ui,/Verificar integridade/);
  assert.match(ui,/Somente no desktop Windows/);
});
```

- [ ] **Step 2: Run RED**

```bash
node --test tests/p4-p5-field-offline.test.js tests/p8-map-robustness.test.js
```

Expected: FAIL because no health UI/action exists.

- [ ] **Step 3: Implement health/error copy and verify action**

In `web/ui/offline-maps.jsx` add:

```js
const HEALTH_COPY=Object.freeze({healthy:{label:'Verificado',tone:'ok'},unverified:{label:'Não verificado',tone:'warning'},outdated:{label:'Atualização disponível',tone:'warning'},missing:{label:'Arquivo ausente',tone:'danger'},corrupt:{label:'Falha de integridade',tone:'danger'}});
const ERROR_COPY=Object.freeze({MAP_DISK_FULL:'Libere espaço em disco e tente novamente.',MAP_CATALOG_UNAVAILABLE:'Não foi possível atualizar o catálogo. Os mapas já instalados continuam disponíveis.',MAP_SOURCE_UNAVAILABLE:'A fonte do mapa está indisponível. Tente novamente quando houver conexão.',MAP_VERIFY_FAILED:'O pacote baixado não passou na verificação e não substituiu o mapa anterior.',MAP_PACKAGE_CORRUPT:'O mapa local falhou na verificação de integridade.',MAP_RECOVERY_FAILED:'Há uma atualização de mapa incompleta. O mapa anterior foi preservado quando possível.'});
```

Add:

```js
async function verify(item){
  setBusy(true);setMessage('');
  try{const result=await onRun('verifyFarmMap',{id:item.id});setMessage(result.health==='healthy'?'Integridade verificada.':HEALTH_COPY[result.health]?.label??'Verificação concluída.');await reload?.();}
  catch(error){setMessage(ERROR_COPY[error.code]??error.message);}
  finally{setBusy(false);}
}
```

Render one health badge per installed map and `Verificar integridade` only when `provider.available` is true. Preserve existing `Remover`, install, and catalog actions. Keep desktop actions unavailable in PWA/mobile.

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

### Task 7: P8 E2E isolation, CI, documentation, and release regression

**Files:**
- Create: `tests/e2e/p8-map-robustness.spec.mjs`
- Modify: `tooling/qa-web.mjs`
- Create: `.github/workflows/p8-map-robustness.yml`
- Modify: `PRODUCT_STATUS.md`
- Modify: `README.md` only if its capability summary still stops at P7
- Extend: `tests/p8-map-robustness.test.js`

**Interfaces:**
- `partitionE2eFiles()` requires P6, P7, and P8 specialized specs.
- `runQaWeb()` runs baseline P0-P5 -> P6 -> P7 -> P8 in fresh Playwright processes.
- P8 workflow runs Node 22, unit/contracts, web build, Chromium, P8 E2E, compatibility.

- [ ] **Step 1: Create browser fallback E2E**

Create `tests/e2e/p8-map-robustness.spec.mjs`:

```js
import {test,expect} from '@playwright/test';
async function enter(page){await page.goto('/');await page.getByTestId('password').fill('P8-Robustness-2026!');await page.getByTestId('auth-submit').click();await expect(page.getByText('ArtiSys Agro Lavoura').first()).toBeVisible();}

test('P8 keeps field mode available when desktop map provider is absent',async({page})=>{
  await enter(page);
  await page.getByTestId('nav-offline-maps').click();
  await expect(page.getByTestId('offline-maps-workspace')).toBeVisible();
  await expect(page.getByText('Somente no desktop Windows')).toBeVisible();
  await expect(page.getByRole('button',{name:'Baixar mapa desta fazenda'})).toBeDisabled();
  await page.getByTestId('nav-field-mode').click();
  await expect(page.getByTestId('field-mode-workspace')).toBeVisible();
});
```

- [ ] **Step 2: Add RED partition test**

Add:

```js
test('P8 keeps P6 P7 and P8 suites in separate Playwright processes',async()=>{
  const {partitionE2eFiles}=await import('../tooling/qa-web.mjs');
  const partitions=partitionE2eFiles(['full-surface.spec.mjs','p6-gis-import.spec.mjs','p7-satellite.spec.mjs','p8-map-robustness.spec.mjs']);
  assert.deepEqual(partitions.p6,['tests/e2e/p6-gis-import.spec.mjs']);
  assert.deepEqual(partitions.p7,['tests/e2e/p7-satellite.spec.mjs']);
  assert.deepEqual(partitions.p8,['tests/e2e/p8-map-robustness.spec.mjs']);
  assert.deepEqual(partitions.baseline,['tests/e2e/full-surface.spec.mjs']);
});
```

- [ ] **Step 3: Run RED**

```bash
node --test tests/p8-map-robustness.test.js
```

Expected: FAIL because P8 is not a required specialized suite.

- [ ] **Step 4: Extend `qa-web` isolation**

Change:

```js
const SPECIALIZED=Object.freeze(['p6-gis-import.spec.mjs','p7-satellite.spec.mjs','p8-map-robustness.spec.mjs']);
```

Return:

```js
p8:Object.freeze(['tests/e2e/p8-map-robustness.spec.mjs'])
```

and after P7:

```js
if(exitCode===0)exitCode=await runPlaywright(partitions.p8,'p8-map-robustness');
```

- [ ] **Step 5: Create P8 GitHub workflow**

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

- [ ] **Step 6: Update canonical status**

After local code/tests are green, add to `PRODUCT_STATUS.md`:

```md
- P8 robustez de mapas/GIS: recuperação de instalação interrompida, integridade SHA-256, saúde de pacote, cobertura multiestado completa, topologia de polígonos, degradação segura de geometria legada, snapshot indexado para grandes conjuntos e gate E2E isolado.
```

Update `README.md` only if its visible capability summary still stops at P7. Do not claim commercial certification until remote release gates pass.

- [ ] **Step 7: Run complete local verification**

```bash
npm test
npm run build:web
npx playwright test tests/e2e/p8-map-robustness.spec.mjs
npm run qa:web
npm run compat:contract
```

Expected: all PASS. `qa:web` logs `baseline-p0-p5`, `p6-gis`, `p7-satellite`, then `p8-map-robustness`.

- [ ] **Step 8: Commit**

```bash
git add tests/e2e/p8-map-robustness.spec.mjs tooling/qa-web.mjs .github/workflows/p8-map-robustness.yml PRODUCT_STATUS.md README.md tests/p8-map-robustness.test.js
git commit -m "ci: certify P8 map robustness"
```

- [ ] **Step 9: Require remote commercial gates on one exact HEAD**

Do not mark the implementation PR ready until the same exact HEAD has:

```text
P8 map robustness                         success
P0 hardening / Linux regression           success
P0 hardening / Windows release:certify    success + installer artifact
P1 architecture and operation             success
P2 agricultural product                   success
P6 GIS import                             success
P7 satellite                              success
```

P3/P4/P5 remain covered by `npm test`, baseline Playwright, and existing contracts/workflows.

- [ ] **Step 10: Whole-branch final verification**

```bash
npm test
npm run phase5
npm run compat:contract
```

Inspect GitHub Actions for the exact implementation HEAD. Confirm Windows `release:certify` produced the installer artifact. Any red gate blocks merge.

- [ ] **Step 11: Merge only after certification**

Merge the implementation PR after every required gate is green. Then verify `main` points to the expected merge commit and the push-triggered P0/P1/P2 workflows have started on the merge tree.
