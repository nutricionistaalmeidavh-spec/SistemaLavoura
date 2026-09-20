import React,{useMemo,useState} from 'react';
import {getUiContract,hydrateUiFields,referenceLabel} from './contracts.js';
import {DataTable,KpiStrip,Modal,PageHeader,StructuredForm,money,recordRows} from './primitives.jsx';

export function buildFinanceSummary(data={}){
  const rows=recordRows(data);
  const incomeMinor=rows.filter(item=>item.row.direction==='income').reduce((sum,item)=>sum+(Number(item.row.amountMinor)||0),0);
  const expenseMinor=rows.filter(item=>item.row.direction==='expense').reduce((sum,item)=>sum+(Number(item.row.amountMinor)||0),0);
  const resultMinor=incomeMinor-expenseMinor;
  const margin=incomeMinor>0?(resultMinor/incomeMinor)*100:0;
  return {rows,incomeMinor,expenseMinor,resultMinor,margin};
}

export function LavouraFinanceWorkspace({data,onRun}){
  const contract=getUiContract('finance');
  const references=data?.references??{};
  const summary=useMemo(()=>buildFinanceSummary(data),[data]);
  const budgetRows=Object.values(data?.commercial?.budget??{});const budgetMinor=budgetRows.reduce((sum,item)=>sum+(Number(item.budgetMinor)||0),0);const varianceMinor=budgetRows.reduce((sum,item)=>sum+(Number(item.varianceMinor)||0),0);
  const columns=useMemo(()=>[
    {key:'direction',label:'Tipo',render:row=><span className={`status-badge ${row.direction==='income'?'status-success':'status-warning'}`}>{row.direction==='income'?'Receita':'Despesa'}</span>},
    {key:'description',label:'Descrição'},
    {key:'field',label:'Talhão',render:row=>referenceLabel(references,'fieldOptions',row.allocation?.id)},
    {key:'season',label:'Safra',render:row=>referenceLabel(references,'seasonOptions',row.metadata?.seasonId)},
    {key:'amountMinor',label:'Valor',render:row=>money(row.amountMinor)}
  ],[references]);
  const [actionName,setActionName]=useState(null);
  const commercial=data?.commercial??{};const suppliers=commercial.suppliers??[],orders=commercial.purchaseOrders??[],sales=commercial.sales??[],deliveries=commercial.deliveries??[],storage=commercial.storageLots??[],requirements=commercial.requirements??[];
  const [busy,setBusy]=useState(false);
  async function submit(values){setBusy(true);try{let input=values;if(actionName==='createPurchaseOrder')input={...values,items:(values.itemsText??[]).map(line=>{const [inputId,quantity,unitCostMinor]=line.split('|').map(x=>x.trim());return{inputId,quantity:Number(quantity),unitCostMinor:Number(unitCostMinor)}})};if(actionName==='createSale')input={...values,unitPriceMinor:Math.round(Number(values.unitPrice||0)*100)};await onRun(actionName,input);setActionName(null);}finally{setBusy(false);}}
  const action=actionName?contract.actions[actionName]:null;
  const fields=useMemo(()=>hydrateUiFields(action?.fields??[],references),[action,references]);
  return <section className="product-workspace" data-testid="finance-workspace"><PageHeader eyebrow="Gestão" title="Financeiro" description="Acompanhe receitas, custos e resultado da produção agrícola; custos de operações entram automaticamente." actions={<><button type="button" className="primary-button" onClick={()=>setActionName('createSale')}>Nova venda</button><button type="button" onClick={()=>setActionName('createPurchaseOrder')}>Pedido de compra</button><button type="button" onClick={()=>setActionName('saveSupplier')}>Fornecedor</button><button type="button" onClick={()=>setActionName('receivePurchaseOrder')}>Receber pedido</button><button type="button" onClick={()=>setActionName('deliverSale')}>Registrar entrega</button><button type="button" onClick={()=>setActionName('addIncome')}>Receita manual</button><button type="button" onClick={()=>setActionName('addExpense')}>Nova despesa</button></>}/><KpiStrip items={[{label:'Receitas',value:money(summary.incomeMinor)},{label:'Despesas',value:money(summary.expenseMinor)},{label:'Resultado',value:money(summary.resultMinor)},{label:'Margem',value:`${summary.margin.toLocaleString('pt-BR',{maximumFractionDigits:1})}%`},{label:'Orçamento',value:money(budgetMinor)},{label:'Saldo orçamentário',value:money(varianceMinor)}]}/><DataTable columns={columns} rows={summary.rows} emptyTitle="Nenhum lançamento financeiro" emptyDescription="Registre receitas e despesas para acompanhar o resultado da safra."/><div className="settings-grid"><section className="workspace-panel"><div className="panel-heading"><div><span className="eyebrow">Compras</span><h3>Pedidos e fornecedores</h3></div><span>{orders.length} pedidos · {suppliers.length} fornecedores</span></div><div className="checklist-stack">{requirements.slice(0,8).map(x=><article className="checklist-card" key={x.inputId}><strong>{referenceLabel(references,'inputOptions',x.inputId)}</strong><small>Necessário {x.required} · disponível {x.available} · comprar {x.toBuy}</small></article>)}</div></section><section className="workspace-panel"><div className="panel-heading"><div><span className="eyebrow">Produção</span><h3>Armazenagem e vendas</h3></div><span>{storage.length} lotes</span></div><div className="checklist-stack">{sales.slice(0,8).map(x=><article className="checklist-card" key={x.id}><strong>{x.buyer}</strong><small>{x.quantity} {x.unit} · {money(x.quantity*x.unitPriceMinor)} · {deliveries.filter(d=>d.saleId===x.id).reduce((s,d)=>s+Number(d.quantity||0),0)} entregue</small></article>)}</div></section></div><Modal open={Boolean(action)} title={action?.label??'Lançamento'} description="Informe o valor normalmente em reais; a precisão monetária é tratada internamente." onClose={()=>setActionName(null)}><StructuredForm fields={fields} busy={busy} submitLabel={action?.label} onSubmit={submit} onCancel={()=>setActionName(null)}/></Modal></section>;
}
