import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=relative=>fs.readFileSync(path.join(root,relative),'utf8');

test('fields UI offers a real browser download for selected attachments',()=>{
  const source=read('web/ui/fields.jsx');
  assert.match(source,/downloadBase64File/);
  assert.match(source,/downloadBase64File\(item\.row\)/);
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

test('download helpers are centralized and revoke object URLs',()=>{
  const source=read('web/ui/downloads.js');
  assert.match(source,/createObjectURL/);
  assert.match(source,/revokeObjectURL/);
  assert.match(source,/downloadBase64File/);
  assert.match(source,/downloadTextFile/);
  assert.match(source,/downloadBinaryFile/);
  assert.match(source,/downloadExportResult/);
});
