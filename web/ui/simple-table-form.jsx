import React,{useMemo,useState} from 'react';
import {getUiContract,hydrateUiFields,referenceLabel} from './contracts.js';
import {DataTable,Modal,PageHeader,StructuredForm,money,recordRows} from './primitives.jsx';

export function LavouraSimpleTableFormWorkspace({screenId,data,onRun}){
  const contract=getUiContract(screenId);
  const references=data?.references??{};
  const rows=useMemo(()=>recordRows(data),[data]);
  const actionName=screenId==='harvest'?'create':'save';
  const action=contract?.actions?.[actionName];
  const fields=useMemo(()=>hydrateUiFields(action?.fields??[],references),[action,references]);
  const columns=useMemo(()=>screenId==='inputs'?
    [{key:'name',label:'Insumo'},{key:'category',label:'Categoria'},{key:'unit',label:'Unidade'},{key:'unitCostMinor',label:'Custo unitário',render:row=>row.unitCostMinor==null?'—':money(row.unitCostMinor)},{key:'brand',label:'Marca',render:row=>row.brand??'—'}]:
    [{key:'harvestedAt',label:'Data',render:row=>row.harvestedAt?new Date(row.harvestedAt).toLocaleDateString('pt-BR'):'—'},{key:'fieldId',label:'Talhão',render:row=>referenceLabel(references,'fieldOptions',row.fieldId)},{key:'quantity',label:'Quantidade'},{key:'unit',label:'Unidade'},{key:'yieldPerHa',label:'Produtividade/ha',render:row=>Number(row.yieldPerHa||0).toLocaleString('pt-BR',{maximumFractionDigits:2})}],
    [screenId,references]);
  const [open,setOpen]=useState(false);
  const [busy,setBusy]=useState(false);
  async function submit(values){setBusy(true);try{await onRun(actionName,values);setOpen(false);}finally{setBusy(false);}}
  return <section className="product-workspace" data-testid={`${screenId}-workspace`}><PageHeader eyebrow="Produção" title={contract?.title??screenId} description={screenId==='inputs'?'Cadastre insumos com unidade e custo para uso automático nas operações e no estoque.':'Registre lotes colhidos e produtividade realizada.'} actions={<button type="button" className="primary-button" onClick={()=>setOpen(true)}>{screenId==='inputs'?'+ Novo insumo':'+ Registrar colheita'}</button>}/><DataTable columns={columns} rows={rows} emptyTitle={screenId==='inputs'?'Nenhum insumo cadastrado':'Nenhuma colheita registrada'}/><Modal open={open} title={action?.label??'Novo registro'} description="A identificação técnica é gerada automaticamente." onClose={()=>setOpen(false)}><StructuredForm fields={fields} busy={busy} onSubmit={submit} onCancel={()=>setOpen(false)}/></Modal></section>;
}
