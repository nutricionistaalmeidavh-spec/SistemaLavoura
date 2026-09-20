import React,{useEffect,useMemo,useState} from 'react';
import {normalizeFormValues} from './contracts.js';

export const unwrapRecord=value=>value?.payload??value??{};
export const recordRows=data=>{
  const source=Array.isArray(data)?data:data?.rows??data?.records??[];
  return source.map(raw=>({raw,row:unwrapRecord(raw),version:raw?.version??null}));
};
export const money=minor=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format((Number(minor)||0)/100);
export const dateTime=value=>{if(!value)return '—';const date=new Date(value);return Number.isFinite(date.getTime())?new Intl.DateTimeFormat('pt-BR',{dateStyle:'short',timeStyle:'short'}).format(date):String(value);};
export const statusLabel=value=>({planned:'Planejada','in-progress':'Em andamento',completed:'Concluída',cancelled:'Cancelada',active:'Ativo',inactive:'Inativo',dismissed:'Dispensado',acknowledged:'Reconhecido'}[value]??String(value??'—'));

export function PageHeader({eyebrow,title,description,actions}){return <div className="workspace-header"><div><span className="eyebrow">{eyebrow}</span><h2>{title}</h2>{description?<p>{description}</p>:null}</div>{actions?<div className="workspace-actions">{actions}</div>:null}</div>;}
export function KpiStrip({items=[]}){return <div className="workspace-kpis">{items.map(item=><article className="workspace-kpi" key={item.label}><span>{item.label}</span><strong>{item.value}</strong>{item.meta?<small>{item.meta}</small>:null}</article>)}</div>;}
export function EmptyState({title='Nenhum registro',description='Cadastre o primeiro item para começar.'}){return <div className="workspace-empty"><div className="empty-orb"/><strong>{title}</strong><span>{description}</span></div>;}
export function StatusBadge({value,tone=null}){const resolved=tone??(value==='completed'||value==='active'?'success':value==='cancelled'?'danger':value==='in-progress'?'info':'neutral');return <span className={`status-badge status-${resolved}`}>{statusLabel(value)}</span>;}

export function DataTable({columns=[],rows=[],onSelect=null,selectedId=null,emptyTitle='Nenhum registro',emptyDescription}){
  if(!rows.length)return <EmptyState title={emptyTitle} description={emptyDescription}/>;
  return <div className="workspace-table-wrap"><table className="workspace-table"><thead><tr>{columns.map(column=><th key={column.key}>{column.label}</th>)}</tr></thead><tbody>{rows.map((item,index)=>{const row=item?.row??item;const id=row?.id??index;return <tr key={id} className={selectedId===id?'selected':''} onClick={()=>onSelect?.(item)}>{columns.map(column=><td key={column.key}>{column.render?column.render(row,item):String(row?.[column.key]??'—')}</td>)}</tr>;})}</tbody></table></div>;
}

export function Modal({open,title,description,onClose,children,footer,danger=false}){
  useEffect(()=>{if(!open)return;const handler=event=>{if(event.key==='Escape')onClose?.();};window.addEventListener('keydown',handler);return()=>window.removeEventListener('keydown',handler);},[open,onClose]);
  if(!open)return null;
  return <div className="modal-backdrop" role="presentation" onMouseDown={event=>{if(event.target===event.currentTarget)onClose?.();}}><section role="dialog" aria-modal="true" className={`modal-card ${danger?'modal-danger':''}`}><header><div><span className="eyebrow">Sistema Lavoura</span><h3>{title}</h3>{description?<p>{description}</p>:null}</div><button type="button" className="icon-button" aria-label="Fechar" onClick={onClose}>×</button></header><div className="modal-body">{children}</div>{footer?<footer>{footer}</footer>:null}</section></div>;
}

