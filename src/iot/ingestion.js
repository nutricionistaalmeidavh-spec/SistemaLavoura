import {assertIoTAdapter} from './adapter.js';
import {createTelemetryReading} from './domain.js';

const defaultClock=()=>new Date();
const noopPublisher=async()=>{};
const errorMessage=(error)=>error instanceof Error?error.message:String(error);

function asIso(clock){
  const value=clock();
  const date=value instanceof Date?value:new Date(value);
  if(!Number.isFinite(date.getTime())) throw new TypeError('Clock must return a valid date.');
  return date.toISOString();
}

function normalizeRawReading(raw,clock){
  if(!raw||typeof raw!=='object'||Array.isArray(raw)) throw new TypeError('Telemetry reading must be an object.');
  const receivedAt=raw.receivedAt??asIso(clock);
  const observedAt=raw.observedAt??receivedAt;
  const sequence=raw.sequence??null;
  const id=raw.id??`${String(raw.deviceId??'device')}:${String(sequence??observedAt)}`;
  return createTelemetryReading({...raw,id,receivedAt,observedAt,sequence});
}

export function createIoTIngestionService({repository,eventPublisher=noopPublisher,clock=defaultClock}={}){
  if(!repository||typeof repository.appendTelemetry!=='function') throw new TypeError('IoT repository with appendTelemetry() is required.');
  if(typeof eventPublisher!=='function') throw new TypeError('eventPublisher must be a function.');
  if(typeof clock!=='function') throw new TypeError('clock must be a function.');

  const entries=new Map();

  const snapshot=(entry)=>Object.freeze({
    id:entry.adapter.id,
    protocol:entry.adapter.protocol,
    started:entry.started,
    lastError:entry.lastError,
    publishErrors:entry.publishErrors,
    readingsAccepted:entry.readingsAccepted,
    duplicates:entry.duplicates,
    invalidReadings:entry.invalidReadings
  });

  async function handleReading(entry,raw){
    let reading;
    try{
      reading=normalizeRawReading(raw,clock);
    }catch(error){
      entry.invalidReadings+=1;
      entry.lastError=errorMessage(error);
      throw error;
    }

    let stored;
    try{
      stored=await repository.appendTelemetry(reading);
    }catch(error){
      entry.lastError=errorMessage(error);
      throw error;
    }

    if(!stored?.inserted){
      entry.duplicates+=1;
      return Object.freeze({inserted:false,reading});
    }

    entry.readingsAccepted+=1;
    entry.lastError=null;
    try{
      await eventPublisher(Object.freeze({
        type:'iot.telemetry.recorded',
        aggregateId:reading.deviceId,
        occurredAt:reading.receivedAt,
        actor:null,
        payload:Object.freeze({reading})
      }));
    }catch(error){
      entry.publishErrors+=1;
      entry.lastError=errorMessage(error);
    }
    return Object.freeze({inserted:true,reading});
  }

  function attach(candidate){
    const adapter=assertIoTAdapter(candidate);
    if(entries.has(adapter.id)) throw new Error(`IoT adapter ${adapter.id} is already attached.`);
    const entry={adapter,unsubscribe:null,started:false,lastError:null,publishErrors:0,readingsAccepted:0,duplicates:0,invalidReadings:0};
    entry.unsubscribe=adapter.onReading(raw=>handleReading(entry,raw));
    entries.set(adapter.id,entry);
    return adapter.id;
  }

  async function detach(id){
    const entry=entries.get(id);
    if(!entry) return false;
    try{if(entry.started) await entry.adapter.stop();}finally{
      entry.started=false;
      entry.unsubscribe?.();
      entries.delete(id);
    }
    return true;
  }

  async function startAll(context={}){
    const result={};
    for(const [id,entry] of entries){
      try{
        await entry.adapter.start(context);
        entry.started=true;
        entry.lastError=null;
        result[id]=Object.freeze({started:true,error:null});
      }catch(error){
        entry.started=false;
        entry.lastError=errorMessage(error);
        result[id]=Object.freeze({started:false,error:entry.lastError});
      }
    }
    return Object.freeze(result);
  }

  async function stopAll(){
    const result={};
    for(const [id,entry] of entries){
      try{
        await entry.adapter.stop();
        entry.started=false;
        entry.lastError=null;
        result[id]=Object.freeze({stopped:true,error:null});
      }catch(error){
        entry.lastError=errorMessage(error);
        result[id]=Object.freeze({stopped:false,error:entry.lastError});
      }
    }
    return Object.freeze(result);
  }

  function status(){
    const adapters={};
    for(const [id,entry] of entries) adapters[id]=snapshot(entry);
    return Object.freeze({adapters:Object.freeze(adapters)});
  }

  return Object.freeze({attach,detach,startAll,stopAll,status});
}
