import React,{useMemo,useState} from 'react';
import {getUiContract} from './contracts.js';
import {DataTable,Modal,PageHeader,StructuredForm,recordRows} from './primitives.jsx';

const columns=[
  {key:'crop',label:'Cultura'},
  {key:'productionPeriodId',label:'Período'},
  {key:'fieldIds',label:'Talhões',render:row=>(row.fieldIds??[]).join(', ')||'—'},
  {key:'id',label:'ID'}
];

export function LavouraSeasonsWorkspace({data,onRun}){
  const contract=getUiContract('seasons');
  const rows=useMemo(()=>recordRows(data),[data]);
  const [selected,setSelected]=useState(null);
  const [open,setOpen]=useState(false);
  const [busy,setBusy]=useState(false);
  async function save(values){setBusy(true);try{await onRun('save',values);setOpen(false);setSelected(null);}finally{setBusy(false);}}
  return <section className="product-workspace" data-testid="seasons-workspace"><PageHeader eyebrow="Produção" title="Safras" description="Organize culturas, períodos produtivos e talhões vinculados." actions={<><button type="button" className="primary-button" onClick={()=>{setSelected(null);setOpen(true);}}>Nova safra</button>{selected?<button type="button" onClick={()=>setOpen(true)}>Editar</button>:null}</>}/><DataTable columns={columns} rows={rows} selectedId={selected?.row?.id??null} onSelect={item=>setSelected(current=>current?.row?.id===item.row.id?null:item)} emptyTitle="Nenhuma safra cadastrada" emptyDescription="Cadastre uma safra para relacionar operações, custos e colheita."/><Modal open={open} title={selected?'Editar safra':'Nova safra'} description="Defina a cultura e o período de produção." onClose={()=>setOpen(false)}><StructuredForm fields={contract.actions.save.fields} initialValues={selected?.row??{}} busy={busy} onSubmit={save} onCancel={()=>setOpen(false)}/></Modal></section>;
}
