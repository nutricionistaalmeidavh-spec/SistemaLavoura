const METRIC_LABELS=Object.freeze({
  'soil.moisture':'Umidade do solo',
  'soil.temperature':'Temperatura do solo',
  'air.temperature':'Temperatura do ar',
  'air.humidity':'Umidade do ar',
  rainfall:'Chuva',
  'wind.speed':'Velocidade do vento',
  'wind.direction':'Direção do vento',
  'solar.radiation':'Radiação solar',
  'reservoir.level':'Nível do reservatório',
  'water.flow':'Vazão de água',
  'irrigation.pressure':'Pressão de irrigação',
  'energy.consumption':'Consumo de energia'
});

export function buildDeviceRows(devices=[]){
  return devices.map(device=>Object.freeze({
    id:device.id,
    name:device.name,
    type:device.type,
    protocol:device.protocol,
    status:device.status??'unknown',
    field:device.fieldName??device.fieldId??'Não vinculado',
    battery:device.batteryLevel??null,
    signal:device.signalStrength??null,
    lastSeenAt:device.lastSeenAt??null
  }));
}

export function buildIntegrationRows(integrations=[]){
  return integrations.map(item=>Object.freeze({
    id:item.id,
    protocol:item.protocol,
    optional:true,
    enabled:Boolean(item.enabled),
    status:item.health?.status??(item.enabled?'unknown':'stopped')
  }));
}

export function buildIoTOverviewModel({devices=[],telemetry=[],alerts=[]}={}){
  const deviceRows=buildDeviceRows(devices);
  const online=deviceRows.filter(item=>item.status==='online').length;
  const offline=deviceRows.filter(item=>item.status==='offline').length;
  const latestByMetric=new Map();
  for(const reading of telemetry){
    const current=latestByMetric.get(reading.metric);
    if(!current||Date.parse(reading.observedAt??0)>Date.parse(current.observedAt??0)) latestByMetric.set(reading.metric,reading);
  }
  const latestMetrics=[...latestByMetric.values()].map(reading=>Object.freeze({
    deviceId:reading.deviceId,
    metric:reading.metric,
    label:METRIC_LABELS[reading.metric]??reading.metric,
    value:reading.value,
    unit:reading.unit,
    observedAt:reading.observedAt
  }));
  return Object.freeze({
    cards:Object.freeze({devices:deviceRows.length,online,offline,unreadAlerts:alerts.filter(alert=>!alert.read).length}),
    latestMetrics:Object.freeze(latestMetrics),
    devices:Object.freeze(deviceRows)
  });
}
