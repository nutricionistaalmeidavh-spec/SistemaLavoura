import test from 'node:test';
import assert from 'node:assert/strict';
import { createField, createCropSeason, recordInputApplication, recordHarvest } from '../src/index.js';

test('field and crop season remain valid after standalone extraction', () => {
  const field = createField({ id:'f1', code:'T01', name:'Talhão 01', farmUnitId:'farm-1', areaHa:35.5 });
  const season = createCropSeason({ id:'s1', crop:'soybean', productionPeriodId:'p1', fieldIds:[field.id] });
  assert.equal(season.fieldIds[0], 'f1');
});

test('input application and harvest preserve source references', () => {
  const application = recordInputApplication({ id:'i1', seasonId:'s1', fieldId:'f1', catalogItemId:'seed-soy', quantity:20, unit:'bag', appliedAt:'2026-10-01' });
  const harvest = recordHarvest({ id:'h1', seasonId:'s1', fieldId:'f1', quantity:180000, unit:'kg', harvestedAt:'2027-02-10' });
  assert.equal(application.catalogItemId, 'seed-soy');
  assert.equal(harvest.quantity, 180000);
});
