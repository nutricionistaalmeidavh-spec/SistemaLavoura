import React,{useMemo,useRef,useState} from 'react';
import {AgriculturalMapPanel} from './agricultural-map.jsx';
import {fileToBase64} from './primitives.jsx';
import {measureAreaHa,measureDistanceMeters} from '../../src/field-mode.js';
import './field-mode.css';

const formatDistance=value=>value>=1000?`${(value/1000).toLocaleString('pt-BR',{maximumFractionDigits:2})} km`:`${value.toLocaleString('pt-BR',{maximumFractionDigits:1})} m`;
const formatArea=value=>`${value.toLocaleString('pt-BR',{maximumFractionDigits:2})} ha`;

export function LavouraFieldMode({data,onRun,reload}){
  const [fieldId,setFieldId]=useState(data?.fields?.[0]?.id??'');
  const [gps,setGps]=useState(null);
  const [gpsError,setGpsError]=useState('');
  const [title,setTitle]=useState('');
  const [notes,setNotes]=useState('');
  const [busy,setBusy]=useState(false);
  const [measureMode,setMeasureMode]=useState('distance');
  const [measurePoints,setMeasurePoints]=useState([]);
  const photoInput=useRef(null);
  const selected=useMemo(()=>(data?.fields??[]).find(field=>String(field.id)===String(fieldId))??null,[data,fieldId]);
  const activeSeason=useMemo(()=>(data?.map?.fields??[]).find(item=>String(item.fieldId)===String(fieldId))?.season??null,[data,fieldId]);
  const distance=useMemo(()=>measureDistanceMeters(measurePoints),[measurePoints]);
  const area=useMemo(()=>measureAreaHa(measurePoints),[measurePoints]);
  const online=typeof navigator==='undefined'?true:navigator.onLine;

  function useGps(){
    setGpsError('');
    if(!navigator.geolocation){setGpsError('GPS não está disponível neste dispositivo.');return;}
    navigator.geolocation.getCurrentPosition(position=>setGps({latitude:position.coords.latitude,longitude:position.coords.longitude,accuracyM:position.coords.accuracy}),error=>setGpsError(error.message||'Não foi possível obter a localização.'),{enableHighAccuracy:true,timeout:12000,maximumAge:15000});
  }
  async function saveObservation(kind='observation',extra={}){
    if(!selected)throw new Error('Selecione um talhão.');
    if(!gps)throw new Error('Capture o GPS antes de registrar.');
    setBusy(true);try{
      await onRun('saveObservation',{fieldId:selected.id,kind,title:title.trim()||extra.title||'Observação de campo',notes:notes.trim()||null,latitude:gps.latitude,longitude:gps.longitude,accuracyM:gps.accuracyM,observedAt:new Date().toISOString(),...extra});
      setTitle('');setNotes('');await reload?.();
    }finally{setBusy(false);}
  }
  async function addScouting(){
    if(!selected||!gps)throw new Error('Selecione um talhão e capture o GPS.');
    if(!activeSeason?.id)throw new Error('Vincule uma safra ativa ao talhão antes de registrar uma ocorrência agronômica.');
    setBusy(true);try{await onRun('addScouting',{fieldId:selected.id,seasonId:activeSeason.id,kind:'observação',name:title.trim()||'Ocorrência de campo',severity:1,status:'open',latitude:gps.latitude,longitude:gps.longitude,notes:notes.trim()||null,observedAt:new Date().toISOString()});setTitle('');setNotes('');await reload?.();}finally{setBusy(false);}
  }
  async function startOperation(operation){setBusy(true);try{await onRun('startOperation',{id:operation.id,startedAt:new Date().toISOString()});await reload?.();}finally{setBusy(false);}}
  async function capturePhoto(event){
    const file=event.target.files?.[0];if(!file||!selected)return;
    if(!gps){setGpsError('Capture o GPS antes da foto para registrar a posição.');event.target.value='';return;}
    setBusy(true);try{
      const id=globalThis.crypto?.randomUUID?.()??`photo-${Date.now()}`;
      await onRun('uploadPhoto',{id,name:file.name,mimeType:file.type||'image/jpeg',bytesBase64:await fileToBase64(file),fieldId:selected.id});
      await onRun('saveObservation',{fieldId:selected.id,kind:'photo',title:title.trim()||'Foto de campo',notes:notes.trim()||null,latitude:gps.latitude,longitude:gps.longitude,accuracyM:gps.accuracyM,photoFileId:id,observedAt:new Date().toISOString()});
      setTitle('');setNotes('');await reload?.();
    }finally{setBusy(false);event.target.value='';}
  }
  function addMeasurementPoint(){if(!gps){setGpsError('Capture o GPS antes de adicionar um ponto de medição.');return;}setMeasurePoints(current=>[...current,[gps.longitude,gps.latitude]]);}
  async function saveMeasurement(){
    if(!selected||!gps||measurePoints.length<(measureMode==='area'?3:2))return;
    const value=measureMode==='area'?area:distance;
    await saveObservation('measurement',{title:measureMode==='area'?'Medição de área':'Medição de distância',metadata:{mode:measureMode,points:measurePoints,value,unit:measureMode==='area'?'ha':'m'}});
    setMeasurePoints([]);
  }

  return <section className="field-mode" data-testid="field-mode-workspace">
    <header className="field-mode-header"><div><span className="eyebrow">P4 · Modo Campo</span><h2>Trabalho em campo</h2><p>GPS, tarefas, ocorrências, fotos e medições continuam disponíveis com os dados já carregados, mesmo sem mapa-base.</p></div><div className={`field-network ${online?'online':'offline'}`}>{online?'Online':'Offline'}</div></header>
    <div className="field-mode-toolbar"><label>Talhão<select data-testid="field-mode-field" value={fieldId} onChange={event=>setFieldId(event.target.value)}>{(data?.fields??[]).map(field=><option key={field.id} value={field.id}>{field.code?`${field.code} · `:''}{field.name}</option>)}</select></label><button type="button" onClick={useGps}>Usar meu GPS</button>{gps?<span className="gps-readout">{gps.latitude.toFixed(6)}, {gps.longitude.toFixed(6)} · ±{Math.round(gps.accuracyM??0)} m</span>:<span className="gps-readout muted">GPS ainda não capturado</span>}</div>
    {gpsError?<div className="error" role="alert">{gpsError}</div>:null}
    <AgriculturalMapPanel map={data?.map} onSelectField={field=>setFieldId(String(field.fieldId))}/>
    <div className="field-mode-grid">
      <section className="field-card"><span className="eyebrow">Registro rápido</span><h3>{selected?.name??'Selecione um talhão'}</h3><label>Título<input data-testid="field-observation-title" value={title} onChange={event=>setTitle(event.target.value)} placeholder="Ex.: Falha de plantio"/></label><label>Observações<textarea value={notes} onChange={event=>setNotes(event.target.value)} rows="3"/></label><div className="field-actions"><button disabled={busy||!gps||!selected} onClick={()=>saveObservation('observation')}>Salvar observação</button><button disabled={busy||!gps||!selected||!activeSeason} title={!activeSeason?'Vincule uma safra ativa ao talhão.':undefined} onClick={addScouting}>Registrar ocorrência</button><button disabled={busy||!gps||!selected} onClick={()=>photoInput.current?.click()}>Tirar foto</button><input ref={photoInput} className="visually-hidden" type="file" accept="image/*" capture="environment" onChange={capturePhoto}/></div>{selected&&!activeSeason?<small className="muted">Ocorrências agronômicas exigem uma safra ativa; observações e fotos continuam disponíveis.</small>:null}</section>
      <section className="field-card"><span className="eyebrow">Operações</span><h3>Pendentes no talhão</h3>{selected?.pendingOperations?.length?selected.pendingOperations.map(operation=><article className="field-operation" key={operation.id}><div><strong>{operation.typeName??operation.typeId??'Operação'}</strong><small>{operation.scheduledAt?new Date(operation.scheduledAt).toLocaleString('pt-BR'):'Sem horário'}</small></div><button disabled={busy||operation.status!=='planned'} onClick={()=>startOperation(operation)}>{operation.status==='planned'?'Iniciar':'Em andamento'}</button></article>):<p className="muted">Nenhuma operação pendente.</p>}</section>
      <section className="field-card"><span className="eyebrow">Medição local</span><h3>Distância ou área</h3><div className="segmented"><button className={measureMode==='distance'?'active':''} onClick={()=>{setMeasureMode('distance');setMeasurePoints([]);}}>Distância</button><button className={measureMode==='area'?'active':''} onClick={()=>{setMeasureMode('area');setMeasurePoints([]);}}>Área</button></div><strong className="measure-value">{measureMode==='area'?formatArea(area):formatDistance(distance)}</strong><small>{measurePoints.length} ponto(s) capturado(s)</small><div className="field-actions"><button disabled={!gps} onClick={addMeasurementPoint}>Adicionar posição GPS</button><button disabled={measurePoints.length<(measureMode==='area'?3:2)||busy} onClick={saveMeasurement}>Salvar medição</button><button disabled={!measurePoints.length} onClick={()=>setMeasurePoints([])}>Limpar</button></div></section>
      <section className="field-card"><span className="eyebrow">Fila local</span><h3>Registros para sincronização</h3><strong className="pending-count">{data?.pendingSync?.length??0}</strong><p className="muted">Os registros permanecem salvos localmente. A arquitetura de sincronização multi-dispositivo pode consumir esta fila depois.</p>{(data?.pendingSync??[]).slice(0,5).map(item=><div className="pending-item" key={item.id}><span>{item.title}</span><small>{new Date(item.observedAt).toLocaleString('pt-BR')}</small></div>)}</section>
    </div>
  </section>;
}
