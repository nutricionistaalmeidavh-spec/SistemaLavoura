const REQUIRED_TEXT=/\S/;
const METRIC_PATTERN=/^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/;
const COMMAND_STATUSES=new Set(['pending','sent','acknowledged','failed','expired','cancelled']);
const CAPABILITY_KINDS=new Set(['metric','command']);

export const AGRICULTURAL_METRICS=Object.freeze([
  'soil.moisture','soil.temperature','air.temperature','air.humidity','rainfall',
  'wind.speed','wind.direction','solar.radiation','reservoir.level','water.flow',
  'irrigation.pressure','energy.consumption','battery.level','signal.strength'
]);

function text(value,label){
  if(typeof value!=='string'||!REQUIRED_TEXT.test(value)) throw new TypeError(`${label} is required.`);
  return value.trim();
}
function optionalText(value,label){
  if(value===null||value===undefined||value==='') return null;
  return text(value,label);
}
function finite(value,label){
  if(typeof value!=='number'||!Number.isFinite(value)) throw new TypeError(`${label} must be a finite number.`);
  return value;
}
function optionalFinite(value,label,{min=-Infinity,max=Infinity}={}){
  if(value===null||value===undefined) return null;
  const result=finite(value,label);
  if(result<min||result>max) throw new RangeError(`${label} is out of range.`);
  return result;
}
function timestamp(value,label,{optional=false}={}){
  if(optional&&(value===null||value===undefined||value==='')) return null;
  const source=text(value,label);
  const millis=Date.parse(source);
  if(!Number.isFinite(millis)) throw new TypeError(`${label} must be a valid timestamp.`);
  return new Date(millis).toISOString();
}
function frozenObject(value,label){
  if(value===undefined||value===null) return Object.freeze({});
  if(typeof value!=='object'||Array.isArray(value)) throw new TypeError(`${label} must be an object.`);
  return Object.freeze({...value});
}
function optionalSequence(value){
  if(value===null||value===undefined||value==='') return null;
  if(typeof value==='number'){
    if(!Number.isSafeInteger(value)||value<0) throw new TypeError('Sequence must be a non-negative safe integer or non-empty string.');
    return value;
  }
  return text(value,'Sequence');
}

export function normalizeMetric(metric){
  const normalized=text(metric,'Metric').toLowerCase();
  if(!METRIC_PATTERN.test(normalized)) throw new TypeError('Metric must use a protocol-neutral dotted identifier.');
  return normalized;
}

export function createDevice({
  id,name,type,protocol,manufacturer=null,model=null,gatewayId=null,status='unknown',
  lastSeenAt=null,batteryLevel=null,signalStrength=null,metadata={}
}={}){
  return Object.freeze({
    id:text(id,'Device id'),
    name:text(name,'Device name'),
    type:text(type,'Device type'),
    protocol:text(protocol,'Device protocol').toLowerCase(),
    manufacturer:optionalText(manufacturer,'Manufacturer'),
    model:optionalText(model,'Model'),
    gatewayId:optionalText(gatewayId,'Gateway id'),
    status:text(status,'Device status').toLowerCase(),
    lastSeenAt:timestamp(lastSeenAt,'Last seen at',{optional:true}),
    batteryLevel:optionalFinite(batteryLevel,'Battery level',{min:0,max:100}),
    signalStrength:optionalFinite(signalStrength,'Signal strength'),
    metadata:frozenObject(metadata,'Device metadata')
  });
}

export function createDeviceCapability({deviceId,kind,key,unit=null,metadata={}}={}){
  const normalizedKind=text(kind,'Capability kind').toLowerCase();
  if(!CAPABILITY_KINDS.has(normalizedKind)) throw new TypeError('Capability kind must be metric or command.');
  const normalizedKey=normalizedKind==='metric'?normalizeMetric(key):text(key,'Capability key').toLowerCase();
  return Object.freeze({
    deviceId:text(deviceId,'Device id'),
    kind:normalizedKind,
    key:normalizedKey,
    unit:optionalText(unit,'Capability unit'),
    metadata:frozenObject(metadata,'Capability metadata')
  });
}

export function createTelemetryReading({
  id,deviceId,metric,value,unit,observedAt,receivedAt,quality='good',sequence=null,rawPayloadHash=null
}={}){
  return Object.freeze({
    id:text(id,'Reading id'),
    deviceId:text(deviceId,'Device id'),
    metric:normalizeMetric(metric),
    value:finite(value,'Telemetry value'),
    unit:text(unit,'Telemetry unit'),
    observedAt:timestamp(observedAt,'Observed at'),
    receivedAt:timestamp(receivedAt,'Received at'),
    quality:text(quality,'Telemetry quality').toLowerCase(),
    sequence:optionalSequence(sequence),
    rawPayloadHash:optionalText(rawPayloadHash,'Raw payload hash')
  });
}

export function createFieldDeviceBinding({deviceId,fieldId,installedAt,removedAt=null,position=null,notes=null}={}){
  const installed=timestamp(installedAt,'Installed at');
  const removed=timestamp(removedAt,'Removed at',{optional:true});
  if(removed&&Date.parse(removed)<Date.parse(installed)) throw new RangeError('Removed at cannot be before installed at.');
  let normalizedPosition=null;
  if(position!==null&&position!==undefined){
    if(typeof position!=='object'||Array.isArray(position)) throw new TypeError('Position must be an object.');
    const lat=finite(position.lat,'Position latitude');
    const lng=finite(position.lng,'Position longitude');
    if(lat < -90 || lat > 90 || lng < -180 || lng > 180) throw new RangeError('Position is out of geographic range.');
    normalizedPosition=Object.freeze({lat,lng});
  }
  return Object.freeze({
    deviceId:text(deviceId,'Device id'),fieldId:text(fieldId,'Field id'),installedAt:installed,
    removedAt:removed,position:normalizedPosition,notes:optionalText(notes,'Binding notes')
  });
}

export function createDeviceCommand({
  id,deviceId,command,payload={},requestedBy,requestedAt,expiresAt,status='pending',acknowledgedAt=null,failureReason=null
}={}){
  const requested=timestamp(requestedAt,'Requested at');
  const expires=timestamp(expiresAt,'Expires at');
  if(Date.parse(expires)<=Date.parse(requested)) throw new RangeError('Expires at must be after requested at.');
  const normalizedStatus=text(status,'Command status').toLowerCase();
  if(!COMMAND_STATUSES.has(normalizedStatus)) throw new TypeError('Command status is invalid.');
  return Object.freeze({
    id:text(id,'Command id'),deviceId:text(deviceId,'Device id'),command:text(command,'Command').toLowerCase(),
    payload:frozenObject(payload,'Command payload'),requestedBy:text(requestedBy,'Requested by'),requestedAt:requested,
    expiresAt:expires,status:normalizedStatus,acknowledgedAt:timestamp(acknowledgedAt,'Acknowledged at',{optional:true}),
    failureReason:optionalText(failureReason,'Failure reason')
  });
}
