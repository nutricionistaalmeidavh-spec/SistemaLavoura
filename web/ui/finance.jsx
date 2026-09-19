import React,{useMemo,useState} from 'react';
import {getUiContract} from './contracts.js';
import {DataTable,KpiStrip,Modal,PageHeader,StructuredForm,money,recordRows} from './primitives.jsx';

export function buildFinanceSummary(data={}){
  const rows=recordRows(data);
  const incomeMinor=rows.filter(item=>item.row.direction==='income').reduce((sum,item)=>sum+(Number(item.row.amountMinor)||0),0);
  const expenseMinor=rows.filter(item=>item.row.direction==='expense').reduce((sum,item)=>sum+(Number(item.row.amountMinor)||0),0);
  const resultMinor=incomeMinor-expenseMinor;
  const margin=incomeMinor>0?(resultMinor/incomeMinor)*100:0;
  return {rows,incomeMinor,expenseMinor,resultMinor,margin};
}

const columns=[
  {key:'direction',label:'Tipo',render:row=><span className={`status-badge ${row.direction==='income'?'status-success':'status-warning'}`}>{row.direction==='income'?'Receita':'Despesa'}</span>},
  {key:'description',label:'Descrição'},
  {key:'field',label:'Talhão',render:row=>row.allocation?.id??'—'},
  {key:'season',label:'Safra',render:row=>row.metadata?.seasonId??'—'},
  {key:'amountMinor',label:'Valor',render:row=>money(row.amountMinor)}
];

export function LavouraFinanceWorkspace({data,onRun}){
  const contract=getUiContract('finance');
  const summary=useMemo(()=>buildFinanceSummary(data),[data]);
  const [actionName,setActionName]=useState(null);
  const [busy,setBusy]=useState(false);
  async function submit(values){setBusy(true);try{await onRun(actionName,values);setActionName(null);}finally{setBusy(false);}}
  const action=actionName?contract.actions[actionName]:null;
  return <section className="product-workspace" data-testid="finance-workspace"><PageHeader eyebrow="Gestão" title="Financeiro" description="Acompanhe receitas, custos e resultado da produção agrícola." actions={<><button type="button" className="primary-button" onClick={()=>setActionName('addIncome')}>Nova receita</button><button type="button" onClick={()=>setActionName('addExpense')}>Nova despesa</button></>}/><KpiStrip items={[{label:'Receitas',value:money(summary.incomeMinor)},{label:'Despesas',value:money(summary.expenseMinor)},{label:'Resultado',value:money(summary.resultMinor)},{label:'Margem',value:`${summary.margin.toLocaleString('pt-BR',{maximumFractionDigits:1})}%`}]}/><DataTable columns={columns} rows={summary.rows} emptyTitle="Nenhum lançamento financeiro" emptyDescription="Registre receitas e despesas para acompanhar o resultado da safra."/><Modal open={Boolean(action)} title={action?.label??'Lançamento'} description="Valores são armazenados em centavos para preservar precisão." onClose={()=>setActionName(null)}><StructuredForm fields={action?.fields??[]} busy={busy} submitLabel={action?.label} onSubmit={submit} onCancel={()=>setActionName(null)}/></Modal></section>;
}
