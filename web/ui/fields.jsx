import React,{useMemo,useState} from 'react';
import {getUiContract,hydrateUiFields,referenceLabel} from './contracts.js';
import {ConfirmDialog,DataTable,Modal,PageHeader,StructuredForm,fileToBase64,recordRows,unwrapRecord} from './primitives.jsx';
import {downloadBase64File} from './downloads.js';
import {AgriculturalMapPanel} from './agricultural-map.jsx';

const areaNameOf=(references,id)=>{const label=referenceLabel(references,'areaOptions',id);return label.includes(' · ')?label.split(' · ').slice(1).join(' · '):(id?label:'');};
const MAP_POINT_FIELDS=Object.freeze([
  {name:'kind',label:'Tipo',type:'select',required:true,options:[{value:'sensor',label:'Sensor / pluviômetro'},{value:'machine',label:'Máquina'},{value:'storage',label:'Armazém / silo'},{value:'sampling',label:'Ponto de amostragem'}]},
  {name:'name',label:'Nome',type:'text',required:true,placeholder:'Ex.: Pluviômetro 01'},
  {name:'latitude',label:'Latitude',type:'number',required:true,step:'any'},
  {name:'longitude',label:'Longitude',type:'number',required:true,step:'any'},
  {name:'fieldId',label:'Talhão',type:'select',required:false,optionsKey:'fieldOptions'},
  {name:'notes',label:'Observações',type:'textarea',required:false}
]);

