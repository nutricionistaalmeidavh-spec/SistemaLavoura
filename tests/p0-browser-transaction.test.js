import test from 'node:test';
import assert from 'node:assert/strict';
import {MemoryStorage} from '../shared/vendor/release-modules/artisys-storage/src/browser.mjs';
import {createBrowserPersistence,createBrowserRecovery} from '../shared/packages/vertical-persistence/src/browser.js';

class FlakySnapshotStorage extends MemoryStorage{
  failNextList=true;
  async list(prefix=''){
    if(this.failNextList){this.failNextList=false;throw new Error('snapshot failed');}
    return super.list(prefix);
  }
}

test('browser command transaction restores the previous snapshot on failure',async()=>{
  const persistence=createBrowserPersistence({productId:'agro-lavoura',storage:new MemoryStorage()});
  try{
    assert.equal(typeof persistence.runInTransaction,'function');
    await assert.rejects(
      persistence.runInTransaction(async()=>{
        await persistence.putRecord('qa.browser','first',{value:1},{expectedVersion:0});
        await persistence.putRecord('qa.browser','second',{value:2},{expectedVersion:0});
        throw new Error('browser rollback');
      }),
      /browser rollback/
    );
    assert.equal(await persistence.getRecord('qa.browser','first'),null);
    assert.equal(await persistence.getRecord('qa.browser','second'),null);
  }finally{await persistence.close();}
});

test('browser transaction queue is released when snapshot creation fails',async()=>{
  const persistence=createBrowserPersistence({productId:'agro-lavoura',storage:new FlakySnapshotStorage()});
  try{
    await assert.rejects(persistence.runInTransaction(async()=>{}),/snapshot failed/);
    const second=persistence.runInTransaction(async()=>persistence.putRecord('qa.browser','after-failure',{value:1},{expectedVersion:0}));
    await Promise.race([
      second,
      new Promise((_,reject)=>setTimeout(()=>reject(new Error('transaction queue stuck')),250))
    ]);
    assert.ok(await persistence.getRecord('qa.browser','after-failure'));
  }finally{await persistence.close();}
});

test('browser restore keeps audit entries created after the selected backup',async()=>{
  const persistence=createBrowserPersistence({productId:'agro-lavoura',storage:new MemoryStorage()});
  const recovery=createBrowserRecovery(persistence,{productId:'agro-lavoura'});
  try{
    const collection='security-audit:agro-lavoura';
    await persistence.putRecord(collection,'audit-before',{id:'audit-before',action:'before'},{expectedVersion:0});
    await recovery.createBackup({id:'baseline'});
    await persistence.putRecord(collection,'audit-after',{id:'audit-after',action:'after'},{expectedVersion:0});
    await recovery.restoreBackup('baseline');
    assert.ok(await persistence.getRecord(collection,'audit-before'));
    assert.ok(await persistence.getRecord(collection,'audit-after'));
  }finally{await persistence.close();}
});
