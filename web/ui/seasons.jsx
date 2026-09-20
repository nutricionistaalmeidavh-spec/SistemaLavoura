import React,{useMemo,useState} from 'react';
import {getUiContract,hydrateUiFields,referenceLabel} from './contracts.js';
import {DataTable,Modal,PageHeader,StructuredForm,money,recordRows} from './primitives.jsx';

export function LavouraSeasonsWorkspace({data,onRun}){
  const contract=getUiContract('seasons');
  const rows=useMemo(()=>recordRows(data),[data]);
  const references=data?.references??{};
  const fields=useMemo(()=>hydrateUiFields(contract.actions.save.fields,references),[contract,references]);
  const [selected,setSelected]=useState(null);
  const [open,setOpen]=useState(false);
  const [busy,setBusy]=useState(false);
  const selectedRow=selected?.row??null;
  const columns=useMemo(()=>[
    {key:'crop',label:'Cultura'},
    {key:'productionPeriodId',label:'Safra/Período',render:row=>row.periodName??row.productionPeriodId},
    {key:'varietyName',label:'Cultivar',render:row=>row.varietyName??'—'},
    {key:'cycleDays',label:'Ciclo',render:row=>row.cycleDays?`${row.cycleDays} dias`:'—'},
    {key:'fieldIds',label:'Talhões',render:row=>(row.fieldIds??[]).map(id=>referenceLabel(references,'fieldOptions',id)).join(', ')||'—'},
    {key:'budgetMinor',label:'Orçamento',render:row=>row.budgetMinor==null?'—':money(row.budgetMinor)}
  ],[references]);
  const initialValues=selectedRow?{...selectedRow,periodName:selectedRow.periodName??selectedRow.productionPeriodId,budget:selectedRow.budgetMinor==null?'':Number(selectedRow.budgetMinor)/100}:{};
  async function save(values){setBusy(true);try{await onRun('save',{...values,...(selectedRow?{id:selectedRow.id,varietyId:selectedRow.varietyName===values.varietyName?selectedRow.varietyId:null}:{})});setOpen(false);setSelected(null);}finally{setBusy(false);}}
  return <section className="product-workspace" data-testid="seasons-workspace"><PageHeader eyebrow="Produção" title="Safras" description="Organize cultura, cultivar, ciclo, período e talhões vinculados." actions={<><button type="button" className="primary-button" onClick={()=>{setSelected(null);setOpen(true);}}>Nova safra</button>{selected?<button type="button" onClick={()=>setOpen(true)}>Editar</button>:null}</>}/><DataTable columns={columns} rows={rows} selectedId={selectedRow?.id??null} onSelect={item=>setSelected(current=>current?.row?.id===item.row.id?null:item)} emptyTitle="Nenhuma safra cadastrada" emptyDescription="Cadastre uma safra para relacionar operações, custos e colheita."/><Modal open={open} title={selected?'Editar safra':'Nova safra'} description="IDs internos são gerados automaticamente." onClose={()=>setOpen(false)}><StructuredForm fields={fields} initialValues={initialValues} busy={busy} onSubmit={save} onCancel={()=>setOpen(false)}/></Modal></section>;
}
