import React,{useState} from 'react';
import {buildIoTOverviewModel,buildDeviceRows,buildIntegrationRows} from './model.js';
import './iot.css';

const Card=({label,value,detail})=><article className="iot-card"><span>{label}</span><strong>{value}</strong>{detail?<small>{detail}</small>:null}</article>;
const Status=({value})=><span className={`iot-status iot-status--${value||'unknown'}`}>{value||'unknown'}</span>;
const severityLabel=value=>({info:'Informativo',warning:'Atenção',critical:'Crítico'}[value]??value);
const ruleTypeLabel=value=>({threshold:'Limiar de leitura',battery:'Bateria baixa',offline:'Dispositivo offline'}[value]??value);
const metricOptions=[['soil.moisture','Umidade do solo'],['soil.temperature','Temperatura do solo'],['air.temperature','Temperatura do ar'],['air.humidity','Umidade do ar'],['rainfall','Chuva'],['wind.speed','Velocidade do vento'],['reservoir.level','Nível do reservatório'],['water.flow','Vazão de água'],['irrigation.pressure','Pressão de irrigação']];

function SetupForm({title,onSubmit,children,submitLabel='Salvar'}){
  const [busy,setBusy]=useState(false);
  async function submit(event){event.preventDefault();setBusy(true);try{const values=Object.fromEntries(new FormData(event.currentTarget).entries());for(const checkbox of event.currentTarget.querySelectorAll('input[type="checkbox"]'))values[checkbox.name]=checkbox.checked;await onSubmit(values);event.currentTarget.reset();}finally{setBusy(false);}}
  return <form className="iot-setup-card" onSubmit={submit}><h4>{title}</h4>{children}<button type="submit" disabled={busy}>{busy?'Salvando…':submitLabel}</button></form>;
}

