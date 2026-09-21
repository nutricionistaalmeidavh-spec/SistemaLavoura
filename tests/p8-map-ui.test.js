import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const ui=()=>fs.readFileSync(new URL('../web/ui/offline-maps.jsx',import.meta.url),'utf8');

test('P8 offline map UI exposes package health and explicit integrity verification',()=>{
  const source=ui();
  assert.match(source,/verifyFarmMap/);
  assert.match(source,/healthy/);
  assert.match(source,/unverified/);
  assert.match(source,/outdated/);
  assert.match(source,/missing/);
  assert.match(source,/corrupt/);
  assert.match(source,/Verificar integridade/);
  assert.match(source,/Somente no desktop Windows/);
});

test('P8 offline map UI maps stable manager errors to actionable Portuguese guidance',()=>{
  const source=ui();
  for(const code of ['MAP_DISK_FULL','MAP_CATALOG_UNAVAILABLE','MAP_SOURCE_UNAVAILABLE','MAP_VERIFY_FAILED','MAP_PACKAGE_CORRUPT','MAP_RECOVERY_FAILED'])assert.match(source,new RegExp(code));
});