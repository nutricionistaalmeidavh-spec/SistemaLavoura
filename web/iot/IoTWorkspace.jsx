import React from 'react';
import {buildIoTOverviewModel,buildDeviceRows,buildIntegrationRows} from './model.js';
import './iot.css';

const Card=({label,value,detail})=><article className="iot-card"><span>{label}</span><strong>{value}</strong>{detail?<small>{detail}</small>:null}</article>;
const Status=({value})=><span className={`iot-status iot-status--${value||'unknown'}`}>{value||'unknown'}</span>;

export function IoTWorkspace({devices=[],telemetry=[],alerts=[],integrations=[]}){
  const overview=buildIoTOverviewModel({devices,telemetry,alerts});
  const deviceRows=buildDeviceRows(devices);
  const integrationRows=buildIntegrationRows(integrations);
  return <section className="iot-workspace" aria-labelledby="iot-title">
    <header className="iot-heading">
      <div><p>Integrações opcionais</p><h2 id="iot-title">IoT da lavoura</h2></div>
      <span className="iot-readonly">Telemetria somente leitura</span>
    </header>
    <div className="iot-cards" aria-label="Resumo IoT">
      <Card label="Dispositivos" value={overview.cards.devices}/>
      <Card label="Online" value={overview.cards.online}/>
      <Card label="Offline" value={overview.cards.offline}/>
      <Card label="Alertas não lidos" value={overview.cards.unreadAlerts}/>
    </div>
    <div className="iot-grid">
      <article className="iot-panel"><h3>Leituras recentes</h3>{overview.latestMetrics.length?<ul className="iot-metrics">{overview.latestMetrics.map(item=><li key={`${item.deviceId}-${item.metric}`}><span>{item.label}</span><strong>{item.value} {item.unit}</strong></li>)}</ul>:<p className="iot-empty">Nenhuma telemetria recebida.</p>}</article>
      <article className="iot-panel"><h3>Integrações</h3>{integrationRows.length?<ul className="iot-integrations">{integrationRows.map(item=><li key={item.id}><div><strong>{item.protocol}</strong><small>{item.enabled?'Ativada':'Opcional e desativada'}</small></div><Status value={item.status}/></li>)}</ul>:<p className="iot-empty">Nenhum adapter configurado. O sistema continua funcionando normalmente.</p>}</article>
    </div>
    <article className="iot-panel"><h3>Dispositivos</h3><div className="iot-table-wrap"><table className="iot-table"><thead><tr><th>Dispositivo</th><th>Talhão</th><th>Protocolo</th><th>Status</th><th>Bateria</th><th>Sinal</th></tr></thead><tbody>{deviceRows.map(row=><tr key={row.id}><td><strong>{row.name}</strong><small>{row.type}</small></td><td>{row.field}</td><td>{row.protocol}</td><td><Status value={row.status}/></td><td>{row.battery===null?'—':`${row.battery}%`}</td><td>{row.signal===null?'—':`${row.signal} dBm`}</td></tr>)}</tbody></table></div></article>
  </section>;
}