function FieldControl({definition,value,onChange}){
  const common={id:`field-${definition.name}`,name:definition.name,required:Boolean(definition.required),value:value??'',onChange:event=>onChange(definition.type==='checkbox'?event.target.checked:event.target.value)};
  if(definition.type==='textarea')return <textarea {...common} rows={5}/>;
  if(definition.type==='select')return <select {...common}><option value="">Selecione…</option>{(definition.options??[]).map(option=>{const item=typeof option==='object'?option:{label:String(option),value:option};return <option key={String(item.value)} value={item.value}>{item.label}</option>;})}</select>;
  if(definition.type==='multiselect')return <select id={common.id} name={common.name} multiple value={Array.isArray(value)?value:[]} onChange={event=>onChange(Array.from(event.target.selectedOptions,option=>option.value))}>{(definition.options??[]).map(option=>{const item=typeof option==='object'?option:{label:String(option),value:option};return <option key={String(item.value)} value={item.value}>{item.label}</option>;})}</select>;
  if(definition.type==='checkbox')return <label className="toggle-field"><input id={common.id} name={common.name} type="checkbox" checked={Boolean(value)} onChange={event=>onChange(event.target.checked)}/><span>Ativo</span></label>;
  if(definition.type==='file')return <input id={common.id} name={common.name} type="file" onChange={event=>onChange(event.target.files?.[0]??null)}/>;
  const type=['number','money','date','datetime-local'].includes(definition.type)?(definition.type==='money'?'number':definition.type):'text';
  return <input {...common} type={type} min={definition.min} step={definition.step}/>;
}

export function StructuredForm({fields=[],initialValues={},submitLabel='Salvar',busy=false,onSubmit,onCancel=null,transform=null,testId='structured-form'}){
  const initialKey=useMemo(()=>JSON.stringify(initialValues??{}),[initialValues]);
  const [values,setValues]=useState(initialValues??{});
  const [error,setError]=useState('');
  useEffect(()=>{setValues(initialValues??{});setError('');},[initialKey]);
  async function submit(event){event.preventDefault();setError('');try{const normalized=normalizeFormValues(fields,values);await onSubmit(transform?transform(normalized,values):normalized);}catch(err){setError(err?.message??String(err));}}
  return <form className="structured-form" data-testid={testId} onSubmit={submit}><div className="form-grid">{fields.map(definition=><label className={definition.type==='textarea'||definition.type==='lines'||definition.type==='multiselect'?'wide':''} key={definition.name}><span>{definition.label}{definition.required?<b> *</b>:null}</span>{definition.type==='lines'?<textarea rows={5} value={values[definition.name]??''} onChange={event=>setValues(current=>({...current,[definition.name]:event.target.value}))}/>:<FieldControl definition={definition} value={values[definition.name]} onChange={value=>setValues(current=>({...current,[definition.name]:value}))}/>} {definition.help?<small>{definition.help}</small>:null}</label>)}</div>{error?<div className="error" role="alert">{error}</div>:null}<div className="form-actions">{onCancel?<button type="button" onClick={onCancel}>Cancelar</button>:null}<button className="primary-button" disabled={busy} type="submit">{busy?'Processando…':submitLabel}</button></div></form>;
}

export function ConfirmDialog({open,title,description,confirmLabel='Confirmar',onCancel,onConfirm,danger=true}){return <Modal open={open} title={title} description={description} onClose={onCancel} danger={danger} footer={<><button type="button" onClick={onCancel}>Cancelar</button><button type="button" className={danger?'danger-button':'primary-button'} onClick={onConfirm}>{confirmLabel}</button></>}><p className="confirm-copy">Esta ação será registrada na auditoria local.</p></Modal>;}

export async function fileToBase64(file){if(!file)throw new Error('Selecione um arquivo.');const buffer=await file.arrayBuffer();let binary='';const bytes=new Uint8Array(buffer);for(let index=0;index<bytes.length;index+=0x8000)binary+=String.fromCharCode(...bytes.subarray(index,index+0x8000));return btoa(binary);}
