import {assertIoTAdapter} from '../adapter.js';

const defaultMapper=({payload})=>JSON.parse(typeof payload==='string'?payload:payload.toString('utf8'));
const text=(value,label)=>{if(typeof value!=='string'||!value.trim())throw new TypeError(`${label} is required.`);return value.trim();};

export function createMqttIoTAdapter({id='mqtt',config={},clientFactory,messageMapper=defaultMapper}={}){
  if(typeof clientFactory!=='function') throw new TypeError('MQTT clientFactory is required and must be provided by the optional integration.');
  if(typeof messageMapper!=='function') throw new TypeError('MQTT messageMapper must be a function.');
  const adapterId=text(id,'MQTT adapter id');
  const url=text(config.url,'MQTT URL');
  const topics=Array.isArray(config.topics)&&config.topics.length?config.topics.map(topic=>text(topic,'MQTT topic')):[];
  if(!topics.length)throw new TypeError('At least one MQTT topic is required.');
  const handlers=new Set();
  let client=null,started=false,lastError=null,parseErrors=0,transportErrors=0;

  const onMessage=async(topic,payload)=>{
    let reading;
    try{reading=await messageMapper({topic,payload});}
    catch(error){parseErrors+=1;lastError=error instanceof Error?error.message:String(error);return;}
    for(const handler of [...handlers])await handler(reading);
  };
  const onError=(error)=>{transportErrors+=1;lastError=error instanceof Error?error.message:String(error);};
  const onConnect=()=>{lastError=null;};
  const onClose=()=>{};

  const adapter={
    id:adapterId,
    protocol:'mqtt',
    async start(){
      if(started)return adapter.health();
      const options={...config,url,topics:[...topics]};
      client=await clientFactory(options);
      if(!client||typeof client.on!=='function'||typeof client.subscribe!=='function')throw new TypeError('MQTT client must expose on() and subscribe().');
      client.on('message',onMessage);client.on('error',onError);client.on('connect',onConnect);client.on('close',onClose);
      for(const topic of topics){
        await new Promise((resolve,reject)=>client.subscribe(topic,{qos:config.qos??0},error=>error?reject(error):resolve()));
      }
      started=true;lastError=null;
      return adapter.health();
    },
    async stop(){
      if(!started&&!client)return adapter.health();
      const current=client;client=null;started=false;
      if(current){
        current.off?.('message',onMessage);current.off?.('error',onError);current.off?.('connect',onConnect);current.off?.('close',onClose);
        if(typeof current.end==='function')await new Promise((resolve,reject)=>current.end(false,{},error=>error?reject(error):resolve()));
      }
      return adapter.health();
    },
    async health(){
      const status=started?(client?.connected===false?'offline':'online'):'stopped';
      return Object.freeze({id:adapterId,protocol:'mqtt',status,parseErrors,transportErrors,lastError,subscriptions:Object.freeze([...topics])});
    },
    onReading(handler){if(typeof handler!=='function')throw new TypeError('Reading handler must be a function.');handlers.add(handler);return()=>handlers.delete(handler);}
  };
  return Object.freeze(assertIoTAdapter(adapter));
}
