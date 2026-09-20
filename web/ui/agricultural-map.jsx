import React,{useMemo,useState} from 'react';
import './agricultural-map.css';

const LAYER_LABELS=Object.freeze({applications:'Aplicações',scouting:'Ocorrências',operations:'Operações',photos:'Fotos',rainfall:'Chuva',sensors:'Sensores',machines:'Máquinas',storage:'Armazéns/silos',sampling:'Amostragem'});
const MARKER_SYMBOLS=Object.freeze({application:'A',scouting:'!',operation:'O',photo:'F',rainfall:'C',sensor:'S',machine:'M',storage:'G',sampling:'P'});
const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));

function projector(bounds){
  if(!bounds)return ()=>({x:500,y:310});
  const width=Math.max(1e-9,bounds.maxLongitude-bounds.minLongitude),height=Math.max(1e-9,bounds.maxLatitude-bounds.minLatitude);
  return (longitude,latitude)=>({x:60+((longitude-bounds.minLongitude)/width)*880,y:560-((latitude-bounds.minLatitude)/height)*500});
}
function polygonPoints(field,project){return (field.geometry?.coordinates??[]).map(([longitude,latitude])=>{const point=project(longitude,latitude);return `${point.x.toFixed(1)},${point.y.toFixed(1)}`;}).join(' ');}
function detailValue(value,fallback='—'){return value==null||value===''?fallback:String(value);}

