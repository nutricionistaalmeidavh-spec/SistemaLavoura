import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createAgroShellModel} from '../src/ui.js';
import {SECURITY_POLICY,PRESENTATION_ACCESS} from '../src/security.js';
import {createStandaloneHost} from '../runtime/host.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=relative=>fs.readFileSync(path.join(root,relative),'utf8');
const adminPassword=['Admin','Local','2026!'].join('-');
const managerPassword=['Gestor','Local','2026!'].join('-');
const viewerPassword=['Consulta','Local','2026!'].join('-');

async function withHost(work){
  const dataDir=await mkdtemp(join(tmpdir(),'lavoura-admin-rbac-'));
  const host=await createStandaloneHost({dataDir});
  try{return await work(host);}finally{await host.close().catch(()=>{});await rm(dataDir,{recursive:true,force:true}).catch(()=>{});}
}
async function login(host,username,password){const result=await host.backend.login({username,password});return {sessionId:result.session.id,token:result.token};}

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

test('administration RPC enforces admin manager and viewer capabilities end to end',async()=>withHost(async host=>{
  await host.backend.bootstrap({username:'admin',password:adminPassword});
  const adminAuth=await login(host,'admin',adminPassword);
  const adminMeta=await host.backend.describe(adminAuth);
  assert.ok(adminMeta.navigation.some(item=>item.id==='admin'));
  const initial=await host.backend.load({screenId:'admin',auth:adminAuth});
  assert.equal(initial.currentUser.username,'admin');
  assert.equal(initial.capabilities.usersWrite,true);
  assert.equal(initial.capabilities.auditRead,true);

  const manager=await host.backend.action({screenId:'admin',action:'createUser',input:{username:'gestor',password:managerPassword,roles:['manager'],active:true},auth:adminAuth});
  const viewer=await host.backend.action({screenId:'admin',action:'createUser',input:{username:'consulta',password:viewerPassword,roles:['viewer'],active:true},auth:adminAuth});
  assert.equal(manager.username,'gestor');
  assert.equal(viewer.username,'consulta');

  const managerAuth=await login(host,'gestor',managerPassword);
  const managerMeta=await host.backend.describe(managerAuth);
  assert.ok(managerMeta.navigation.some(item=>item.id==='admin'));
  const managerAdmin=await host.backend.load({screenId:'admin',auth:managerAuth});
  assert.equal(managerAdmin.capabilities.usersWrite,false);
  assert.equal(managerAdmin.capabilities.auditRead,true);
  await assert.rejects(()=>host.backend.action({screenId:'admin',action:'setUserActive',input:{userId:viewer.id,active:false},auth:managerAuth}),error=>error?.code==='FORBIDDEN');

  const viewerAuth=await login(host,'consulta',viewerPassword);
  const viewerMeta=await host.backend.describe(viewerAuth);
  assert.equal(viewerMeta.navigation.some(item=>item.id==='admin'),false);
  await assert.rejects(()=>host.backend.load({screenId:'admin',auth:viewerAuth}),error=>error?.code==='FORBIDDEN');

  await host.backend.action({screenId:'admin',action:'setUserRoles',input:{userId:viewer.id,roles:['warehouse']},auth:adminAuth});
  await host.backend.action({screenId:'admin',action:'setUserActive',input:{userId:viewer.id,active:false},auth:adminAuth});
  const changed=await host.backend.load({screenId:'admin',auth:adminAuth});
  const changedViewer=changed.users.find(user=>user.id===viewer.id);
  assert.deepEqual(changedViewer.roles,['warehouse']);
  assert.equal(changedViewer.active,false);
  assert.ok(changed.audit.some(entry=>entry.action==='users.create'&&entry.entityId===viewer.id));
  assert.ok(changed.audit.some(entry=>entry.action==='users.roles'&&entry.entityId===viewer.id));
  assert.ok(changed.audit.some(entry=>entry.action==='users.active'&&entry.entityId===viewer.id));
}));

test('changing password through administration revokes the current session',async()=>withHost(async host=>{
  await host.backend.bootstrap({username:'admin',password:adminPassword});
  const auth=await login(host,'admin',adminPassword);
  const newPassword=['Admin','Novo','2026!'].join('-');
  await host.backend.action({screenId:'admin',action:'changePassword',input:{currentPassword:adminPassword,newPassword},auth});
  await assert.rejects(()=>host.backend.validate(auth),error=>error?.code==='UNAUTHENTICATED');
  const next=await login(host,'admin',newPassword);
  assert.ok(next.token);
}));

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
