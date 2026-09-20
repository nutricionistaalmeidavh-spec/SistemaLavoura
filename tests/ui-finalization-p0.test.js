import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createStandaloneHost} from '../runtime/host.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=relative=>fs.readFileSync(path.join(root,relative),'utf8');

async function withHost(work){
  const dataDir=await mkdtemp(join(tmpdir(),'agro-lavoura-ui-final-'));
  const host=await createStandaloneHost({dataDir});
  try{return await work(host);}finally{
    await host.close().catch(()=>{});
    await rm(dataDir,{recursive:true,force:true}).catch(()=>{});
  }
}

async function admin(host){
  const password='Ui-Final-P0-2026!';
  await host.backend.bootstrap({username:'ui-final-admin',password});
  const logged=await host.backend.login({username:'ui-final-admin',password});
  return {sessionId:logged.session.id,token:logged.token};
}

test('field attachments expose a safe download action through the authenticated backend',async()=>withHost(async host=>{
  const auth=await admin(host);
  await host.backend.action({screenId:'fields',action:'uploadFile',auth,input:{id:'file-ui-final',name:'receituario.txt',mimeType:'text/plain',bytesBase64:'Y29udGV1ZG8=',entityId:'field-ui-final'}});
  const result=await host.backend.action({screenId:'fields',action:'downloadFile',auth,input:{id:'file-ui-final'}});
  assert.equal(result.name,'receituario.txt');
  assert.equal(result.mimeType,'text/plain');
  assert.equal(result.bytesBase64,'Y29udGV1ZG8=');
}));

test('fields UI offers a real browser download for selected attachments',()=>{
  const source=read('web/ui/fields.jsx');
  assert.match(source,/onRun\(['\"]downloadFile['\"]/);
  assert.match(source,/downloadBase64File/);
  assert.match(source,/>Baixar</);
});

test('reports UI turns CSV, PDF and generic exports into downloadable files',()=>{
  const source=read('web/ui/reports.jsx');
  assert.match(source,/downloadTextFile/);
  assert.match(source,/downloadBinaryFile/);
  assert.match(source,/downloadExportResult/);
  assert.match(source,/Gerar e baixar CSV/);
  assert.match(source,/Gerar e baixar PDF/);
  assert.match(source,/Exportar e baixar/);
});

test('finance UI accepts human selections and reais instead of technical IDs or cents',()=>{
  const source=read('web/ui/finance.jsx');
  assert.match(source,/supplierOptions/);
  assert.match(source,/purchaseOrderOptions/);
  assert.match(source,/saleOptions/);
  assert.match(source,/inputOptions/);
  assert.match(source,/Custo unitário \(R\$\)/);
  assert.doesNotMatch(source,/ID do insumo/);
  assert.doesNotMatch(source,/centavos/);
});

test('catalog UI generates technical IDs internally instead of asking the user',()=>{
  const source=read('web/ui/settings.jsx');
  assert.doesNotMatch(source,/\{name:['\"]id['\"],label:['\"]ID['\"]/);
  assert.match(source,/catalog-/);
  assert.match(source,/randomUUID/);
});
