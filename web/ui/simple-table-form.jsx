import React,{useMemo,useState} from 'react';
import {getUiContract} from './contracts.js';
import {DataTable,Modal,PageHeader,StructuredForm,recordRows} from './primitives.jsx';

const defaultColumns={
  inputs:[{key:'name',label:'Insumo'},{key:'category',label:'Categoria'},{key:'unit',label:'Unidade'},{key:'unitCostMinor',label:'Custo unitário'}],
  harvest:[{key:'harvestedAt',label:'Data'},{key:'fieldId',label:'Talhão'},{key:'quantity',label:'Quantidade'},{key:'unit',label:'Unidade'},{key:'yieldPerHa',label:'Produtividade/ha'}]
};

export function LavouraSimpleTableFormWorkspace({screenId,data,onRun}){
  const contract=getUiContract(screenId);
  const rows=useMemo(()=>recordRows(data),[data]);
  const actionName=screenId==='harvest'?'create':'save';
  const action=contract?.actions?.[actionName];
  const [open,setOpen]=useState(false);
  const [busy,setBusy]=useState(false);
  async function submit(values){setBusy(true);try{await onRun(actionName,values);setOpen(false);}finally{setBusy(false);}}
  return <section className="product-workspace" data-testid={`${screenId}-workspace`}><PageHeader eyebrow="Produção" title={contract?.title??screenId} description={screenId==='inputs'?'Cadastre insumos usados nas operações e no estoque.':'Registre lotes colhidos e produtividade realizada.'} actions={<button type="button" className="primary-button" onClick={()=>setOpen(true)}>{screenId==='inputs'?'+ Novo insumo':'+ Registrar colheita'}</button>}/><DataTable columns={defaultColumns[screenId]??[]} rows={rows} emptyTitle={screenId==='inputs'?'Nenhum insumo cadastrado':'Nenhuma colheita registrada'}/><Modal open={open} title={action?.label??'Novo registro'} description="Preencha os dados abaixo." onClose={()=>setOpen(false)}><StructuredForm fields={action?.fields??[]} busy={busy} onSubmit={submit} onCancel={()=>setOpen(false)}/></Modal></section>;
}
