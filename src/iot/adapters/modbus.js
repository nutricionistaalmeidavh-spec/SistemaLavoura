import {assertIoTAdapter} from '../adapter.js';

export const MODBUS_COMMANDS_ENABLED=false;

const text=(value,label)=>{if(typeof value!=='string'||!value.trim())throw new TypeError(`${label} is required.`);return value.trim();};
const number=(value,label)=>{if(typeof value!=='number'||!Number.isFinite(value))throw new TypeError(`${label} must be finite.`);return value;};
const defaultDecoder=(values,register)=>number(values?.[0],`Modbus register ${register.address}`)*(register.scale??1)+(register.offset??0);

export function createModbusIoTAdapter({id='modbus',config={},registers=[],clientFactory}={}){
  if(typeof clientFactory!=='function')throw new TypeError('Modbus clientFactory is required and must be provided by the optional integration.');
  const adapterId=text(id,'Modbus adapter id');
  const transport=text(config.transport,'Modbus transport').toLowerCase();
  if(transport!=='tcp'&&transport!=='rtu')throw new TypeError('Modbus transport must be tcp or rtu.');
  const mapped=registers.map((register,index)=>{
    if(!register||typeof register!=='object')throw new TypeError(`Modbus register ${index} is invalid.`);
    const address=register.address;
    if(!Number.isInteger(address)||address<0)throw new TypeError('Modbus register address must be a non-negative integer.');
    const registerType=register.registerType??'holding';
    if(registerType!=='holding'&&registerType!=='input')throw new TypeError('Modbus registerType must be holding or input.');
    return Object.freeze({...register,deviceId:text(register.deviceId,'Device id'),metric:text(register.metric,'Metric'),unit:text(register.unit,'Unit'),address,registerType,length:Number.isInteger(register.length)&&register.length>0?register.length:1});
  });
  const handlers=new Set();
  let client=null,started=false,lastError=null,readErrors=0,pollCount=0;

  async function readRegister(register){
    const method=register.registerType==='input'?'readInputRegisters':'readHoldingRegisters';
    if(typeof client?.[method]!=='function')throw new TypeError(`Modbus client does not implement ${method}().`);
    const values=await client[method](register.address,register.length);
    const decoder=typeof register.decoder==='function'?register.decoder:values=>defaultDecoder(values,register);
    const value=number(await decoder(values,register),'Decoded Modbus value');
    const now=new Date().toISOString();
    return Object.freeze({
      id:`${adapterId}:${register.deviceId}:${register.metric}:${now}`,
      deviceId:register.deviceId,
      metric:register.metric,
      value,
      unit:register.unit,
      observedAt:now,
      receivedAt:now,
      quality:'good',
      sequence:null
    });
  }

  const adapter={
    id:adapterId,
    protocol:`modbus-${transport}`,
    async start(){
      if(started)return adapter.health();
      client=await clientFactory({...config});
      if(!client||typeof client.connect!=='function')throw new TypeError('Modbus client must expose connect().');
      await client.connect({...config});
      started=true;lastError=null;
      return adapter.health();
    },
    async stop(){
      const current=client;client=null;started=false;
      if(current&&typeof current.close==='function')await current.close();
      return adapter.health();
    },
    async health(){return Object.freeze({id:adapterId,protocol:`modbus-${transport}`,status:started?'online':'stopped',readErrors,pollCount,lastError,commandsEnabled:false});},
    onReading(handler){if(typeof handler!=='function')throw new TypeError('Reading handler must be a function.');handlers.add(handler);return()=>handlers.delete(handler);},
    async pollOnce(){
      if(!started||!client)throw new Error('Modbus adapter is stopped.');
      let errors=0,readings=0;pollCount+=1;
      for(const register of mapped){
        try{
          const reading=await readRegister(register);
          for(const handler of [...handlers])await handler(reading);
          readings+=1;lastError=null;
        }catch(error){errors+=1;readErrors+=1;lastError=error instanceof Error?error.message:String(error);}
      }
      return Object.freeze({readings,errors});
    },
    async executeCommand(){throw new Error('Modbus write commands are disabled by default.');}
  };
  return Object.freeze(assertIoTAdapter(adapter));
}
