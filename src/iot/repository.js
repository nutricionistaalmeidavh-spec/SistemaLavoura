const parseJson=(value,fallback={})=>{try{return value?JSON.parse(value):fallback;}catch{return fallback;}};
const stringify=(value)=>JSON.stringify(value??{});
const bool=(value)=>Boolean(Number(value));

function assertDb(db){
  if(!db||typeof db.prepare!=='function') throw new TypeError('SQLite database with prepare() is required.');
  return db;
}

function deviceFromRow(row){
  return Object.freeze({
    id:row.id,name:row.name,type:row.type,protocol:row.protocol,manufacturer:row.manufacturer??null,
    model:row.model??null,gatewayId:row.gateway_id??null,status:row.status,lastSeenAt:row.last_seen_at??null,
    batteryLevel:row.battery_level??null,signalStrength:row.signal_strength??null,
    metadata:Object.freeze(parseJson(row.metadata_json,{}))
  });
}
function bindingFromRow(row){
  return Object.freeze({
    deviceId:row.device_id,fieldId:row.field_id,installedAt:row.installed_at,removedAt:row.removed_at??null,
    position:row.position_json?Object.freeze(parseJson(row.position_json,null)):null,notes:row.notes??null
  });
}
function telemetryFromRow(row){
  return Object.freeze({
    id:row.id,deviceId:row.device_id,metric:row.metric,value:row.value,unit:row.unit,
    observedAt:row.observed_at,receivedAt:row.received_at,quality:row.quality,
    sequence:row.sequence===null?null:(/^\d+$/.test(row.sequence)?Number(row.sequence):row.sequence),
    rawPayloadHash:row.raw_payload_hash??null
  });
}
function configFromRow(row){
  return Object.freeze({
    id:row.id,protocol:row.protocol,enabled:bool(row.enabled),config:Object.freeze(parseJson(row.config_json,{})),
    secretRef:row.secret_ref??null,updatedAt:row.updated_at
  });
}
function commandFromRow(row){
  return Object.freeze({
    id:row.id,
    deviceId:row.device_id,
    command:row.command,
    payload:Object.freeze(parseJson(row.payload_json,{})),
    requestedBy:row.requested_by,
    requestedAt:row.requested_at,
    expiresAt:row.expires_at,
    status:row.status,
    acknowledgedAt:row.acknowledged_at??null,
    failureReason:row.failure_reason??null
  });
}

