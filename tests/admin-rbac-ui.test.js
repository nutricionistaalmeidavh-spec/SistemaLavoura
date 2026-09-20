import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createAgroShellModel} from '../src/ui.js';
import {SECURITY_POLICY,PRESENTATION_ACCESS} from '../src/security.js';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=relative=>fs.readFileSync(path.join(root,relative),'utf8');

test('administration stays outside the agricultural core contract and is protected by RBAC',()=>{
  const shell=createAgroShellModel();
  assert.equal(shell.navigation.some(item=>item.id==='admin'),false);
  assert.equal(PRESENTATION_ACCESS.screens.admin.read,'users:read');
  assert.equal(PRESENTATION_ACCESS.screens.admin.write,'users:write');
  assert.ok(SECURITY_POLICY.manager.includes('users:read'));
  assert.ok(SECURITY_POLICY.manager.includes('audit:read'));
  const contract=JSON.parse(read('qa/product-contract.json'));
  assert.equal(contract.screens.includes('admin'),false);
});

test('RPC backend exposes permission-filtered virtual administration through load and action',()=>{
  const source=read('runtime/backend.mjs');
  assert.match(source,/ADMIN_NAVIGATION/);
  assert.match(source,/ADMIN_SCREEN/);
  assert.match(source,/adminSnapshot/);
  assert.match(source,/screenId==='admin'/);
  for(const operation of ['createUser','setUserRoles','setUserActive','changePassword','listUsers','listAudit']){
    assert.match(source,new RegExp(operation),`backend is not wiring security.${operation}`);
  }
  assert.match(source,/describe\(auth/,'describe must support permission-filtered navigation');
});

test('administration UI exposes human controls for users permissions audit and password without raw JSON',()=>{
  assert.equal(fs.existsSync(path.join(root,'web/ui/admin.jsx')),true,'admin workspace missing');
  const source=read('web/ui/admin.jsx');
  for(const action of ['createUser','setUserRoles','setUserActive','changePassword'])assert.match(source,new RegExp(`onRun\\(['\"]${action}['\"]`));
  for(const label of ['Usuários','Papéis e permissões','Auditoria','Alterar minha senha'])assert.match(source,new RegExp(label));
  assert.doesNotMatch(source,/action-json|JSON de entrada/);
  const runtime=read('web/ui/runtime.jsx');
  assert.match(runtime,/LavouraAdminWorkspace/);
  assert.match(runtime,/admin:LavouraAdminWorkspace/);
  assert.match(runtime,/backend\.describe\(auth\)/);
  const primitives=read('web/ui/primitives.jsx');
  assert.match(primitives,/definition\.type==='password'/,'password fields must not render as plain text');
});

test('admin navigation has a dedicated icon instead of falling back to the product leaf',()=>{
  const source=read('web/ui/icons.jsx');
  assert.match(source,/shield:/);
});
