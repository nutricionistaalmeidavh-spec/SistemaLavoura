import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {createIoTRepository} from '../src/iot/repository.js';
import {createDevice,createDeviceCommand} from '../src/iot/domain.js';

const migration=readFileSync(fileURLToPath(new URL('../migrations/002-iot.sql',import.meta.url)),'utf8');

test('IoT repository persists command lifecycle in the same SQLite database',()=>{
  const db=new DatabaseSync(':memory:');db.exec('PRAGMA foreign_keys=ON;');db.exec(migration);
  const repo=createIoTRepository(db);
  repo.saveDevice(createDevice({id:'pump-1',name:'Bomba 1',type:'pump',protocol:'mock'}));
  const pending=createDeviceCommand({id:'cmd-1',deviceId:'pump-1',command:'start',payload:{zone:'A'},requestedBy:'u1',requestedAt:'2026-09-19T20:00:00Z',expiresAt:'2026-09-19T20:05:00Z'});
  repo.saveCommand(pending);
  assert.equal(repo.getCommand('cmd-1').status,'pending');
  repo.saveCommand({...pending,status:'sent'});
  repo.saveCommand({...pending,status:'acknowledged',acknowledgedAt:'2026-09-19T20:01:00.000Z'});
  const stored=repo.getCommand('cmd-1');
  assert.equal(stored.status,'acknowledged');
  assert.deepEqual(stored.payload,{zone:'A'});
  assert.deepEqual(repo.listCommands({deviceId:'pump-1'}).map(x=>x.id),['cmd-1']);
  db.close();
});
