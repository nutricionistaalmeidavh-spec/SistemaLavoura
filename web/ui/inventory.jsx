import React,{useMemo,useState} from 'react';
import {getUiContract,hydrateUiFields,referenceLabel} from './contracts.js';
import {DataTable,KpiStrip,Modal,PageHeader,StructuredForm,dateTime} from './primitives.jsx';

export function buildInventoryRows(data={}){
  const state=data?.state??{};
  return Object.values(state).map(item=>({row:{...item,available:(Number(item.onHand)||0)-(Number(item.reserved)||0)}})).sort((a,b)=>String(a.row.sku).localeCompare(String(b.row.sku)));
}

export function LavouraInventoryWorkspace({data,onRun}){
  const contract=getUiContract('inventory');
  const references=data?.references??{};
  const rows=useMemo(()=>buildInventoryRows(data),[data]);
  const events=Array.isArray(data?.events)?data.events:[];
  const columns=useMemo(()=>[
    {key:'sku',label:'Insumo',render:row=>referenceLabel(references,'inputOptions',row.sku)},
    {key:'onHand',label:'Em estoque'},
    {key:'reserved',label:'Reservado'},
    {key:'available',label:'Disponível'},
    {key:'status',label:'Status',render:row=><span className={`status-badge ${row.available<=0?'status-danger':row.available<10?'status-warning':'status-success'}`}>{row.available<=0?'Sem saldo':row.available<10?'Atenção':'Disponível'}</span>}
  ],[references]);
  const [actionName,setActionName]=useState(null);
  const [busy,setBusy]=useState(false);
  const lowStock=rows.filter(item=>item.row.available<10).length;
  const total=rows.reduce((sum,item)=>sum+(Number(item.row.onHand)||0),0);
  async function submit(values){setBusy(true);try{await onRun(actionName,values);setActionName(null);}finally{setBusy(false);}}
  const action=actionName?contract.actions[actionName]:null;
  const fields=useMemo(()=>hydrateUiFields(action?.fields??[],references),[action,references]);
  return <section className="product-workspace" data-testid="inventory-workspace"><PageHeader eyebrow="Gestão" title="Estoque" description="Controle entradas, saídas e disponibilidade dos insumos; operações concluídas fazem a baixa automaticamente." actions={<><button type="button" className="primary-button" onClick={()=>setActionName('receive')}>Registrar entrada</button><button type="button" onClick={()=>setActionName('consume')}>Registrar saída</button><button type="button" onClick={()=>setActionName('physicalCount')}>Contagem física</button><button type="button" onClick={()=>setActionName('transfer')}>Transferir</button></>}/><KpiStrip items={[{label:'Itens com saldo',value:rows.length},{label:'Quantidade em estoque',value:total.toLocaleString('pt-BR')},{label:'Estoque baixo',value:lowStock},{label:'Movimentações',value:events.length}]}/><DataTable columns={columns} rows={rows} emptyTitle="Estoque vazio" emptyDescription="Registre uma entrada para começar o controle de insumos."/>{events.length?<section className="workspace-panel"><div className="panel-heading"><div><span className="eyebrow">Rastreabilidade</span><h3>Movimentações recentes</h3></div><span>{events.length} eventos</span></div><div className="movement-list">{events.slice(-8).reverse().map(event=><article key={event.id}><div><strong>{referenceLabel(references,'inputOptions',event.sku)}</strong><span>{event.kind==='in'?'Entrada':'Saída'} · {event.quantity}</span></div><small>{dateTime(event.occurredAt)}</small></article>)}</div></section>:null}<Modal open={Boolean(action)} title={action?.label??'Movimentação'} description="A movimentação será registrada no histórico local." onClose={()=>setActionName(null)}><StructuredForm fields={fields} busy={busy} submitLabel={action?.label} onSubmit={submit} onCancel={()=>setActionName(null)}/></Modal></section>;
}