export function LavouraFieldsWorkspace({data,onRun}){
  const contract=getUiContract('fields');
  const rows=useMemo(()=>recordRows(data),[data]);
  const references=data?.references??{};
  const files=useMemo(()=>(data?.files??[]).map(raw=>({raw,row:unwrapRecord(raw),version:raw?.version??null})),[data]);
  const map=data&&data.map?data.map:null;
  const mapPoints=data?.mapPoints??[];
  const [selected,setSelected]=useState(null);
  const [formOpen,setFormOpen]=useState(false);
  const [deleteOpen,setDeleteOpen]=useState(false);
  const [fileOpen,setFileOpen]=useState(false);const [extraAction,setExtraAction]=useState(null);
  const [pointOpen,setPointOpen]=useState(false);
  const [busy,setBusy]=useState(false);
  const selectedRow=selected?.row??null;
  const selectedFiles=selectedRow?files.filter(item=>item.row.entityId===selectedRow.id):[];
  const totalArea=rows.reduce((sum,item)=>sum+(Number(item.row.areaHa)||0),0);
  const columns=useMemo(()=>[
    {key:'code',label:'Código'},
    {key:'name',label:'Talhão'},
    {key:'areaHa',label:'Área (ha)'},
    {key:'farmUnitId',label:'Fazenda',render:row=>referenceLabel(references,'farmUnitOptions',row.farmUnitId)},
    {key:'areaGroupId',label:'Área/Setor',render:row=>row.areaGroupId?areaNameOf(references,row.areaGroupId):'—'}
  ],[references]);
  const initialValues=selectedRow?{...selectedRow,farmUnitName:referenceLabel(references,'farmUnitOptions',selectedRow.farmUnitId),areaName:selectedRow.areaGroupId?areaNameOf(references,selectedRow.areaGroupId):''}:{};

  async function save(values){
    setBusy(true);try{
      const payload={...values,...(selectedRow?{id:selectedRow.id}:{})};
      if(selectedRow&&values.farmUnitName===referenceLabel(references,'farmUnitOptions',selectedRow.farmUnitId))payload.farmUnitId=selectedRow.farmUnitId;
      if(selectedRow&&selectedRow.areaGroupId&&values.areaName===areaNameOf(references,selectedRow.areaGroupId))payload.areaGroupId=selectedRow.areaGroupId;
      await onRun('save',payload);setFormOpen(false);setSelected(null);
    }finally{setBusy(false);}
  }
  async function remove(){if(!selectedRow)return;setBusy(true);try{await onRun('remove',{id:selectedRow.id,...(selected.version!=null?{expectedVersion:selected.version}:{})});setDeleteOpen(false);setSelected(null);}finally{setBusy(false);}}
  async function upload(values){if(!selectedRow)throw new Error('Selecione um talhão.');const file=values.file;if(!(file instanceof File))throw new Error('Selecione um arquivo.');setBusy(true);try{await onRun('uploadFile',{id:globalThis.crypto?.randomUUID?.()??`file-${Date.now()}`,name:file.name,mimeType:file.type||'application/octet-stream',bytesBase64:await fileToBase64(file),entityId:selectedRow.id});setFileOpen(false);}finally{setBusy(false);}}
  async function runExtra(values){setBusy(true);try{await onRun(extraAction,values);setExtraAction(null);}finally{setBusy(false);}}
  async function saveMapPoint(values){setBusy(true);try{await onRun('saveMapPoint',values);setPointOpen(false);}finally{setBusy(false);}}
  async function removeFile(item){if(!globalThis.confirm?.(`Excluir o arquivo ${item.row.name}?`))return;await onRun('removeFile',{id:item.row.id});}
  function openPoint(fieldId=null){if(fieldId){const item=rows.find(candidate=>String(candidate.row.id)===String(fieldId));if(item)setSelected(item);}setPointOpen(true);}

  return <section className="product-workspace" data-testid="fields-workspace">
    <PageHeader eyebrow="Produção" title="Talhões" description="Organize fazendas, áreas produtivas, talhões e documentos vinculados." actions={<><button type="button" onClick={()=>{setSelected(null);setFormOpen(true);}}>Novo talhão</button><button type="button" onClick={()=>openPoint(selectedRow?.id??null)}>Novo ponto no mapa</button>{selectedRow?<button type="button" onClick={()=>setFormOpen(true)}>Editar</button>:null}{selectedRow?<button type="button" onClick={()=>setFileOpen(true)}>Anexar arquivo</button>:null}{selectedRow?<button type="button" onClick={()=>setExtraAction('saveGeometry')}>Mapa/GIS</button>:null}{selectedRow?<button type="button" onClick={()=>setExtraAction('addScouting')}>Monitoramento</button>:null}{selectedRow?<button type="button" className="danger-ghost" onClick={()=>setDeleteOpen(true)}>Excluir</button>:null}</>}/>
    <div className="workspace-kpis"><article className="workspace-kpi"><span>Talhões</span><strong>{rows.length}</strong></article><article className="workspace-kpi"><span>Área cadastrada</span><strong>{totalArea.toLocaleString('pt-BR',{maximumFractionDigits:2})} ha</strong></article><article className="workspace-kpi"><span>Arquivos</span><strong>{files.length}</strong></article><article className="workspace-kpi"><span>Pontos georreferenciados</span><strong>{mapPoints.length}</strong></article></div>
    <AgriculturalMapPanel map={map} onAddPoint={openPoint}/>
    <DataTable columns={columns} rows={rows} selectedId={selectedRow?.id??null} onSelect={item=>setSelected(current=>current?.row?.id===item.row.id?null:item)} emptyTitle="Nenhum talhão cadastrado" emptyDescription="Cadastre o primeiro talhão para iniciar o planejamento agrícola."/>
    {selectedRow?<section className="workspace-panel"><div className="panel-heading"><div><span className="eyebrow">Talhão selecionado</span><h3>{selectedRow.name}</h3></div><span>{selectedRow.areaHa} ha</span></div><div className="attachment-grid">{selectedFiles.length?selectedFiles.map(item=><article className="attachment-card" key={item.row.id}><div><strong>{item.row.name}</strong><small>{item.row.mimeType} · {Math.max(1,Math.round((item.row.size??0)/1024))} KB</small></div><div className="context-actions"><button type="button" onClick={()=>downloadBase64File(item.row)}>Baixar</button><button type="button" className="danger-ghost" onClick={()=>removeFile(item)}>Excluir</button></div></article>):<p className="muted">Nenhum arquivo anexado a este talhão.</p>}</div></section>:null}
    <Modal open={formOpen} title={selectedRow?'Editar talhão':'Novo talhão'} description="A identificação técnica é gerada automaticamente." onClose={()=>setFormOpen(false)}><StructuredForm fields={contract.actions.save.fields} initialValues={initialValues} busy={busy} submitLabel={selectedRow?'Salvar alterações':'Criar talhão'} onSubmit={save} onCancel={()=>setFormOpen(false)}/></Modal>
    <Modal open={fileOpen} title="Anexar arquivo" description={selectedRow?`Vincular arquivo a ${selectedRow.name}.`:null} onClose={()=>setFileOpen(false)}><StructuredForm fields={contract.actions.uploadFile.fields} busy={busy} submitLabel="Anexar" onSubmit={upload} onCancel={()=>setFileOpen(false)}/></Modal>
    <Modal open={pointOpen} title="Adicionar ponto no mapa" description="A coordenada fica salva localmente e pode ser usada sem internet." onClose={()=>setPointOpen(false)}><StructuredForm fields={hydrateUiFields(MAP_POINT_FIELDS,references)} initialValues={selectedRow?{fieldId:selectedRow.id}:{}} busy={busy} submitLabel="Salvar ponto" onSubmit={saveMapPoint} onCancel={()=>setPointOpen(false)}/></Modal>
    <Modal open={Boolean(extraAction)} title={contract.actions[extraAction]?.label??'Ação agrícola'} onClose={()=>setExtraAction(null)}><StructuredForm fields={hydrateUiFields(contract.actions[extraAction]?.fields??[],references)} initialValues={selectedRow?{fieldId:selectedRow.id}:{}} busy={busy} submitLabel={contract.actions[extraAction]?.label} onSubmit={runExtra} onCancel={()=>setExtraAction(null)}/></Modal><ConfirmDialog open={deleteOpen} title="Excluir talhão" description={selectedRow?`O talhão ${selectedRow.name} será removido.`:''} confirmLabel="Excluir talhão" onCancel={()=>setDeleteOpen(false)} onConfirm={remove}/>
  </section>;
}
