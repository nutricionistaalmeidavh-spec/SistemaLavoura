// P0 regression cases must fail on the pre-hardening implementation and pass only after the fixes.
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createStandaloneHost} from '../runtime/host.mjs';

async function withHost(work){
  const root=await mkdtemp(join(tmpdir(),'p0-lavoura-'));
  const host=await createStandaloneHost({dataDir:root});
  try{return await work(host);}finally{await host.close().catch(()=>{});await rm(root,{recursive:true,force:true}).catch(()=>{});}
}

async function bootstrapAdmin(host){
  await host.backend.bootstrap({username:'admin',password:'Admin-P0-2026!'});
  const logged=await host.backend.login({username:'admin',password:'Admin-P0-2026!'});
  return {sessionId:logged.session.id,token:logged.token};
}

async function createViewer(host,adminAuth){
  await host.presentation.services.security.createUser({
    ...adminAuth,
    user:{id:'viewer-p0',username:'viewer-p0',password:'Viewer-P0-2026!',roles:['viewer'],active:true}
  });
  const logged=await host.backend.login({username:'viewer-p0',password:'Viewer-P0-2026!'});
  return {sessionId:logged.session.id,token:logged.token};
}

test('viewer cannot load settings or restore backups',async()=>withHost(async host=>{
  const adminAuth=await bootstrapAdmin(host);
  const backup=await host.recovery.createBackup({id:'known-good'});
  const viewerAuth=await createViewer(host,adminAuth);
  await assert.rejects(()=>host.backend.load({screenId:'settings',auth:viewerAuth}),/permission denied/);
  await assert.rejects(()=>host.backend.action({screenId:'settings',action:'restore',input:{id:backup.id},auth:viewerAuth}),/permission denied/);
}));

test('field writes through backend enforce field domain invariants',async()=>withHost(async host=>{
  const auth=await bootstrapAdmin(host);
  await assert.rejects(()=>host.backend.action({screenId:'fields',action:'save',input:{id:'field-invalid'},auth}),/Field code is required/);
}));

test('season writes through backend enforce season domain invariants',async()=>withHost(async host=>{
  const auth=await bootstrapAdmin(host);
  await assert.rejects(()=>host.backend.action({screenId:'seasons',action:'save',input:{id:'season-invalid',productionPeriodId:'2026-27'},auth}),/Crop is required/);
}));

test('input writes through backend enforce input domain invariants',async()=>withHost(async host=>{
  const auth=await bootstrapAdmin(host);
  await assert.rejects(()=>host.backend.action({screenId:'inputs',action:'save',input:{id:'input-invalid',name:'Semente'},auth}),/Input unit is required/);
}));
