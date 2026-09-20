import {DatabaseSync} from 'node:sqlite';
import {createIoTRepository} from '../src/iot/repository.js';
import {createThresholdRule,createOfflineRule,createLowBatteryRule} from '../src/iot/rules.js';

const RULES_COLLECTION='iot-rules:agro-lavoura';
const STATE_COLLECTION='iot-alert-state:agro-lavoura';
const nowIso=()=>new Date().toISOString();
const idFor=prefix=>globalThis.crypto?.randomUUID?.()??`${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
const text=(value,label)=>{if(typeof value!=='string'||!value.trim())throw new TypeError(`${label} is required.`);return value.trim();};
const number=(value,label)=>{const parsed=Number(value);if(!Number.isFinite(parsed))throw new TypeError(`${label} must be finite.`);return parsed;};
const int=(value,label,defaultValue=1)=>{const parsed=value==null||value===''?defaultValue:Number(value);if(!Number.isInteger(parsed)||parsed<1)throw new TypeError(`${label} must be a positive integer.`);return parsed;};
const records=items=>(items??[]).map(item=>item.payload??item);

const activeBindingByDevice=(bindings=[])=>{
  const out=new Map();
  for(const binding of bindings){
    if(binding.removedAt||out.has(binding.deviceId))continue;
    out.set(binding.deviceId,binding);
  }
  return out;
};

const safeDevice=(device,binding)=>Object.freeze({
  id:device.id,
  name:device.name,
  type:device.type,
  protocol:device.protocol,
  manufacturer:device.manufacturer??null,
  model:device.model??null,
  status:device.status??'unknown',
  lastSeenAt:device.lastSeenAt??null,
  batteryLevel:device.batteryLevel??null,
  signalStrength:device.signalStrength??null,
  fieldId:binding?.fieldId??null
});

const safeTelemetry=reading=>Object.freeze({
  id:reading.id,
  deviceId:reading.deviceId,
  metric:reading.metric,
  value:reading.value,
  unit:reading.unit,
  observedAt:reading.observedAt,
  receivedAt:reading.receivedAt,
  quality:reading.quality,
  sequence:reading.sequence??null
});

const safeIntegration=config=>Object.freeze({
  id:config.id,
  protocol:config.protocol,
  enabled:Boolean(config.enabled),
  updatedAt:config.updatedAt,
  health:Object.freeze({status:config.enabled?'configured':'stopped'})
});

const safeRule=rule=>Object.freeze({
  id:rule.id,
  name:rule.name,
  type:rule.type,
  deviceId:rule.deviceId??null,
  metric:rule.metric??null,
  operator:rule.operator??null,
  threshold:rule.threshold??null,
  hysteresis:rule.hysteresis??0,
  minOccurrences:rule.minOccurrences??1,
  severity:rule.severity??'warning',
  enabled:rule.enabled!==false
});

function normalizeRule(input={}){
  const id=typeof input.id==='string'&&input.id.trim()?input.id.trim():idFor('iot-rule');
  const name=text(input.name,'Rule name');
  const severity=String(input.severity??'warning');
  const minOccurrences=int(input.minOccurrences,'minOccurrences',1);
  const deviceId=typeof input.deviceId==='string'&&input.deviceId.trim()?input.deviceId.trim():null;
  const enabled=input.enabled!==false;
  if(input.type==='threshold'){
    const validated=createThresholdRule({id,metric:text(input.metric,'Metric'),operator:text(input.operator,'Operator'),threshold:number(input.threshold,'Threshold'),hysteresis:number(input.hysteresis??0,'Hysteresis'),minOccurrences,severity});
    return Object.freeze({...validated,name,deviceId,enabled});
  }
  if(input.type==='battery'){
    const validated=createLowBatteryRule({id,threshold:number(input.threshold??20,'Battery threshold'),hysteresis:number(input.hysteresis??5,'Hysteresis'),minOccurrences,severity});
    return Object.freeze({...validated,name,deviceId,enabled});
  }
  if(input.type==='offline'){
    const validated=createOfflineRule({id,minOccurrences,severity});
    return Object.freeze({...validated,name,deviceId,enabled});
  }
  throw new TypeError('Rule type must be threshold, battery or offline.');
}

function adapterConfig(input={}){
  const protocol=text(input.protocol,'Protocol');
  const id=typeof input.id==='string'&&input.id.trim()?input.id.trim():`adapter-${protocol}-${idFor('local').slice(-8)}`;
  const allowed=['host','port','topic','baseUrl','endpoint','serialPort','baudRate','unitId','gatewayId','clientId'];
  const config={};
  for(const key of allowed){if(input[key]!==undefined&&input[key]!==null&&input[key]!=='')config[key]=key==='port'||key==='baudRate'||key==='unitId'?Number(input[key]):String(input[key]);}
  return Object.freeze({id,protocol,enabled:Boolean(input.enabled),config:Object.freeze(config),secretRef:input.secretRef??input.credentialRef??null,updatedAt:nowIso()});
}

const alertId=(rule,device)=>`iot:${rule.id}:${device.id}`;
const stateId=(rule,device)=>`${rule.id}::${device.id}`;

export function createSqliteIoTReadProvider({dbPath,persistence=null,alerts=null,clock=nowIso}={}){
  if(typeof dbPath!=='string'||!dbPath.trim())throw new TypeError('dbPath is required.');

  async function listRules(){
    if(!persistence?.listRecords)return [];
    return records(await persistence.listRecords(RULES_COLLECTION)).map(safeRule);
  }
  async function loadState(rule,device){
    const id=stateId(rule,device);
    const record=await persistence?.getRecord?.(STATE_COLLECTION,id);
    return {record,state:record?.payload??{id,ruleId:rule.id,deviceId:device.id,active:false,count:0,lastObservationKey:null}};
  }
  async function saveState(record,state){
    if(!persistence?.putRecord)return state;
    const saved=await persistence.putRecord(STATE_COLLECTION,state.id,state,{expectedVersion:record?.version??0});
    return saved.payload;
  }
  async function dismissIfActive(id,reason){
    if(!alerts?.get||!alerts?.dismiss)return;
    const current=await alerts.get(id);
    if(current&&current.status!=='dismissed')await alerts.dismiss(id,{actorId:'iot-system',reason});
  }
  async function activateAlert(rule,device,value=null,unit=null){
    if(!alerts?.upsert)return null;
    const id=alertId(rule,device);
    return alerts.upsert({
      id,
      entityRef:{kind:'iot-device',id:device.id},
      title:rule.name,
      dueAt:clock(),
      severity:rule.severity,
      metadata:{source:'iot',ruleId:rule.id,deviceId:device.id,ruleType:rule.type,value,unit}
    });
  }
  async function evaluateRule(rule,device,latestByDeviceMetric){
    if(rule.enabled===false||rule.deviceId&&rule.deviceId!==device.id)return;
    let breach=false,clear=false,value=null,unit=null,observationKey=null;
    if(rule.type==='offline'){
      breach=device.status==='offline';clear=device.status==='online';observationKey=`status:${device.status}:${device.lastSeenAt??''}`;
    }else if(rule.type==='battery'){
      if(device.batteryLevel===null||device.batteryLevel===undefined)return;
      value=Number(device.batteryLevel);unit='%';breach=value<rule.threshold;clear=value>=rule.threshold+rule.hysteresis;observationKey=`battery:${value}:${device.lastSeenAt??''}`;
    }else if(rule.type==='threshold'){
      const reading=latestByDeviceMetric.get(`${device.id}::${rule.metric}`);if(!reading)return;
      value=Number(reading.value);unit=reading.unit??null;observationKey=`reading:${reading.id}`;
      breach=rule.operator==='below'?value<rule.threshold:value>rule.threshold;
      clear=rule.operator==='below'?value>=rule.threshold+rule.hysteresis:value<=rule.threshold-rule.hysteresis;
    }
    const {record,state}=await loadState(rule,device);
    if(state.lastObservationKey===observationKey)return;
    const next={...state,lastObservationKey:observationKey};
    if(state.active){
      if(clear){next.active=false;next.count=0;await dismissIfActive(alertId(rule,device),'Condição IoT normalizada');}
      await saveState(record,next);return;
    }
    if(!breach){next.count=0;await saveState(record,next);return;}
    next.count=(Number(state.count)||0)+1;
    if(next.count>=rule.minOccurrences){next.active=true;next.count=0;await activateAlert(rule,device,value,unit);}
    await saveState(record,next);
  }
  async function reconcileAlerts({devices,telemetry,rules}){
    if(!persistence||!alerts)return;
    const latestByDeviceMetric=new Map();
    for(const reading of telemetry){const key=`${reading.deviceId}::${reading.metric}`;if(!latestByDeviceMetric.has(key))latestByDeviceMetric.set(key,reading);}
    for(const rule of rules)for(const device of devices)await evaluateRule(rule,device,latestByDeviceMetric);
  }
  async function productIoTAlerts(){
    if(!alerts?.list)return [];
    return (await alerts.list()).filter(item=>item.metadata?.source==='iot'&&item.status!=='dismissed');
  }
  function readRaw(){
    const db=new DatabaseSync(dbPath,{readOnly:true});
    try{
      const repository=createIoTRepository(db);
      const devices=repository.listDevices(),bindings=repository.listFieldBindings(),telemetry=repository.latestTelemetry({limit:1000}),configs=repository.listAdapterConfigs();
      const activeBindings=activeBindingByDevice(bindings);
      return {devices:devices.map(device=>safeDevice(device,activeBindings.get(device.id))),telemetry:telemetry.map(safeTelemetry),integrations:configs.map(safeIntegration)};
    }finally{db.close();}
  }
  function withRepository(work){
    const db=new DatabaseSync(dbPath);
    try{return work(createIoTRepository(db),db);}finally{db.close();}
  }
  async function refreshAlerts(){
    const raw=readRaw(),rules=await listRules();
    await reconcileAlerts({...raw,rules});
    return Object.freeze(await productIoTAlerts());
  }
  async function action(name,input={}){
    if(name==='saveDevice')return withRepository(repository=>{
      const device=Object.freeze({id:typeof input.id==='string'&&input.id.trim()?input.id.trim():idFor('iot-device'),name:text(input.name,'Device name'),type:text(input.type,'Device type'),protocol:text(input.protocol,'Protocol'),manufacturer:input.manufacturer??null,model:input.model??null,gatewayId:input.gatewayId??null,status:input.status??'unknown',lastSeenAt:input.lastSeenAt??null,batteryLevel:input.batteryLevel===''||input.batteryLevel==null?null:Number(input.batteryLevel),signalStrength:input.signalStrength===''||input.signalStrength==null?null:Number(input.signalStrength),metadata:Object.freeze({})});
      return repository.saveDevice(device);
    });
    if(name==='bindField')return withRepository((repository,db)=>{
      const deviceId=text(input.deviceId,'Device id'),fieldId=text(input.fieldId,'Field id'),installedAt=clock();
      db.prepare('UPDATE iot_field_bindings SET removed_at=? WHERE device_id=? AND removed_at IS NULL').run(installedAt,deviceId);
      return repository.bindField(Object.freeze({deviceId,fieldId,installedAt,removedAt:null,position:null,notes:input.notes??null}));
    });
    if(name==='saveAdapterConfig')return withRepository(repository=>repository.saveAdapterConfig(adapterConfig(input)));
    if(name==='setAdapterEnabled')return withRepository(repository=>{
      const id=text(input.id,'Adapter id');
      const current=repository.listAdapterConfigs().find(item=>item.id===id);
      if(!current)throw new Error('IoT adapter config not found.');
      return repository.saveAdapterConfig(Object.freeze({...current,enabled:Boolean(input.enabled),updatedAt:clock()}));
    });
    if(name==='saveRule'){
      if(!persistence?.putRecord)throw new Error('IoT rule persistence is unavailable in this environment.');
      const rule=normalizeRule(input),current=await persistence.getRecord(RULES_COLLECTION,rule.id);
      const saved=await persistence.putRecord(RULES_COLLECTION,rule.id,rule,{expectedVersion:current?.version??0});return safeRule(saved.payload);
    }
    if(name==='removeRule'){
      if(!persistence?.softDeleteRecord)throw new Error('IoT rule persistence is unavailable in this environment.');
      const id=text(input.id,'Rule id'),current=await persistence.getRecord(RULES_COLLECTION,id);if(!current)throw new Error('IoT rule not found.');
      await persistence.softDeleteRecord(RULES_COLLECTION,id,{expectedVersion:current.version});
      for(const stateRecord of await persistence.listRecords(STATE_COLLECTION)){if(stateRecord.payload?.ruleId!==id)continue;await dismissIfActive(`iot:${id}:${stateRecord.payload.deviceId}`,'Regra IoT removida');await persistence.softDeleteRecord(STATE_COLLECTION,stateRecord.id,{expectedVersion:stateRecord.version});}
      return {removed:true,id};
    }
    throw new Error(`Unknown IoT setup action: ${String(name)}`);
  }

  return Object.freeze({
    action,
    refreshAlerts,
    async snapshot(){
      const raw=readRaw(),rules=await listRules();
      await reconcileAlerts({...raw,rules});
      return Object.freeze({
        available:true,
        source:'desktop-sqlite',
        readOnly:false,
        devices:Object.freeze(raw.devices),
        telemetry:Object.freeze(raw.telemetry),
        alerts:Object.freeze(await productIoTAlerts()),
        integrations:Object.freeze(raw.integrations),
        rules:Object.freeze(rules)
      });
    }
  });
}
