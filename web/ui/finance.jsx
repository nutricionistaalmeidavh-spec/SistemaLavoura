import React,{useMemo,useState} from 'react';
import {getUiContract,hydrateUiFields,referenceLabel} from './contracts.js';
import {DataTable,KpiStrip,Modal,PageHeader,StructuredForm,money,recordRows} from './primitives.jsx';

const fold=value=>String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLocaleLowerCase('pt-BR');
const numeric=value=>{const raw=String(value??'').trim().replace(/R\$/gi,'').replace(/\s/g,'');const normalized=raw.includes(',')?raw.replace(/\./g,'').replace(',','.'):raw;const number=Number(normalized);if(!Number.isFinite(number))throw new TypeError(`Valor inválido: ${value}`);return number;};
const bareInputLabel=value=>String(value??'').replace(/\s*\([^)]*\)\s*$/,'').trim();

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
  const commercial=data?.commercial??{};
  const suppliers=commercial.suppliers??[],orders=commercial.purchaseOrders??[],sales=commercial.sales??[],deliveries=commercial.deliveries??[],storage=commercial.storageLots??[],requirements=commercial.requirements??[];
  const inputOptions=references.inputOptions??[];
  const supplierOptions=suppliers.map(item=>({value:item.id,label:item.name||item.document||'Fornecedor'}));
  const supplierById=new Map(suppliers.map(item=>[String(item.id),item]));
  const purchaseOrderOptions=orders.filter(item=>item.status!=='received').map((item,index)=>({value:item.id,label:`Pedido ${index+1} · ${supplierById.get(String(item.supplierId))?.name??'Fornecedor'} · ${item.status??'aberto'}`}));
  const saleOptions=sales.map(item=>({value:item.id,label:`${item.buyer||'Venda'} · ${Number(item.quantity??0).toLocaleString('pt-BR')} ${item.unit??''}`}));
  const financeReferences={...references,inputOptions,supplierOptions,purchaseOrderOptions,saleOptions};
  const [busy,setBusy]=useState(false);

  const action=actionName?contract.actions[actionName]:null;
  const fields=useMemo(()=>{
    if(!action)return [];
    if(actionName==='createPurchaseOrder')return [
      {name:'supplierId',label:'Fornecedor',type:'select',required:true,options:supplierOptions},
      {name:'seasonId',label:'Safra',type:'select',options:references.seasonOptions??[]},
      {name:'itemsText',label:'Itens do pedido',type:'lines',required:true,help:'Um por linha: Insumo | quantidade | Custo unitário (R$). Ex.: Glifosato | 10 | 25,90'}
    ];
    if(actionName==='receivePurchaseOrder')return [{name:'id',label:'Pedido de compra',type:'select',required:true,options:purchaseOrderOptions},{name:'warehouse',label:'Armazém',type:'text',required:true}];
    if(actionName==='deliverSale')return [{name:'saleId',label:'Venda',type:'select',required:true,options:saleOptions},{name:'quantity',label:'Quantidade entregue',type:'number',min:0.0001,required:true},{name:'reference',label:'Romaneio/Referência',type:'text'}];
    return hydrateUiFields(action.fields??[],financeReferences);
  },[action,actionName,financeReferences,purchaseOrderOptions,references.seasonOptions,saleOptions,supplierOptions]);

  async function submit(values){
    setBusy(true);try{
      let input=values;
      if(actionName==='createPurchaseOrder'){
        const items=(values.itemsText??[]).map((line,index)=>{
          const [inputName,quantityText,unitCostText]=String(line).split('|').map(part=>part.trim());
          if(!inputName||!quantityText||!unitCostText)throw new Error(`Item ${index+1}: use Insumo | quantidade | custo unitário.`);
          const option=inputOptions.find(item=>fold(item.value)===fold(inputName)||fold(item.label)===fold(inputName)||fold(bareInputLabel(item.label))===fold(inputName));
          if(!option)throw new Error(`Item ${index+1}: insumo "${inputName}" não encontrado.`);
          const quantity=numeric(quantityText),unitCost=numeric(unitCostText);
          if(quantity<=0||unitCost<0)throw new Error(`Item ${index+1}: quantidade e custo devem ser válidos.`);
          return {inputId:String(option.value),quantity,unitCostMinor:Math.round(unitCost*100)};
        });
        input={supplierId:values.supplierId,seasonId:values.seasonId||null,items};
      }
      if(actionName==='createSale')input={...values,unitPriceMinor:Math.round(Number(values.unitPrice||0)*100)};
      await onRun(actionName,input);setActionName(null);
    }finally{setBusy(false);}
  }

  return <section className="product-workspace" data-testid="finance-workspace"><PageHeader eyebrow="Gestão" title="Financeiro" description="Acompanhe receitas, custos e resultado da produção agrícola; custos de operações entram automaticamente." actions={<><button type="button" className="primary-button" onClick={()=>setActionName('createSale')}>Nova venda</button><button type="button" onClick={()=>setActionName('createPurchaseOrder')}>Pedido de compra</button><button type="button" onClick={()=>setActionName('saveSupplier')}>Fornecedor</button><button type="button" onClick={()=>setActionName('receivePurchaseOrder')}>Receber pedido</button><button type="button" onClick={()=>setActionName('deliverSale')}>Registrar entrega</button><button type="button" onClick={()=>setActionName('addIncome')}>Receita manual</button><button type="button" onClick={()=>setActionName('addExpense')}>Nova despesa</button></>}/><KpiStrip items={[{label:'Receitas',value:money(summary.incomeMinor)},{label:'Despesas',value:money(summary.expenseMinor)},{label:'Resultado',value:money(summary.resultMinor)},{label:'Margem',value:`${summary.margin.toLocaleString('pt-BR',{maximumFractionDigits:1})}%`},{label:'Orçamento',value:money(budgetMinor)},{label:'Saldo orçamentário',value:money(varianceMinor)}]}/><DataTable columns={columns} rows={summary.rows} emptyTitle="Nenhum lançamento financeiro" emptyDescription="Registre receitas e despesas para acompanhar o resultado da safra."/><div className="settings-grid"><section className="workspace-panel"><div className="panel-heading"><div><span className="eyebrow">Compras</span><h3>Pedidos e fornecedores</h3></div><span>{orders.length} pedidos · {suppliers.length} fornecedores</span></div><div className="checklist-stack">{requirements.slice(0,8).map(x=><article className="checklist-card" key={x.inputId}><strong>{referenceLabel(references,'inputOptions',x.inputId)}</strong><small>Necessário {x.required} · disponível {x.available} · comprar {x.toBuy}</small></article>)}</div></section><section className="workspace-panel"><div className="panel-heading"><div><span className="eyebrow">Produção</span><h3>Armazenagem e vendas</h3></div><span>{storage.length} lotes</span></div><div className="checklist-stack">{sales.slice(0,8).map(x=><article className="checklist-card" key={x.id}><strong>{x.buyer}</strong><small>{x.quantity} {x.unit} · {money(x.quantity*x.unitPriceMinor)} · {deliveries.filter(d=>d.saleId===x.id).reduce((s,d)=>s+Number(d.quantity||0),0)} entregue</small></article>)}</div></section></div><Modal open={Boolean(action)} title={action?.label??'Lançamento'} description="Informe valores normalmente em reais; identificadores técnicos são resolvidos internamente." onClose={()=>setActionName(null)}><StructuredForm fields={fields} busy={busy} submitLabel={action?.label} onSubmit={submit} onCancel={()=>setActionName(null)}/></Modal></section>;
}