export function IoTWorkspace({data=null,devices=[],telemetry=[],alerts=[],integrations=[],onRun}){
  const snapshot=data??{available:true,devices,telemetry,alerts,integrations};
  const [ruleType,setRuleType]=useState('threshold');
  if(snapshot.available===false)return <section className="iot-workspace" aria-labelledby="iot-title">
    <header className="iot-heading"><div><p>Integrações opcionais</p><h2 id="iot-title">IoT da lavoura</h2></div><span className="iot-readonly">Sem dependência obrigatória</span></header>
    <article className="iot-panel iot-empty-state"><h3>Telemetria local ainda não conectada neste ambiente</h3><p>O Sistema Lavoura funciona normalmente sem IoT. Para consultar sensores, dispositivos e integrações locais, use o aplicativo desktop e configure um adapter compatível. Nenhum serviço pago é necessário pelo sistema.</p></article>
  </section>;
  const currentDevices=snapshot.devices??devices;
  const currentTelemetry=snapshot.telemetry??telemetry;
  const currentAlerts=snapshot.alerts??alerts;
  const currentIntegrations=snapshot.integrations??integrations;
  const currentRules=snapshot.rules??[];
  const canConfigure=Boolean(snapshot.capabilities?.configure&&onRun);
  const overview=buildIoTOverviewModel({devices:currentDevices,telemetry:currentTelemetry,alerts:currentAlerts});
  const deviceRows=buildDeviceRows(currentDevices);
  const integrationRows=buildIntegrationRows(currentIntegrations);
  const deviceOptions=currentDevices.map(item=>({value:item.id,label:item.name}));
  const fieldOptions=snapshot.fieldOptions??[];

  return <section className="iot-workspace" aria-labelledby="iot-title">
    <header className="iot-heading">
      <div><p>Integrações opcionais</p><h2 id="iot-title">IoT da lavoura</h2></div>
      <span className="iot-readonly">{canConfigure?'Configuração local habilitada':'Telemetria somente leitura'}</span>
    </header>
    <div className="iot-cards" aria-label="Resumo IoT">
      <Card label="Dispositivos" value={overview.cards.devices}/>
      <Card label="Online" value={overview.cards.online}/>
      <Card label="Offline" value={overview.cards.offline}/>
      <Card label="Alertas não lidos" value={overview.cards.unreadAlerts}/>
    </div>
    <div className="iot-grid">
      <article className="iot-panel"><h3>Leituras recentes</h3>{overview.latestMetrics.length?<ul className="iot-metrics">{overview.latestMetrics.map(item=><li key={`${item.deviceId}-${item.metric}`}><span>{item.label}</span><strong>{item.value} {item.unit}</strong></li>)}</ul>:<p className="iot-empty">Nenhuma telemetria recebida.</p>}</article>
      <article className="iot-panel"><h3>Integrações</h3>{integrationRows.length?<ul className="iot-integrations">{integrationRows.map(item=><li key={item.id}><div><strong>{item.protocol}</strong><small>{item.enabled?'Configuração habilitada':'Opcional e desativada'}</small></div><div className="iot-integration-actions"><Status value={item.status}/>{canConfigure?<button type="button" onClick={()=>onRun('setAdapterEnabled',{id:item.id,enabled:!item.enabled})}>{item.enabled?'Desativar':'Ativar'}</button>:null}</div></li>)}</ul>:<p className="iot-empty">Nenhum adapter configurado. O sistema continua funcionando normalmente.</p>}</article>
    </div>
    <article className="iot-panel"><h3>Dispositivos</h3>{deviceRows.length?<div className="iot-table-wrap"><table className="iot-table"><thead><tr><th>Dispositivo</th><th>Talhão</th><th>Protocolo</th><th>Status</th><th>Bateria</th><th>Sinal</th></tr></thead><tbody>{deviceRows.map(row=><tr key={row.id}><td><strong>{row.name}</strong><small>{row.type}</small></td><td>{row.field}</td><td>{row.protocol}</td><td><Status value={row.status}/></td><td>{row.battery===null?'—':`${row.battery}%`}</td><td>{row.signal===null?'—':`${row.signal} dBm`}</td></tr>)}</tbody></table></div>:<p className="iot-empty">Nenhum dispositivo cadastrado ou conectado.</p>}</article>

    <article className="iot-panel"><div className="iot-panel-heading"><div><p className="iot-kicker">Monitoramento</p><h3>Alertas ativos</h3></div><span>{currentAlerts.length}</span></div>{currentAlerts.length?<div className="iot-alert-list">{currentAlerts.map(alert=><div className="iot-alert" key={alert.id}><div><strong>{alert.title}</strong><small>{deviceOptions.find(item=>item.value===alert.deviceId)?.label??'Dispositivo IoT'} · {severityLabel(alert.severity)}</small></div><Status value={alert.status??'active'}/></div>)}</div>:<p className="iot-empty">Nenhuma condição IoT exige atenção. O ciclo de reconhecer, adiar e dispensar continua disponível na Visão Geral.</p>}</article>

    <article className="iot-panel"><div className="iot-panel-heading"><div><p className="iot-kicker">Automação segura</p><h3>Regras de alerta</h3></div><span>{currentRules.length}</span></div>{currentRules.length?<div className="iot-rule-list">{currentRules.map(rule=><div className="iot-rule" key={rule.id}><div><strong>{rule.name}</strong><small>{ruleTypeLabel(rule.type)}{rule.metric?` · ${metricOptions.find(item=>item[0]===rule.metric)?.[1]??rule.metric}`:''}{rule.threshold!==null&&rule.threshold!==undefined?` · limiar ${rule.threshold}`:''}</small></div><div className="iot-rule-actions"><Status value={rule.enabled?'configured':'stopped'}/>{canConfigure?<button type="button" className="danger-ghost" onClick={()=>onRun('removeRule',{id:rule.id})}>Remover</button>:null}</div></div>)}</div>:<p className="iot-empty">Nenhuma regra configurada.</p>}</article>

    {canConfigure?<article className="iot-panel"><div className="iot-panel-heading"><div><p className="iot-kicker">Somente neste dispositivo</p><h3>Configuração</h3></div><span>Sem serviço obrigatório</span></div><div className="iot-setup-grid">
      <SetupForm title="Cadastrar / editar dispositivo" onSubmit={values=>onRun('saveDevice',{...values,batteryLevel:values.batteryLevel===''?null:Number(values.batteryLevel)})}>
        <label>Cadastro<select name="id" defaultValue=""><option value="">Novo dispositivo</option>{deviceOptions.map(item=><option key={item.value} value={item.value}>Editar: {item.label}</option>)}</select></label>
        <label>Nome<input name="name" required placeholder="Ex.: Sensor de umidade 01"/></label>
        <label>Tipo<input name="type" required placeholder="Ex.: sensor de solo"/></label>
        <label>Protocolo<select name="protocol" defaultValue="mqtt"><option value="mqtt">MQTT</option><option value="modbus">Modbus</option><option value="lorawan">LoRaWAN</option><option value="can">CAN/J1939</option><option value="isobus">ISOBUS</option><option value="rest">API REST</option></select></label>
        <label>Status inicial<select name="status" defaultValue="unknown"><option value="unknown">Desconhecido</option><option value="online">Online</option><option value="offline">Offline</option></select></label>
        <label>Bateria atual (%)<input name="batteryLevel" type="number" min="0" max="100" step="1"/></label>
      </SetupForm>
      <SetupForm title="Vincular ao talhão" onSubmit={values=>onRun('bindField',values)} submitLabel="Vincular">
        <label>Dispositivo<select name="deviceId" required defaultValue=""><option value="" disabled>Selecione</option>{deviceOptions.map(item=><option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
        <label>Talhão<select name="fieldId" required defaultValue=""><option value="" disabled>Selecione</option>{fieldOptions.map(item=><option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
        <label>Observação<input name="notes" placeholder="Ex.: setor norte"/></label>
      </SetupForm>
      <SetupForm title="Configurar integração" onSubmit={values=>onRun('saveAdapterConfig',{...values,port:values.port?Number(values.port):undefined})}>
        <label>Protocolo<select name="protocol" defaultValue="mqtt"><option value="mqtt">MQTT</option><option value="modbus">Modbus</option><option value="lorawan">LoRaWAN</option><option value="rest">API REST</option></select></label>
        <label>Endereço / host<input name="host" placeholder="Ex.: 192.168.1.20"/></label>
        <label>Porta<input name="port" type="number" min="1" max="65535" placeholder="1883"/></label>
        <label>Tópico / caminho<input name="topic" placeholder="Ex.: fazenda/solo"/></label>
        <label>Referência da credencial<input name="credentialRef" placeholder="Ex.: env:MQTT_PASSWORD" autoComplete="off"/></label>
        <label className="iot-check"><input name="enabled" type="checkbox"/> Ativar integração</label>
      </SetupForm>
      <SetupForm title="Criar regra de alerta" onSubmit={values=>onRun('saveRule',{...values,type:ruleType,enabled:true,threshold:values.threshold===''?undefined:Number(values.threshold),hysteresis:values.hysteresis===''?0:Number(values.hysteresis),minOccurrences:Number(values.minOccurrences||1)})}>
        <label>Nome<input name="name" required placeholder="Ex.: Solo seco"/></label>
        <label>Tipo<select name="typeSelector" value={ruleType} onChange={event=>setRuleType(event.target.value)}><option value="threshold">Limiar de leitura</option><option value="battery">Bateria baixa</option><option value="offline">Dispositivo offline</option></select></label>
        <label>Dispositivo (opcional)<select name="deviceId" defaultValue=""><option value="">Todos compatíveis</option>{deviceOptions.map(item=><option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
        {ruleType==='threshold'?<><label>Métrica<select name="metric" defaultValue="soil.moisture">{metricOptions.map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label><label>Condição<select name="operator" defaultValue="below"><option value="below">Abaixo de</option><option value="above">Acima de</option></select></label></>:null}
        {ruleType!=='offline'?<><label>Limiar<input name="threshold" type="number" step="any" required/></label><label>Histerese<input name="hysteresis" type="number" min="0" step="any" defaultValue={ruleType==='battery'?5:0}/></label></>:null}
        <label>Ocorrências seguidas<input name="minOccurrences" type="number" min="1" step="1" defaultValue="1"/></label>
        <label>Severidade<select name="severity" defaultValue="warning"><option value="info">Informativo</option><option value="warning">Atenção</option><option value="critical">Crítico</option></select></label>
      </SetupForm>
    </div><p className="iot-safety-note">A configuração habilita somente leitura, telemetria e alertas. O produto não oferece controles físicos nesta tela.</p></article>:null}
  </section>;
}
