import test from 'node:test';
import assert from 'node:assert/strict';
import { createAgroShellModel, agroTheme } from '../src/ui.js';

test('standalone Lavoura preserves approved navigation and palette', () => {
  const shell=createAgroShellModel();
  assert.equal(shell.brand.name,'ArtiSys Agro Lavoura');
  assert.equal(agroTheme.primary,'#24513B');
  assert.deepEqual(shell.navigation.map(item=>item.id),['overview','fields','seasons','operations','inputs','harvest','inventory','finance','reports','settings']);
});
