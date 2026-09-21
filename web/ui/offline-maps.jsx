import React,{useMemo,useState} from 'react';
import './offline-maps.css';

const formatBytes=value=>{const bytes=Number(value);if(!Number.isFinite(bytes)||bytes<=0)return 'estimativa disponível após o primeiro recorte';const units=['B','KB','MB','GB'];let size=bytes,index=0;while(size>=1024&&index<units.length-1){size/=1024;index+=1;}return `${size.toLocaleString('pt-BR',{maximumFractionDigits:index>1?1:0})} ${units[index]}`;};
const formatBounds=bounds=>Array.isArray(bounds)?bounds.map(value=>Number(value).toFixed(4)).join(', '):'Sem polígono cadastrado';
const HEALTH_COPY=Object.freeze({
  healthy:Object.freeze({label:'Verificado',tone:'ok'}),
  unverified:Object.freeze({label:'Não verificado',tone:'warning'}),
  outdated:Object.freeze({label:'Atualização disponível',tone:'warning'}),
  missing:Object.freeze({label:'Arquivo ausente',tone:'danger'}),
  corrupt:Object.freeze({label:'Falha de integridade',tone:'danger'})
});
const ERROR_COPY=Object.freeze({
  MAP_DISK_FULL:'Libere espaço em disco e tente novamente.',
  MAP_CATALOG_UNAVAILABLE:'Não foi possível atualizar o catálogo. Os mapas já instalados continuam disponíveis.',
  MAP_SOURCE_UNAVAILABLE:'A fonte do mapa está indisponível. Tente novamente quando houver conexão.',
  MAP_VERIFY_FAILED:'O pacote baixado não passou na verificação e não substituiu o mapa anterior.',
  MAP_PACKAGE_CORRUPT:'O mapa local falhou na verificação de integridade.',
  MAP_RECOVERY_FAILED:'Há uma atualização de mapa incompleta. O mapa anterior foi preservado quando possível.'
});
const errorMessage=error=>ERROR_COPY[error?.code]??error?.message??'Não foi possível concluir a operação de mapa.';

