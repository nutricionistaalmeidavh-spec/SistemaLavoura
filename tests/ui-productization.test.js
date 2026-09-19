import test from 'node:test';
import assert from 'node:assert/strict';
import { createAgroShellModel, agroTheme } from '../src/ui.js';

test('UI-0 exposes semantic Lavoura surface and elevation tokens', () => {
  assert.equal(agroTheme.background, '#F4F7F4');
  assert.equal(agroTheme.surface, '#FFFFFF');
  assert.equal(agroTheme.surfaceSubtle, '#F8FAF8');
  assert.equal(agroTheme.surfaceAccent, '#EDF6EF');
  assert.equal(agroTheme.border, '#E1E8E2');
  assert.equal(agroTheme.radiusCard, '18px');
  assert.match(agroTheme.shadowCard, /rgba\(/);
  assert.match(agroTheme.shadowFloating, /rgba\(/);
});

test('UI-1 navigation keeps functional ids while exposing product groups', () => {
  const shell=createAgroShellModel();
  assert.deepEqual(shell.navigation.map(item=>item.id),['overview','fields','seasons','operations','inputs','harvest','inventory','finance','reports','settings']);
  assert.deepEqual(shell.navigation.map(item=>item.group),[
    'Visão geral',
    'Produção','Produção','Produção','Produção','Produção',
    'Gestão','Gestão','Gestão',
    'Sistema'
  ]);
});
