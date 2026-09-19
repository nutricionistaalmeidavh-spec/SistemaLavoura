const text=(value,label)=>{if(typeof value!=='string'||!value.trim())throw new TypeError(`${label} is required.`);return value.trim();};
const now=()=>new Date().toISOString();
const newId=()=>globalThis.crypto?.randomUUID?.()??`event-${Date.now()}-${Math.random().toString(16).slice(2)}`;
const clone=value=>value==null?value:structuredClone(value);

export function createProductEventBus(persistence,{namespace}={}){
  if(!persistence?.putRecord||!persistence?.listRecords)throw new TypeError('Persistence adapter is required.');
  const ns=text(namespace,'EventBus namespace');
  const collection=`eventbus:${ns}`;
  const subscribers=new Map();
  const handlersFor=type=>[...new Set([...(subscribers.get(type)??[]),...(subscribers.get('*')??[])])];

  return Object.freeze({
    namespace:ns,
    subscribe(type,handler){
      const eventType=text(type,'Event type');
      if(typeof handler!=='function')throw new TypeError('Event handler must be a function.');
      const handlers=subscribers.get(eventType)??new Set();
      handlers.add(handler);subscribers.set(eventType,handlers);
      let active=true;
      return()=>{if(!active)return false;active=false;const current=subscribers.get(eventType);if(!current)return false;const removed=current.delete(handler);if(current.size===0)subscribers.delete(eventType);return removed;};
    },
    async publish(type,payload={},options={}){
      const eventType=text(type,'Event type');
      const id=text(options.eventId??newId(),'Event id');
      const createdAt=new Date(options.createdAt??now()).toISOString();
      const event=Object.freeze({id,type:eventType,payload:clone(payload??{}),metadata:Object.freeze({...clone(options.metadata??{})}),createdAt,status:'pending',attempts:0,deliveredAt:null,lastError:null});
      await persistence.putRecord(collection,id,event,{expectedVersion:0});
      return event;
    },
    async list({status=null,type=null}={}){
      const records=await persistence.listRecords(collection);
      return records.map(record=>record.payload).filter(event=>(!status||event.status===status)&&(!type||event.type===type)).sort((a,b)=>a.createdAt.localeCompare(b.createdAt)||a.id.localeCompare(b.id));
    },
    async flush(eventId=null){
      let records;
      if(eventId!=null){const found=await persistence.getRecord(collection,text(eventId,'Event id'));records=found?[found]:[];}
      else records=await persistence.listRecords(collection);
      let delivered=0,failed=0;
      const results=[];
      for(const record of records){
        const event=record.payload;
        if(!['pending','failed'].includes(event.status))continue;
        const failures=[];
        for(const handler of handlersFor(event.type)){
          try{await handler(event);}catch(error){failures.push({handler:handler.name||'anonymous',message:error?.message??String(error)});}
        }
        const next=Object.freeze({...event,attempts:Number(event.attempts??0)+1,status:failures.length?'failed':'delivered',deliveredAt:failures.length?null:now(),lastError:failures.length?failures.map(item=>item.message).join('; '):null});
        await persistence.putRecord(collection,event.id,next,{expectedVersion:record.version});
        if(failures.length)failed+=1;else delivered+=1;
        results.push(Object.freeze({id:event.id,type:event.type,status:next.status,failures:Object.freeze(failures)}));
      }
      return Object.freeze({delivered,failed,results:Object.freeze(results)});
    }
  });
}
