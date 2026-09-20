import React,{useMemo,useState} from 'react';
import './offline-maps.css';

const formatBytes=value=>{const bytes=Number(value);if(!Number.isFinite(bytes)||bytes<=0)return 'estimativa disponível após o primeiro recorte';const units=['B','KB','MB','GB'];let size=bytes,index=0;while(size>=1024&&index<units.length-1){size/=1024;index+=1;}return `${size.toLocaleString('pt-BR',{maximumFractionDigits:index>1?1:0})} ${units[index]}`;};
const formatBounds=bounds=>Array.isArray(bounds)?bounds.map(value=>Number(value).toFixed(4)).join(', '):'Sem polígono cadastrado';

export function LavouraOfflineMaps({data,onRun,reload}){
  const farms=data?.farms??[],provider=data?.provider??{};
  const [farmId,setFarmId]=useState(farms.find(farm=>farm.mapped)?.id??farms[0]?.id??'');
  const [profile,setProfile]=useState('detailed');
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState('');
  const farm=useMemo(()=>farms.find(item=>String(item.id)===String(farmId))??null,[farms,farmId]);
  const installed=provider.installed??[];
  const profiles=provider.profiles??[{id:'basic',label:'Básico',maxZoom:10},{id:'detailed',label:'Detalhado',maxZoom:12},{id:'maximum',label:'Máximo',maxZoom:14}];

  async function install(){if(!farm?.mapped)return;setBusy(true);setMessage('');try{const result=await onRun('installFarmMap',{farmUnitId:farm.id,farmName:farm.name,profile});setMessage(`Mapa ${result.profileLabel??profile} instalado: ${formatBytes(result.size)}.`);await reload?.();}catch(error){setMessage(error.message);}finally{setBusy(false);}}
  async function remove(item){setBusy(true);setMessage('');try{await onRun('removeFarmMap',{id:item.id});setMessage('Mapa removido do dispositivo.');await reload?.();}catch(error){setMessage(error.message);}finally{setBusy(false);}}
  async function refreshCatalog(){setBusy(true);setMessage('');try{const catalog=await onRun('refreshCatalog',{});setMessage(`Catálogo ${catalog.releaseVersion??''} atualizado.`);await reload?.();}catch(error){setMessage(error.message);}finally{setBusy(false);}}

  return <section className="offline-maps" data-testid="offline-maps-workspace">
    <header className="offline-maps-header"><div><span className="eyebrow">P5 · Mapas offline</span><h2>Disponibilizar fazenda offline</h2><p>O desktop recorta somente a região dos seus talhões. Depois da instalação, o pacote fica local e não exige conexão.</p></div><span className={`provider-badge ${provider.available?'available':'unavailable'}`}>{provider.available?'Recorte disponível neste PC':'Somente no desktop Windows'}</span></header>
    {message?<div className={/erro|falh|indispon|requer/i.test(message)?'error':'map-status'}>{message}</div>:null}
    <div className="offline-map-grid">
      <section className="offline-map-card primary"><span className="eyebrow">Nova área offline</span><label>Fazenda<select data-testid="offline-map-farm" value={farmId} onChange={event=>setFarmId(event.target.value)}>{farms.map(item=><option key={item.id} value={item.id}>{item.name}{item.mapped?'':' · sem polígono'}</option>)}</select></label><label>Nível de detalhe<select data-testid="offline-map-profile" value={profile} onChange={event=>setProfile(event.target.value)}>{profiles.map(item=><option key={item.id} value={item.id}>{item.label} · zoom até {item.maxZoom}</option>)}</select></label><dl className="farm-map-info"><div><dt>Talhões</dt><dd>{farm?.fieldCount??0}</dd></div><div><dt>Limites</dt><dd>{formatBounds(farm?.bounds)}</dd></div><div><dt>Após baixar</dt><dd>100% local</dd></div></dl><button type="button" className="primary-button" disabled={busy||!provider.available||!farm?.mapped} onClick={install}>{busy?'Processando…':'Baixar mapa desta fazenda'}</button>{!provider.available?<p className="muted">No PWA/mobile o Modo Campo continua funcionando com os dados agrícolas já armazenados. A criação do arquivo PMTiles regional é feita pelo aplicativo desktop.</p>:null}{farm&&!farm.mapped?<p className="map-warning">Cadastre o polígono de pelo menos um talhão desta fazenda antes de gerar o mapa.</p>:null}</section>
      <section className="offline-map-card"><div className="offline-card-heading"><div><span className="eyebrow">Pacotes locais</span><h3>Instalados neste dispositivo</h3></div>{provider.available?<button type="button" disabled={busy} onClick={refreshCatalog}>Atualizar catálogo</button>:null}</div>{installed.length?installed.map(item=><article className="installed-map" key={item.id}><div><strong>{item.farmName??item.farmUnitId}</strong><small>{item.profileLabel??item.profile} · {formatBytes(item.size)}</small><small>Zoom {item.minZoom}–{item.maxZoom} · instalado em {item.installedAt?new Date(item.installedAt).toLocaleString('pt-BR'):'—'}</small></div><button type="button" className="danger-ghost" disabled={busy} onClick={()=>remove(item)}>Remover</button></article>):<div className="offline-empty"><strong>Nenhum mapa regional instalado</strong><span>Escolha uma fazenda e um nível de detalhe para criar o primeiro pacote.</span></div>}</section>
    </div>
    <section className="offline-map-note"><strong>Como funciona</strong><p>O recorte usa PMTiles e requisições HTTP Range para buscar somente os blocos necessários à área da fazenda. O arquivo final é validado antes de substituir qualquer mapa local existente.</p><small>{data?.attribution??'Protomaps © OpenStreetMap contributors'}</small></section>
  </section>;
}