export function AgriculturalMapPanel({map,onAddPoint}){
  const [selected,setSelected]=useState(null);
  const [visible,setVisible]=useState(()=>Object.fromEntries(Object.keys(LAYER_LABELS).map(key=>[key,true])));
  const fields=map?.fields??[],layers=map?.layers??{};
  const project=useMemo(()=>projector(map?.bounds),[map?.bounds]);
  const layerItems=useMemo(()=>Object.entries(LAYER_LABELS).flatMap(([key])=>visible[key]?(layers[key]??[]):[]),[layers,visible]);
  const selectedField=selected?.type==='field'?fields.find(field=>field.fieldId===selected.id):null;
  const selectedMarker=selected?.type==='marker'?layerItems.find(item=>`${item.kind}:${item.id}`===selected.id):null;
  const hasSpatialData=fields.length>0||layerItems.length>0;

  function selectField(field){setSelected({type:'field',id:field.fieldId});}
  function selectMarker(item){setSelected({type:'marker',id:`${item.kind}:${item.id}`});}
  return <section className="agricultural-map-panel" data-testid="agricultural-map">
    <div className="agricultural-map-heading"><div><span className="eyebrow">Mapa agrícola</span><h3>Visão espacial da lavoura</h3><p>Talhões, Safra ativa, operações e ocorrências em uma única visão local.</p></div>{onAddPoint?<button type="button" onClick={()=>onAddPoint(selectedField?.fieldId??null)}>Adicionar ponto</button>:null}</div>
    <div className="agricultural-map-layout">
      <aside className="agricultural-map-layers" aria-label="Camadas"><strong>Camadas</strong>{Object.entries(LAYER_LABELS).map(([key,label])=><label key={key}><input type="checkbox" checked={Boolean(visible[key])} onChange={event=>setVisible(current=>({...current,[key]:event.target.checked}))}/><span>{label}</span><small>{layers[key]?.length??0}</small></label>)}<div className="map-legend"><strong>Culturas</strong>{(map?.legend??[]).length?(map.legend??[]).map(item=><span key={item.crop}><i style={{background:item.color}}/>{item.crop}</span>):<small>Nenhuma safra mapeada.</small>}</div></aside>
      <div className="agricultural-map-stage">
        {hasSpatialData?<svg viewBox="0 0 1000 620" role="img" aria-label="Mapa dos talhões e camadas agrícolas">
          <defs><pattern id="agri-grid" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M40 0H0V40" fill="none" stroke="currentColor" strokeOpacity=".07" strokeWidth="1"/></pattern></defs>
          <rect x="0" y="0" width="1000" height="620" className="map-background"/><rect x="0" y="0" width="1000" height="620" fill="url(#agri-grid)"/>
          {fields.map(field=><g key={field.fieldId} role="button" tabIndex="0" onClick={()=>selectField(field)} onKeyDown={event=>{if(event.key==='Enter'||event.key===' ')selectField(field);}} className={selectedField?.fieldId===field.fieldId?'field-shape selected':'field-shape'}><polygon points={polygonPoints(field,project)} fill={field.color}/>{field.centroid?(()=>{const p=project(field.centroid.longitude,field.centroid.latitude);return <text x={p.x} y={p.y} textAnchor="middle">{field.code??field.name}</text>;})():null}</g>)}
          {layerItems.map(item=>{const p=project(item.longitude,item.latitude);return <g key={`${item.kind}:${item.id}`} role="button" tabIndex="0" className={selectedMarker&&`${selectedMarker.kind}:${selectedMarker.id}`===`${item.kind}:${item.id}`?'map-marker selected':'map-marker'} transform={`translate(${clamp(p.x,22,978)} ${clamp(p.y,22,598)})`} onClick={()=>selectMarker(item)} onKeyDown={event=>{if(event.key==='Enter'||event.key===' ')selectMarker(item);}}><circle r="14"/><text textAnchor="middle" dominantBaseline="central">{MARKER_SYMBOLS[item.kind]??'•'}</text></g>;})}
        </svg>:<div className="map-empty"><strong>Nenhuma geometria disponível</strong><span>Cadastre as coordenadas do talhão em “Mapa/GIS” para ativar a visão espacial.</span></div>}
        <span className="map-mode-badge">Base agrícola local · funciona sem internet</span>
      </div>
      <aside className="agricultural-map-detail">
        {selectedField?<><span className="eyebrow">Talhão selecionado</span><h4>{selectedField.name}</h4><dl><div><dt>Área</dt><dd>{Number(selectedField.areaHa||0).toLocaleString('pt-BR',{maximumFractionDigits:2})} ha</dd></div><div><dt>Safra ativa</dt><dd>{selectedField.season?`${detailValue(selectedField.season.crop)} · ${detailValue(selectedField.season.periodName)}`:'Sem safra vinculada'}</dd></div><div><dt>Cultivar</dt><dd>{detailValue(selectedField.season?.varietyName)}</dd></div><div><dt>Monitoramentos abertos</dt><dd>{selectedField.summary?.openScouting??0}</dd></div><div><dt>Chuva 7 dias</dt><dd>{Number(selectedField.summary?.recentRainMm??0).toLocaleString('pt-BR')} mm</dd></div><div><dt>Operações planejadas</dt><dd>{selectedField.summary?.plannedOperations??0}</dd></div><div><dt>Fotos</dt><dd>{selectedField.summary?.photoCount??0}</dd></div></dl></>:selectedMarker?<><span className="eyebrow">{LAYER_LABELS[Object.keys(LAYER_LABELS).find(key=>(layers[key]??[]).some(item=>`${item.kind}:${item.id}`===`${selectedMarker.kind}:${selectedMarker.id}`))]??'Camada'}</span><h4>{selectedMarker.name}</h4><dl><div><dt>Talhão</dt><dd>{detailValue(selectedMarker.fieldId)}</dd></div><div><dt>Origem da posição</dt><dd>{selectedMarker.coordinateSource==='field-centroid'?'Centroide do talhão':'Coordenada registrada'}</dd></div>{selectedMarker.status?<div><dt>Status</dt><dd>{selectedMarker.status}</dd></div>:null}{selectedMarker.mm!=null?<div><dt>Chuva</dt><dd>{selectedMarker.mm} mm</dd></div>:null}{selectedMarker.severity!=null?<div><dt>Severidade</dt><dd>{selectedMarker.severity}/5</dd></div>:null}</dl></>:<><span className="eyebrow">Ficha rápida</span><h4>Selecione um item no mapa</h4><p>Clique em um talhão ou marcador para consultar a situação agrícola sem sair desta tela.</p></>}
      </aside>
    </div>
    {map?.unmappedFields?.length?<p className="map-warning">{map.unmappedFields.length} talhão(ões) ainda sem polígono e, por isso, não aparecem no mapa.</p>:null}
  </section>;
}
