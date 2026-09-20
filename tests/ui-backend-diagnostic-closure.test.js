import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {getUiContract} from '../web/ui/contracts.js';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=relative=>fs.readFileSync(path.join(root,relative),'utf8');

test('reports summary contract exposes only human product choices',()=>{
  const fields=getUiContract('reports').actions.summary.fields;
  assert.deepEqual(fields.map(field=>field.name),['groupBy','metric','calculation']);
  assert.ok(fields.every(field=>field.type==='select'));
  const surface=JSON.stringify(fields);
  assert.match(surface,/Tipo de relatório/);
  assert.match(surface,/Formato/);
  assert.match(surface,/Período de emissão/);
  assert.match(surface,/Quantidade de documentos/);
  assert.match(surface,/Tamanho dos arquivos/);
  assert.match(surface,/Total/);
  assert.match(surface,/Média/);
  assert.match(surface,/Quantidade de registros/);
  assert.doesNotMatch(surface,/groupField|valueField/);
});

test('finance contract matches the human selectors and reais used by the specialized UI',()=>{
  const actions=getUiContract('finance').actions;
  assert.equal(actions.createPurchaseOrder.fields[0].type,'select');
  assert.equal(actions.createPurchaseOrder.fields[0].optionsKey,'supplierOptions');
  assert.equal(actions.receivePurchaseOrder.fields[0].type,'select');
  assert.equal(actions.receivePurchaseOrder.fields[0].optionsKey,'purchaseOrderOptions');
  assert.equal(actions.deliverSale.fields[0].type,'select');
  assert.equal(actions.deliverSale.fields[0].optionsKey,'saleOptions');
  const surface=JSON.stringify(actions);
  assert.match(surface,/Custo unitário \(R\$\)/);
  assert.doesNotMatch(surface,/ID do insumo|centavos/);
});

test('catalog contract no longer asks for technical identifiers',()=>{
  const fields=getUiContract('settings').actions.upsertCatalog.fields;
  assert.deepEqual(fields.map(field=>field.name),['type','name','unit','category','active']);
  assert.doesNotMatch(JSON.stringify(fields),/\"name\":\"id\"|\"label\":\"ID\"|\"name\":\"kind\"/);
});

test('settings UI renders human feature names instead of raw flag keys',()=>{
  const source=read('web/ui/settings.jsx');
  assert.match(source,/featureFlagLabel/);
  assert.doesNotMatch(source,/<strong>\{key\}<\/strong>/);
  for(const label of ['Captura de arquivos','Anexos e arquivos','Relatórios em PDF','Checklists operacionais','Catálogo agrícola'])assert.match(source,new RegExp(label));
});

test('reports UI translates human summary choices before calling the generic backend summary',()=>{
  const source=read('web/ui/reports.jsx');
  assert.match(source,/buildReportSummaryRequest/);
  assert.doesNotMatch(source,/onRun\('summary',\{rows,\.\.\.values\}\)/);
});
