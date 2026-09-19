import React,{useMemo,useState} from 'react';
import {getUiContract} from './contracts.js';
import {DataTable,Modal,PageHeader,StructuredForm,dateTime,recordRows} from './primitives.jsx';

const issuedColumns=[
  {key:'title',label:'Documento'},
  {key:'format',label:'Formato'},
  {key:'issuedAt',label:'Emitido em',render:row=>dateTime(row.issuedAt)},
  {key:'size',label:'Tamanho',render:row=>row.size!=null?`${Math.max(1,Math.round(row.size/1024))} KB`:'—'},
  {key:'sha256',label:'Integridade',render:row=>row.sha256?`${row.sha256.slice(0,12)}…`:'—'}
];

function parseCsv(content,columns){
  const lines=String(content??'').split(/\r?\n/).filter(Boolean);if(lines.length<2)return [];
  const split=line=>{const out=[];let value='',quoted=false;for(let i=0;i<line.length;i++){const char=line[i];if(char==='"'){if(quoted&&line[i+1]==='"'){value+='"';i++;}else quoted=!quoted;}else if(char===','&&!quoted){out.push(value);value='';}else value+=char;}out.push(value);return out;};
  const headers=split(lines[0]);return lines.slice(1).map(line=>Object.fromEntries(split(line).map((value,index)=>[headers[index]??columns[index],value])));
}

export function LavouraReportsWorkspace({data,onRun}){
  const contract=getUiContract('reports');
  const definitions=data?.definitions??{};
  const issuedRows=useMemo(()=>recordRows(data?.issued??[]),[data]);
  const types=Object.entries(definitions);
  const [selectedType,setSelectedType]=useState(types[0]?.[0]??'season-summary');
  const [busy,setBusy]=useState(false);
  const [lastResult,setLastResult]=useState(null);
  const [dialog,setDialog]=useState(null);

  async function generateCsv(type=selectedType){setBusy(true);try{const result=await onRun('csv',{type});setLastResult({kind:'csv',type,result});return result;}finally{setBusy(false);}}
  async function generatePdf(){setBusy(true);try{const csv=await onRun('csv',{type:selectedType});const columns=definitions[selectedType]?.columns??[];const rows=parseCsv(csv?.content,columns);const result=await onRun('pdf',{type:selectedType,title:definitions[selectedType]?.title,rows});setLastResult({kind:'pdf',type:selectedType,result});}finally{setBusy(false);}}
  async function issue(){if(!lastResult)throw new Error('Gere um documento antes de emitir.');const result=lastResult.result;await onRun('issue',{id:`doc-${Date.now()}`,type:lastResult.type,format:lastResult.kind,content:result.content,title:result.title??definitions[lastResult.type]?.title});setLastResult(null);}
  async function runDialog(values){setBusy(true);try{if(dialog==='summary'){const rows=issuedRows.map(item=>item.row);const result=await onRun('summary',{rows,...values});setLastResult({kind:'summary',type:selectedType,result});}else if(dialog==='export'){const rows=issuedRows.map(item=>item.row);const result=await onRun('export',{rows,...values});setLastResult({kind:'export',type:selectedType,result});}setDialog(null);}finally{setBusy(false);}}

  return <section className="product-workspace" data-testid="reports-workspace"><PageHeader eyebrow="Gestão" title="Relatórios" description="Gere documentos a partir dos dados persistidos e acompanhe emissões." actions={<><button type="button" onClick={()=>setDialog('summary')}>Resumo das emissões</button><button type="button" onClick={()=>setDialog('export')}>Exportar histórico</button></>}/><div className="report-catalog">{types.map(([type,definition])=><button type="button" key={type} className={`report-card ${selectedType===type?'selected':''}`} onClick={()=>setSelectedType(type)}><span className="eyebrow">Relatório</span><strong>{definition.title}</strong><small>{(definition.columns??[]).length} campos</small></button>)}</div><section className="workspace-panel report-actions-panel"><div className="panel-heading"><div><span className="eyebrow">Documento selecionado</span><h3>{definitions[selectedType]?.title??selectedType}</h3></div></div><div className="context-actions"><button type="button" className="primary-button" disabled={busy} onClick={()=>generateCsv()}>Gerar CSV</button><button type="button" disabled={busy} onClick={generatePdf}>Gerar PDF</button>{lastResult&&['csv','pdf'].includes(lastResult.kind)?<button type="button" disabled={busy} onClick={issue}>Emitir documento</button>:null}</div>{lastResult?<div className="generated-result"><strong>Resultado pronto</strong><span>{lastResult.kind.toUpperCase()} · {lastResult.result?.rowCount??lastResult.result?.size??'gerado'}</span>{typeof lastResult.result?.content==='string'?<textarea readOnly rows={5} value={lastResult.result.content}/>:null}</div>:null}</section><section className="workspace-panel"><div className="panel-heading"><div><span className="eyebrow">Histórico</span><h3>Documentos emitidos</h3></div><span>{issuedRows.length}</span></div><DataTable columns={issuedColumns} rows={issuedRows} emptyTitle="Nenhum documento emitido" emptyDescription="Gere e emita um relatório para formar o histórico local."/></section><Modal open={Boolean(dialog)} title={dialog==='summary'?'Resumir emissões':'Exportar histórico'} onClose={()=>setDialog(null)}><StructuredForm fields={dialog==='summary'?contract.actions.summary.fields:contract.actions.export.fields} busy={busy} onSubmit={runDialog} onCancel={()=>setDialog(null)}/></Modal></section>;
}
