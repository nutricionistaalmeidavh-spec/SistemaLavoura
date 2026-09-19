import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=relative=>fs.readFileSync(path.join(root,relative),'utf8');

const expectedScreenIds=['fields','seasons','operations','inputs','harvest','inventory','finance','reports','settings'];
const expectedKinds=['table-form','workflow','inventory','finance','reports','settings'];

test('UI contracts cover every non-dashboard screen without raw-json fields', async()=>{
  const module=await import('../web/ui/contracts.js');
  assert.equal(typeof module.getUiContract,'function');
  for(const screenId of expectedScreenIds){
    const contract=module.getUiContract(screenId);
    assert.ok(contract,`missing UI contract for ${screenId}`);
    assert.equal(contract.screenId,screenId);
    const serialized=JSON.stringify(contract);
    assert.doesNotMatch(serialized,/raw-json|json-textarea|action-json/i);
  }
});

test('Product Runtime registers specialized renderers for every product screen kind',()=>{
  const runtime=read('web/ui/runtime.jsx');
  for(const kind of expectedKinds)assert.match(runtime,new RegExp(`${kind.replace('-','\\-')}`));
  assert.doesNotMatch(runtime,/function ActionPanel|JSON de entrada|data-testid="action-json"/);
});

test('dedicated workspace files exist for UI 4 through UI 10',()=>{
  for(const relative of [
    'web/ui/fields.jsx','web/ui/simple-table-form.jsx','web/ui/seasons.jsx','web/ui/operations.jsx',
    'web/ui/inventory.jsx','web/ui/finance.jsx','web/ui/reports.jsx','web/ui/settings.jsx','web/ui/primitives.jsx'
  ]) assert.equal(fs.existsSync(path.join(root,relative)),true,`${relative} missing`);
});

test('all structured workspaces remain presentation-only and call onRun',()=>{
  for(const relative of [
    'web/ui/fields.jsx','web/ui/simple-table-form.jsx','web/ui/seasons.jsx','web/ui/operations.jsx',
    'web/ui/inventory.jsx','web/ui/finance.jsx','web/ui/reports.jsx','web/ui/settings.jsx'
  ]){
    const source=read(relative);
    assert.match(source,/onRun/);
    assert.doesNotMatch(source,/createAgroLavouraPresentation|putRecord|runInTransaction/);
  }
});
