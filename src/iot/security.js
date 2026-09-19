export const IOT_PERMISSIONS=Object.freeze({
  READ:'iot:read',
  MANAGE:'iot:manage',
  CONFIGURE:'iot:configure',
  COMMAND:'iot:command'
});

export const IOT_ROLE_PERMISSIONS=Object.freeze({
  admin:Object.freeze(['*']),
  manager:Object.freeze([IOT_PERMISSIONS.READ,IOT_PERMISSIONS.MANAGE,IOT_PERMISSIONS.CONFIGURE]),
  'field-operator':Object.freeze([IOT_PERMISSIONS.READ]),
  warehouse:Object.freeze([IOT_PERMISSIONS.READ]),
  viewer:Object.freeze([])
});

export function canIoT({roles=[],permissions=[],permission}={}){
  if(typeof permission!=='string'||!permission.trim()) throw new TypeError('IoT permission is required.');
  const explicit=new Set(Array.isArray(permissions)?permissions:[]);
  if(explicit.has('*')||explicit.has(permission)) return true;
  for(const role of Array.isArray(roles)?roles:[]){
    const granted=IOT_ROLE_PERMISSIONS[role]??[];
    if(granted.includes('*')||granted.includes(permission)) return true;
  }
  return false;
}

const requiredText=(value,label)=>{if(typeof value!=='string'||!value.trim())throw new TypeError(`${label} is required.`);return value.trim();};
const safeMetadata=(value={})=>Object.freeze({...value});

export function createIoTSecurityService({authorize,audit=async()=>{},clock=()=>new Date()}={}){
  if(typeof authorize!=='function') throw new TypeError('authorize() is required.');
  if(typeof audit!=='function') throw new TypeError('audit() must be a function.');
  if(typeof clock!=='function') throw new TypeError('clock() must be a function.');

  async function requirePermission({permission,actorId=null,context={}}={}){
    requiredText(permission,'Permission');
    return authorize({permission,actorId,context});
  }

  async function runAudited({permission,action,actorId,entityType,entityId,metadata={},context={}}={},work){
    if(typeof work!=='function') throw new TypeError('Audited work must be a function.');
    const normalized={
      permission:requiredText(permission,'Permission'),
      action:requiredText(action,'Audit action'),
      actorId:requiredText(actorId,'Actor id'),
      entityType:requiredText(entityType,'Entity type'),
      entityId:requiredText(entityId,'Entity id'),
      metadata:safeMetadata(metadata),
      context
    };
    await requirePermission(normalized);
    const result=await work();
    const now=clock();
    const occurredAt=(now instanceof Date?now:new Date(now)).toISOString();
    await audit(Object.freeze({
      actorId:normalized.actorId,
      action:normalized.action,
      entityType:normalized.entityType,
      entityId:normalized.entityId,
      occurredAt,
      metadata:normalized.metadata
    }));
    return result;
  }

  return Object.freeze({requirePermission,runAudited});
}