export function LavouraOfflineMaps({data,onRun,reload}){
  const farms=data?.farms??[],provider=data?.provider??{};
  const [farmId,setFarmId]=useState(farms.find(farm=>farm.mapped)?.id??farms[0]?.id??'');
  const [profile,setProfile]=useState('detailed');
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState('');
  const [messageTone,setMessageTone]=useState('ok');
  const farm=useMemo(()=>farms.find(item=>String(item.id)===String(farmId))??null,[farms,farmId]);
  const installed=provider.installed??[];
  const profiles=provider.profiles??[{id:'basic',label:'Básico',maxZoom:10},{id:'detailed',label:'Detalhado',maxZoom:12},{id:'maximum',label:'Máximo',maxZoom:14}];
  const fail=error=>{setMessageTone('error');setMessage(errorMessage(error));};
  const succeed=value=>{setMessageTone('ok');setMessage(value);};

  async function install(){if(!farm?.mapped)return;setBusy(true);setMessage('');try{const result=await onRun('installFarmMap',{farmUnitId:farm.id,farmName:farm.name,profile});succeed(`Mapa ${result.profileLabel??profile} instalado: ${formatBytes(result.size)}.`);await reload?.();}catch(error){fail(error);}finally{setBusy(false);}}
  async function verify(item){setBusy(true);setMessage('');try{const result=await onRun('verifyFarmMap',{id:item.id});const health=HEALTH_COPY[result.health]??{label:'Verificação concluída'};succeed(result.health==='healthy'?'Integridade verificada.':health.label);await reload?.();}catch(error){fail(error);}finally{setBusy(false);}}
  async function remove(item){setBusy(true);setMessage('');try{await onRun('removeFarmMap',{id:item.id});succeed('Mapa removido do dispositivo.');await reload?.();}catch(error){fail(error);}finally{setBusy(false);}}
  async function refreshCatalog(){setBusy(true);setMessage('');try{const catalog=await onRun('refreshCatalog',{});succeed(`Catálogo ${catalog.releaseVersion??''} atualizado.`);await reload?.();}catch(error){fail(error);}finally{setBusy(false);}}

  return <section className="offline-maps" data-testid="offline-maps-workspace">
    <header className="offline-maps-header"><div><span className="eyebrow">P8 · Mapas offline robustos</span><h2>Disponibilizar fazenda offline</h2><p>O desktop recorta somente a região dos seus talhões. Depois da instalação, o pacote fica local e não exige conexão.</p></div><span className={`provider-badge ${provider.available?'available':'unavailable'}`}>{provider.available?'Recorte disponível neste PC':'Somente no desktop Windows'}</span></header>
    {message?<div className={messageTone==='error'?'error':'map-status'}>{message}</div>:null}
    {provider.recoveryIssues?.length?<div className="map-recovery-warning"><strong>Há uma pendência de recuperação de mapas.</strong><span>Os dados agrícolas continuam preservados. Verifique os pacotes locais no desktop antes de remover qualquer arquivo manualmente.</span></div>:null}
    <div className="offline-map-grid">
      <section className="offline-map-card primary"><span className="eyebrow">Nova área offline</span><label>Fazenda<select data-testid="offline-map-farm" value={farmId} onChange={event=>setFarmId(event.target.value)}>{farms.map(item=><option key={item.id} value={item.id}>{item.name}{item.mapped?'':' · sem polígono'}</option>)}</select></label><label>Nível de detalhe<select data-testid="offline-map-profile" value={profile} onChange={event=>setProfile(event.target.value)}>{profiles.map(item=><option key={item.id} value={item.id}>{item.label} · zoom até {item.maxZoom}</option>)}</select></label><dl className="farm-map-info"><div><dt>Talhões</dt><dd>{farm?.fieldCount??0}</dd></div><div><dt>Limites</dt><dd>{formatBounds(farm?.bounds)}</dd></div><div><dt>Após baixar</dt><dd>100% local</dd></div></dl><button type="button" className="primary-button" disabled={busy||!provider.available||!farm?.mapped} onClick={install}>{busy?'Processando…':'Baixar mapa desta fazenda'}</button>{!provider.available?<p className="muted"><strong>Somente no desktop Windows.</strong> No PWA/mobile o Modo Campo continua funcionando com os dados agrícolas já armazenados; criação e verificação do PMTiles regional ficam no aplicativo desktop.</p>:null}{farm&&!farm.mapped?<p className="map-warning">Cadastre o polígono de pelo menos um talhão desta fazenda antes de gerar o mapa.</p>:null}</section>
      <section className="offline-map-card"><div className="offline-card-heading"><div><span className="eyebrow">Pacotes locais</span><h3>Instalados neste dispositivo</h3></div>{provider.available?<button type="button" disabled={busy} onClick={refreshCatalog}>Atualizar catálogo</button>:null}</div>{installed.length?installed.map(item=>{const health=HEALTH_COPY[item.health]??HEALTH_COPY.unverified;return <article className="installed-map" key={item.id}><div className="installed-map-copy"><div className="installed-map-title"><strong>{item.farmName??item.farmUnitId}</strong><span className={`map-health ${health.tone}`}>{health.label}</span></div><small>{item.profileLabel??item.profile} · {formatBytes(item.size)}</small><small>Zoom {item.minZoom}–{item.maxZoom} · instalado em {item.installedAt?new Date(item.installedAt).toLocaleString('pt-BR'):'—'}</small>{item.verifiedAt?<small>Integridade verificada em {new Date(item.verifiedAt).toLocaleString('pt-BR')}</small>:null}</div><div className="installed-map-actions">{provider.available?<button type="button" className="secondary-button" disabled={busy||item.health==='missing'} onClick={()=>verify(item)}>Verificar integridade</button>:null}<button type="button" className="danger-ghost" disabled={busy} onClick={()=>remove(item)}>Remover</button></div></article>}):<div className="offline-empty"><strong>Nenhum mapa regional instalado</strong><span>Escolha uma fazenda e um nível de detalhe para criar o primeiro pacote.</span></div>}</section>
    </div>
    <section className="offline-map-note"><strong>Como funciona</strong><p>O recorte usa PMTiles e requisições HTTP Range para buscar somente os blocos necessários à área da fazenda. O pacote novo é promovido de forma transacional, preserva o mapa anterior em caso de falha e pode ter a integridade SHA-256 verificada explicitamente.</p><small>{data?.attribution??'Protomaps © OpenStreetMap contributors'}</small></section>
  </section>;
}