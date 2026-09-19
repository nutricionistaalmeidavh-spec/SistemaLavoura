import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { openProductPersistence } from '../shared/packages/vertical-persistence/src/index.js';
import { createAgroLavouraPresentation, createField, createCropSeason } from '../src/index.js';

test('standalone repository persists Lavoura data in real SQLite and reopens it', async () => {
  const root=await mkdtemp(join(tmpdir(),'artisys-lavoura-standalone-'));
  const dbPath=join(root,'artisys-safras-talhoes.sqlite');
  const sql=await readFile(new URL('../migrations/001-initial.sql',import.meta.url),'utf8');
  let persistence=await openProductPersistence({dbPath,productId:'agro-lavoura',migrations:[{id:'agro-lavoura/001-initial.sql',sql}]});
  let presentation=createAgroLavouraPresentation({persistence});
  await presentation.action('fields','save',createField({id:'field-1',code:'T01',name:'Talhão 01',farmUnitId:'farm-1',areaHa:20}));
  await presentation.action('seasons','save',createCropSeason({id:'season-1',crop:'soja',productionPeriodId:'2026-27',fieldIds:['field-1']}));
  await persistence.close();

  persistence=await openProductPersistence({dbPath,productId:'agro-lavoura',migrations:[{id:'agro-lavoura/001-initial.sql',sql}]});
  presentation=createAgroLavouraPresentation({persistence});
  const fields=await presentation.load('fields');
  const seasons=await presentation.load('seasons');
  assert.equal(fields.rows[0].payload.name,'Talhão 01');
  assert.equal(seasons.rows[0].payload.crop,'soja');
  await persistence.close();
});

test('standalone manifest keeps zero-cost core and product identity', async () => {
  const manifest=JSON.parse(await readFile(new URL('../vertical.manifest.json',import.meta.url),'utf8'));
  assert.equal(manifest.id,'agro-lavoura');
  assert.equal(manifest.corePolicy.selfHosted,true);
  assert.equal(manifest.corePolicy.openSourceCore,true);
  assert.deepEqual(manifest.corePolicy.requiredPaidServices,[]);
});
