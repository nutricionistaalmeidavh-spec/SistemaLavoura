import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createStandaloneHost} from '../runtime/host.mjs';

const password='Qa-P0-Commands-2026!';

async function withHost(work){
  const root=await mkdtemp(join(tmpdir(),'agro-lavoura-p0-command-'));
  const host=await createStandaloneHost({dataDir:root});
  try{return await work(host);}finally{await host.close().catch(()=>{});await rm(root,{recursive:true,force:true}).catch(()=>{});}
}

async function adminSession(host){
  await host.backend.bootstrap({username:'p0-admin',password});
  const logged=await host.backend.login({username:'p0-admin',password});
  return {sessionId:logged.session.id,token:logged.token};
}

test('command transaction rolls back every write when the command fails',async()=>withHost(async host=>{
  assert.equal(typeof host.persistence.runInTransaction,'function');
  await assert.rejects(
    host.persistence.runInTransaction(async()=>{
      await host.persistence.putRecord('qa.command','first',{value:1},{expectedVersion:0});
      await host.persistence.putRecord('qa.command','second',{value:2},{expectedVersion:0});
      throw new Error('force rollback');
    }),
    /force rollback/
  );
  assert.equal(await host.persistence.getRecord('qa.command','first'),null);
  assert.equal(await host.persistence.getRecord('qa.command','second'),null);
}));

test('business actions are audited as command attempt and success or failure',async()=>withHost(async host=>{
  const auth=await adminSession(host);
  await host.backend.action({
    screenId:'fields',action:'save',auth,
    input:{id:'field-audit',code:'AUD-01',name:'Talhão Auditado',farmUnitId:'farm-1',areaHa:12}
  });
  await assert.rejects(
    host.backend.action({screenId:'fields',action:'save',auth,input:{id:'field-invalid'}}),
    /Field code is required/
  );
  const security=host.presentation.services.security;
  const success=await security.listAudit({...auth,action:'fields.save:success'});
  const failure=await security.listAudit({...auth,action:'fields.save:failure'});
  const attempts=await security.listAudit({...auth,action:'fields.save:attempt'});
  assert.equal(success.length,1);
  assert.equal(failure.length,1);
  assert.equal(attempts.length,2);
  assert.equal(success[0].entityType,'fields');
  assert.equal(success[0].entityId,'field-audit');
}));
