import {DatabaseSync} from 'node:sqlite';
import {createIoTRepository} from '../src/iot/repository.js';

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

export function createSqliteIoTReadProvider({dbPath}={}){
  if(typeof dbPath!=='string'||!dbPath.trim())throw new TypeError('dbPath is required.');
  return Object.freeze({
    async snapshot(){
      const db=new DatabaseSync(dbPath,{readOnly:true});
      try{
        const repository=createIoTRepository(db);
        const [devices,bindings,telemetry,configs]=await Promise.all([
          Promise.resolve(repository.listDevices()),
          Promise.resolve(repository.listFieldBindings()),
          Promise.resolve(repository.latestTelemetry({limit:200})),
          Promise.resolve(repository.listAdapterConfigs())
        ]);
        const activeBindings=activeBindingByDevice(bindings);
        return Object.freeze({
          available:true,
          source:'desktop-sqlite',
          readOnly:true,
          devices:Object.freeze(devices.map(device=>safeDevice(device,activeBindings.get(device.id)))),
          telemetry:Object.freeze(telemetry.map(safeTelemetry)),
          alerts:Object.freeze([]),
          integrations:Object.freeze(configs.map(safeIntegration))
        });
      }finally{db.close();}
    }
  });
}
