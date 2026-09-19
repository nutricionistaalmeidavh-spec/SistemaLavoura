const text=(value,label)=>{if(typeof value!=='string'||!value.trim())throw new TypeError(`${label} is required.`);return value.trim();};
const finite=(value,label)=>{if(typeof value!=='number'||!Number.isFinite(value))throw new TypeError(`${label} must be finite.`);return value;};
const positiveInt=(value,label)=>{if(!Number.isInteger(value)||value<1)throw new TypeError(`${label} must be a positive integer.`);return value;};

export function createThresholdRule({id,metric,operator,threshold,hysteresis=0,minOccurrences=1,severity='warning'}={}){
  const op=text(operator,'Operator');
  if(op!=='below'&&op!=='above')throw new TypeError('Operator must be below or above.');
  const h=finite(hysteresis,'Hysteresis');if(h<0)throw new RangeError('Hysteresis cannot be negative.');
  return Object.freeze({type:'threshold',id:text(id,'Rule id'),metric:text(metric,'Metric'),operator:op,threshold:finite(threshold,'Threshold'),hysteresis:h,minOccurrences:positiveInt(minOccurrences,'minOccurrences'),severity:text(severity,'Severity')});
}

export function createOfflineRule({id='device-offline',severity='warning',minOccurrences=1}={}){
  return Object.freeze({type:'offline',id:text(id,'Rule id'),severity:text(severity,'Severity'),minOccurrences:positiveInt(minOccurrences,'minOccurrences')});
}

export function createLowBatteryRule({id='low-battery',threshold=20,hysteresis=5,severity='warning',minOccurrences=1}={}){
  const t=finite(threshold,'Battery threshold'),h=finite(hysteresis,'Hysteresis');
  if(t<0||t>100)throw new RangeError('Battery threshold must be between 0 and 100.');
  if(h<0)throw new RangeError('Hysteresis cannot be negative.');
  return Object.freeze({type:'battery',id:text(id,'Rule id'),threshold:t,hysteresis:h,severity:text(severity,'Severity'),minOccurrences:positiveInt(minOccurrences,'minOccurrences')});
}

function createAlert({rule,deviceId,kind,value=null,unit=null,state}){
  return Object.freeze({ruleId:rule.id,deviceId,severity:rule.severity,kind,value,unit,state});
}

export function createIoTRuleEngine({rules=[]}={}){
  const configured=Object.freeze([...rules]);
  const states=new Map();
  const keyFor=(rule,deviceId)=>`${rule.id}::${deviceId}`;
  const stateFor=(rule,deviceId)=>{
    const key=keyFor(rule,deviceId);
    if(!states.has(key))states.set(key,{active:false,count:0});
    return states.get(key);
  };

  function apply({rule,deviceId,breach,clear,kind,value=null,unit=null}){
    const state=stateFor(rule,deviceId);
    if(state.active){
      if(clear){state.active=false;state.count=0;return createAlert({rule,deviceId,kind,value,unit,state:'cleared'});}
      return null;
    }
    if(!breach){state.count=0;return null;}
    state.count+=1;
    if(state.count<rule.minOccurrences)return null;
    state.active=true;state.count=0;
    return createAlert({rule,deviceId,kind,value,unit,state:'active'});
  }

  function evaluateTelemetry(reading){
    if(!reading||typeof reading!=='object')throw new TypeError('Telemetry reading is required.');
    const alerts=[];
    for(const rule of configured){
      if(rule.type!=='threshold'||rule.metric!==reading.metric)continue;
      const value=finite(reading.value,'Telemetry value');
      const breach=rule.operator==='below'?value<rule.threshold:value>rule.threshold;
      const clear=rule.operator==='below'?value>=rule.threshold+rule.hysteresis:value<=rule.threshold-rule.hysteresis;
      const alert=apply({rule,deviceId:text(reading.deviceId,'Device id'),breach,clear,kind:`metric.${rule.operator}`,value,unit:reading.unit??null});
      if(alert)alerts.push(alert);
    }
    return Object.freeze(alerts);
  }

  function evaluateDevice(device){
    if(!device||typeof device!=='object')throw new TypeError('Device is required.');
    const deviceId=text(device.id,'Device id'),alerts=[];
    for(const rule of configured){
      if(rule.type==='offline'){
        const breach=device.status==='offline';
        const clear=device.status==='online';
        const alert=apply({rule,deviceId,breach,clear,kind:'device.offline'});if(alert)alerts.push(alert);
      }else if(rule.type==='battery'&&device.batteryLevel!==null&&device.batteryLevel!==undefined){
        const value=finite(device.batteryLevel,'Battery level');
        const breach=value<rule.threshold,clear=value>=rule.threshold+rule.hysteresis;
        const alert=apply({rule,deviceId,breach,clear,kind:'battery.low',value,unit:'%'});if(alert)alerts.push(alert);
      }
    }
    return Object.freeze(alerts);
  }

  return Object.freeze({evaluateTelemetry,evaluateDevice,rules:configured});
}
