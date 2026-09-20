import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {getUiContract} from '../web/ui/contracts.js';
import {buildReportSummaryRequest} from '../web/ui/report-summary.js';

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

test('human report summary choices translate to the generic reporting contract',()=>{
  const request=buildReportSummaryRequest([
    {row:{type:'season-summary',title:'Resumo 1',format:'pdf',issuedAt:'2026-09-20T12:00:00.000Z',size:2048}},
    {row:{type:'traceability',title:'Rastreabilidade',format:'csv',issuedAt:'2026-09-21T12:00:00.000Z',size:1024}}
  ],{groupBy:'period',metric:'sizeKb',calculation:'total'},{'season-summary':{title:'Resumo da safra'},traceability:{title:'Rastreabilidade'}});
  assert.equal(request.groupField,'period');
  assert.equal(request.valueField,'sizeKb');
  assert.equal(request.op,'sum');
  assert.deepEqual(request.rows.map(row=>row.period),['09/2026','09/2026']);
  assert.deepEqual(request.rows.map(row=>row.sizeKb),[2,1]);
  assert.equal(request.rows[0].reportType,'Resumo da safra');
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

test('reports UI renders grouped summary results for the user',()=>{
  const source=read('web/ui/reports.jsx');
  assert.match(source,/summary-result-list/);
  assert.match(source,/Object\.entries\(lastResult\.result\)/);
  assert.match(source,/formatReportSummaryValue/);
});
