import test from 'node:test';
import assert from 'node:assert/strict';
import {MemoryStorage} from '../shared/vendor/release-modules/artisys-storage/src/browser.mjs';
import {createBrowserPersistence} from '../shared/packages/vertical-persistence/src/browser.js';

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
