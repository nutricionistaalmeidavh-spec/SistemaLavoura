import test from 'node:test';
import assert from 'node:assert/strict';
import {createFileService} from '../src/files.js';
import {createCaptureService} from '../src/capture.js';
import {createChecklistService} from '../src/checklists.js';
import {createAgriculturalCatalog} from '../src/agricultural-catalog.js';
import {createFeatureFlags} from '../src/feature-flags.js';

const memoryPersistence=()=>{
  const collections=new Map();
  const bucket=name=>{if(!collections.has(name))collections.set(name,new Map());return collections.get(name);};
  return {
    async putRecord(collection,id,payload,{expectedVersion}={}){const b=bucket(collection),cur=b.get(id),version=cur?.version??0;if(expectedVersion!==undefined&&expectedVersion!==version)throw new Error('Version conflict');const record={collection,id,payload,version:version+1,createdAt:cur?.createdAt??new Date().toISOString(),updatedAt:new Date().toISOString()};b.set(id,record);return record;},
    async getRecord(collection,id){return bucket(collection).get(id)??null;},
    async listRecords(collection){return [...bucket(collection).values()];},
    async softDeleteRecord(collection,id){const b=bucket(collection),cur=b.get(id);if(!cur)throw new Error('not found');b.delete(id);return cur;}
  };
};

test('P2 files reject unsafe names and preserve SHA-256 metadata',async()=>{const p=memoryPersistence(),files=createFileService(p,{maxBytes:1024});await assert.rejects(()=>files.upload({id:'bad',name:'../bad.txt',mimeType:'text/plain',bytesBase64:'YQ=='}),/filename/i);const saved=await files.upload({id:'f1',name:'foto.txt',mimeType:'text/plain',bytesBase64:'b2s=',entityType:'field',entityId:'field-1'});assert.equal(saved.payload.size,2);assert.match(saved.payload.sha256,/^[0-9a-f]{64}$/);assert.equal((await files.download('f1')).bytesBase64,'b2s=');});

test('P2 capture is flag-aware and stores a linked file',async()=>{const p=memoryPersistence(),flags=createFeatureFlags(p,{defaults:{'capture.enabled':true}}),files=createFileService(p),capture=createCaptureService({persistence:p,files,flags});const record=await capture.capture({id:'cap-1',fileId:'file-1',name:'campo.jpg',mimeType:'image/jpeg',bytesBase64:'/9j/',entityType:'field',entityId:'field-1',source:'camera'});assert.equal(record.payload.fileId,'file-1');await flags.set('capture.enabled',false);await assert.rejects(()=>capture.capture({id:'cap-2',fileId:'file-2',name:'x.jpg',mimeType:'image/jpeg',bytesBase64:'/9j/'}),/disabled/i);});

test('P2 checklist refuses completion while required items are pending',async()=>{const p=memoryPersistence(),svc=createChecklistService(p);await svc.create({id:'cl-1',entityType:'operation',entityId:'op-1',title:'Inspeção',items:[{id:'i1',label:'EPI',required:true}]});await assert.rejects(()=>svc.complete('cl-1'),/required/i);await svc.setItem('cl-1','i1',{checked:true});const done=await svc.complete('cl-1');assert.equal(done.payload.status,'completed');});

test('P2 catalog validates entries and feature flags persist',async()=>{const p=memoryPersistence(),catalog=createAgriculturalCatalog(p),flags=createFeatureFlags(p);await assert.rejects(()=>catalog.upsert({id:'x',type:'unknown',name:'X'}),/type/i);const entry=await catalog.upsert({id:'soy',type:'crop',name:'Soja',active:true});assert.equal(entry.payload.type,'crop');await flags.set('pdf.enabled',false);assert.equal(await flags.enabled('pdf.enabled'),false);});
