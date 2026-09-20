import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {SCREEN_UI_CONTRACTS} from '../web/ui/contracts.js';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=relative=>fs.readFileSync(path.join(root,relative),'utf8');
const exists=relative=>fs.existsSync(path.join(root,relative));

test('E2E surface contract covers every agricultural UI contract action plus virtual user surfaces',()=>{
  assert.equal(exists('qa/e2e-surface-contract.json'),true,'missing qa/e2e-surface-contract.json');
  const contract=JSON.parse(read('qa/e2e-surface-contract.json'));
  for(const [screenId,screen] of Object.entries(SCREEN_UI_CONTRACTS)){
    assert.ok(contract.screens.includes(screenId),`screen ${screenId} missing from E2E contract`);
    assert.deepEqual(new Set(contract.actions[screenId]??[]),new Set(Object.keys(screen.actions)),`actions for ${screenId} are incomplete`);
  }
  for(const screenId of ['overview','admin','iot'])assert.ok(contract.screens.includes(screenId),`virtual screen ${screenId} missing`);
  assert.deepEqual(new Set(contract.journeys),new Set(['agricultural-chain','administration-rbac','inventory-lifecycle','purchase-lifecycle']));
});

test('browser journeys and successful-run visual evidence are part of the release suite',()=>{
  for(const file of [
    'tests/e2e/agricultural-journey.spec.mjs',
    'tests/e2e/admin-journey.spec.mjs',
    'tests/e2e/inventory-journey.spec.mjs',
    'tests/e2e/purchase-journey.spec.mjs',
    'tests/e2e/evidence-helpers.mjs'
  ]) assert.equal(exists(file),true,`${file} missing`);
  const config=read('playwright.config.mjs');
  assert.match(config,/outputDir:\s*['\"]qa-artifacts\/playwright-results['\"]/);
  const fullSurface=read('tests/e2e/full-surface.spec.mjs');
  assert.match(fullSurface,/e2e-surface-contract\.json/);
  assert.match(fullSurface,/captureStep/);
});

test('journey specs capture named screenshots after user actions',()=>{
  for(const file of [
    'tests/e2e/agricultural-journey.spec.mjs',
    'tests/e2e/admin-journey.spec.mjs',
    'tests/e2e/inventory-journey.spec.mjs',
    'tests/e2e/purchase-journey.spec.mjs'
  ]){
    assert.equal(exists(file),true,`${file} missing`);
    const source=read(file);
    assert.match(source,/captureStep\(/,`${file} must capture visual evidence`);
    assert.match(source,/getByTestId\(['\"]nav-/,`${file} must navigate through the visible UI`);
  }
});
