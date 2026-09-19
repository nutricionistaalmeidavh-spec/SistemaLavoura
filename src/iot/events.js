const text=(value,label)=>{if(typeof value!=='string'||!value.trim())throw new TypeError(`${label} is required.`);return value.trim();};
const optionalText=(value)=>value===null||value===undefined||value===''?null:String(value);
const iso=(value,label)=>{const source=text(value,label);const ms=Date.parse(source);if(!Number.isFinite(ms))throw new TypeError(`${label} must be a valid timestamp.`);return new Date(ms).toISOString();};
const frozen=(value={})=>Object.freeze({...value});

export const IOT_EVENT_TYPES=Object.freeze([
  'iot.device.registered',
  'iot.device.status_changed',
  'iot.telemetry.recorded',
  'iot.device.offline',
  'iot.field_binding.changed'
]);

export function createIoTEvent({eventId,type,aggregateId,occurredAt,actor=null,payload={}}={}){
  const normalizedActor=actor===null?null:frozen(actor);
  return Object.freeze({
    eventId:text(eventId,'Event id'),
    type:text(type,'Event type'),
    aggregateId:text(aggregateId,'Aggregate id'),
    occurredAt:iso(occurredAt,'Occurred at'),
    actor:normalizedActor,
    payload:frozen(payload)
  });
}

export function createTelemetryRecordedEvent({eventId,reading,actor=null}={}){
  if(!reading||typeof reading!=='object')throw new TypeError('Reading is required.');
  return createIoTEvent({
    eventId,
    type:'iot.telemetry.recorded',
    aggregateId:text(reading.deviceId,'Device id'),
    occurredAt:reading.receivedAt??reading.observedAt,
    actor,
    payload:{
      readingId:text(reading.id,'Reading id'),
      deviceId:text(reading.deviceId,'Device id'),
      metric:text(reading.metric,'Metric'),
      value:reading.value,
      unit:text(reading.unit,'Unit'),
      observedAt:iso(reading.observedAt,'Observed at'),
      quality:text(reading.quality??'good','Quality'),
      sequence:reading.sequence??null
    }
  });
}

export function createDeviceStatusChangedEvent({eventId,deviceId,previousStatus,status,occurredAt,reason=null,actor=null}={}){
  return createIoTEvent({
    eventId,
    type:'iot.device.status_changed',
    aggregateId:text(deviceId,'Device id'),
    occurredAt,
    actor,
    payload:{previousStatus:text(previousStatus,'Previous status'),status:text(status,'Status'),reason:optionalText(reason)}
  });
}

export function createDeviceRegisteredEvent({eventId,deviceId,occurredAt,actor=null,name=null,type=null,protocol=null}={}){
  return createIoTEvent({eventId,type:'iot.device.registered',aggregateId:text(deviceId,'Device id'),occurredAt,actor,payload:{name:optionalText(name),type:optionalText(type),protocol:optionalText(protocol)}});
}

export function createDeviceOfflineEvent({eventId,deviceId,occurredAt,reason=null,actor=null}={}){
  return createIoTEvent({eventId,type:'iot.device.offline',aggregateId:text(deviceId,'Device id'),occurredAt,actor,payload:{reason:optionalText(reason)}});
}

export function createFieldBindingChangedEvent({eventId,deviceId,fieldId,action,occurredAt,actor=null}={}){
  return createIoTEvent({eventId,type:'iot.field_binding.changed',aggregateId:text(deviceId,'Device id'),occurredAt,actor,payload:{fieldId:text(fieldId,'Field id'),action:text(action,'Binding action')}});
}