export function createIoTRepository(database){
  const db=assertDb(database);
  const saveDeviceStmt=db.prepare(`
    INSERT INTO iot_devices(id,name,type,protocol,manufacturer,model,gateway_id,status,last_seen_at,battery_level,signal_strength,metadata_json)
    VALUES(?,?,?,?,?,?,?,?,?,?,?,?)
    ON CONFLICT(id) DO UPDATE SET
      name=excluded.name,type=excluded.type,protocol=excluded.protocol,manufacturer=excluded.manufacturer,
      model=excluded.model,gateway_id=excluded.gateway_id,status=excluded.status,last_seen_at=excluded.last_seen_at,
      battery_level=excluded.battery_level,signal_strength=excluded.signal_strength,metadata_json=excluded.metadata_json`);
  const bindFieldStmt=db.prepare(`
    INSERT INTO iot_field_bindings(device_id,field_id,installed_at,removed_at,position_json,notes)
    VALUES(?,?,?,?,?,?)
    ON CONFLICT(device_id,field_id,installed_at) DO UPDATE SET
      removed_at=excluded.removed_at,position_json=excluded.position_json,notes=excluded.notes`);
  const telemetryStmt=db.prepare(`
    INSERT OR IGNORE INTO iot_telemetry(id,device_id,metric,value,unit,observed_at,received_at,quality,sequence,raw_payload_hash)
    VALUES(?,?,?,?,?,?,?,?,?,?)`);
  const saveConfigStmt=db.prepare(`
    INSERT INTO iot_adapter_configs(id,protocol,enabled,config_json,secret_ref,updated_at)
    VALUES(?,?,?,?,?,?)
    ON CONFLICT(id) DO UPDATE SET protocol=excluded.protocol,enabled=excluded.enabled,config_json=excluded.config_json,
      secret_ref=excluded.secret_ref,updated_at=excluded.updated_at`);
  const saveCommandStmt=db.prepare(`
    INSERT INTO iot_commands(id,device_id,command,payload_json,requested_by,requested_at,expires_at,status,acknowledged_at,failure_reason)
    VALUES(?,?,?,?,?,?,?,?,?,?)
    ON CONFLICT(id) DO UPDATE SET
      device_id=excluded.device_id,command=excluded.command,payload_json=excluded.payload_json,
      requested_by=excluded.requested_by,requested_at=excluded.requested_at,expires_at=excluded.expires_at,
      status=excluded.status,acknowledged_at=excluded.acknowledged_at,failure_reason=excluded.failure_reason`);
  const getCommandStmt=db.prepare('SELECT * FROM iot_commands WHERE id=?');

  return Object.freeze({
    saveDevice(device){
      saveDeviceStmt.run(
        device.id,device.name,device.type,device.protocol,device.manufacturer??null,device.model??null,device.gatewayId??null,
        device.status??'unknown',device.lastSeenAt??null,device.batteryLevel??null,device.signalStrength??null,stringify(device.metadata)
      );
      return device;
    },
    listDevices(){return db.prepare('SELECT * FROM iot_devices ORDER BY name,id').all().map(deviceFromRow);},
    bindField(binding){
      bindFieldStmt.run(binding.deviceId,binding.fieldId,binding.installedAt,binding.removedAt??null,binding.position?stringify(binding.position):null,binding.notes??null);
      return binding;
    },
    listFieldBindings({deviceId=null,fieldId=null}={}){
      const clauses=[],args=[];
      if(deviceId){clauses.push('device_id=?');args.push(deviceId);}
      if(fieldId){clauses.push('field_id=?');args.push(fieldId);}
      const where=clauses.length?` WHERE ${clauses.join(' AND ')}`:'';
      return db.prepare(`SELECT * FROM iot_field_bindings${where} ORDER BY installed_at DESC`).all(...args).map(bindingFromRow);
    },
    appendTelemetry(reading){
      const result=telemetryStmt.run(
        reading.id,reading.deviceId,reading.metric,reading.value,reading.unit,reading.observedAt,reading.receivedAt,
        reading.quality??'good',reading.sequence===null||reading.sequence===undefined?null:String(reading.sequence),reading.rawPayloadHash??null
      );
      return Object.freeze({inserted:Number(result.changes)>0,reading});
    },
    latestTelemetry({deviceId=null,metric=null,limit=50}={}){
      const safeLimit=Math.max(1,Math.min(1000,Number.isInteger(limit)?limit:50));
      const clauses=[],args=[];
      if(deviceId){clauses.push('device_id=?');args.push(deviceId);}
      if(metric){clauses.push('metric=?');args.push(metric);}
      const where=clauses.length?` WHERE ${clauses.join(' AND ')}`:'';
      return db.prepare(`SELECT * FROM iot_telemetry${where} ORDER BY observed_at DESC,received_at DESC LIMIT ?`).all(...args,safeLimit).map(telemetryFromRow);
    },
    saveAdapterConfig(config){
      saveConfigStmt.run(config.id,config.protocol,config.enabled?1:0,stringify(config.config),config.secretRef??null,config.updatedAt);
      return config;
    },
    listAdapterConfigs(){return db.prepare('SELECT * FROM iot_adapter_configs ORDER BY id').all().map(configFromRow);},
    saveCommand(command){
      saveCommandStmt.run(
        command.id,command.deviceId,command.command,stringify(command.payload),command.requestedBy,
        command.requestedAt,command.expiresAt,command.status,command.acknowledgedAt??null,command.failureReason??null
      );
      return command;
    },
    getCommand(id){
      const row=getCommandStmt.get(id);
      return row?commandFromRow(row):null;
    },
    listCommands({deviceId=null,status=null,limit=100}={}){
      const safeLimit=Math.max(1,Math.min(1000,Number.isInteger(limit)?limit:100));
      const clauses=[],args=[];
      if(deviceId){clauses.push('device_id=?');args.push(deviceId);}
      if(status){clauses.push('status=?');args.push(status);}
      const where=clauses.length?` WHERE ${clauses.join(' AND ')}`:'';
      return db.prepare(`SELECT * FROM iot_commands${where} ORDER BY requested_at DESC,id DESC LIMIT ?`).all(...args,safeLimit).map(commandFromRow);
    }
  });
}
