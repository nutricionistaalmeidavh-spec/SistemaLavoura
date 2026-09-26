import {createCommandDispatcher} from './commands.mjs';
import {resolveEntitlements} from '../src/entitlements.js';
import {capabilityForScreen,capabilityForAction,assertEntitled} from '../src/edition-policy.js';

const credentials=(auth={})=>({sessionId:auth.sessionId,token:auth.token});
const cleanScreen=(screen)=>({id:screen.id,title:screen.title,kind:screen.kind,actionDefinitions:screen.actionDefinitions??{}});
const userId=()=>globalThis.crypto?.randomUUID?.()??`user-${Date.now()}-${Math.random().toString(16).slice(2)}`;
const ADMIN_NAVIGATION=Object.freeze({id:'admin',label:'Administração',icon:'shield',group:'Sistema'});
const ADMIN_SCREEN=Object.freeze({id:'admin',title:'Administração',kind:'admin',actionDefinitions:Object.freeze({})});
const IOT_NAVIGATION=Object.freeze({id:'iot',label:'Sensores e IoT',icon:'radio',group:'Integrações'});
const IOT_SCREEN=Object.freeze({id:'iot',title:'Sensores e IoT',kind:'iot',actionDefinitions:Object.freeze({})});
const IOT_SETUP_ACTIONS=new Set(['saveDevice','bindField','saveAdapterConfig','setAdapterEnabled','saveRule','removeRule']);
const EMPTY_IOT=Object.freeze({available:false,source:'browser',readOnly:true,reason:'desktop-required',devices:Object.freeze([]),telemetry:Object.freeze([]),alerts:Object.freeze([]),integrations:Object.freeze([]),rules:Object.freeze([]),fieldOptions:Object.freeze([]),capabilities:Object.freeze({configure:false})});

const safeIoTDevice=device=>Object.freeze({id:device?.id,name:device?.name,type:device?.type,protocol:device?.protocol,manufacturer:device?.manufacturer??null,model:device?.model??null,status:device?.status??'unknown',lastSeenAt:device?.lastSeenAt??null,batteryLevel:device?.batteryLevel??null,signalStrength:device?.signalStrength??null,fieldId:device?.fieldId??null,fieldName:device?.fieldName??null});
const safeIoTTelemetry=reading=>Object.freeze({id:reading?.id,deviceId:reading?.deviceId,metric:reading?.metric,value:reading?.value,unit:reading?.unit,observedAt:reading?.observedAt,receivedAt:reading?.receivedAt,quality:reading?.quality??'unknown',sequence:reading?.sequence??null});
const safeIoTIntegration=item=>Object.freeze({id:item?.id,protocol:item?.protocol,enabled:Boolean(item?.enabled),updatedAt:item?.updatedAt??null,health:Object.freeze({status:item?.health?.status??(item?.enabled?'configured':'stopped')})});
const safeIoTRule=rule=>Object.freeze({id:rule?.id,name:rule?.name,type:rule?.type,deviceId:rule?.deviceId??null,metric:rule?.metric??null,operator:rule?.operator??null,threshold:rule?.threshold??null,hysteresis:rule?.hysteresis??0,minOccurrences:rule?.minOccurrences??1,severity:rule?.severity??'warning',enabled:rule?.enabled!==false});
const safeIoTAlert=alert=>Object.freeze({id:alert?.id,title:alert?.title,severity:alert?.severity??'info',status:alert?.status??'active',read:alert?.read??alert?.status!=='active',occurredAt:alert?.occurredAt??alert?.createdAt??alert?.dueAt??null,deviceId:alert?.deviceId??alert?.metadata?.deviceId??null,ruleId:alert?.ruleId??alert?.metadata?.ruleId??null});
const fieldOption=record=>{const row=record?.payload??record;return Object.freeze({value:String(row?.id),label:String(row?.name??row?.code??row?.id)});};

export function createRpcBackend({presentation,iot=null,edition='complete',licenseFeatures={}}){
  if(!presentation?.screen||!presentation?.services?.security)throw new TypeError('Functional presentation with security is required.');
  const security=presentation.services.security;
  const entitlements=resolveEntitlements({edition,licenseFeatures});
  const commands=createCommandDispatcher({presentation,entitlements});
  const requireScreen=id=>assertEntitled(entitlements,capabilityForScreen(id),{screenId:id});
  const requireAction=(screenId,action)=>assertEntitled(entitlements,capabilityForAction(screenId,action),{screenId,action});
  const sanitizeData=(screenId,value)=>{
    if(!value||typeof value!=='object')return value;
    const out={...value};
    if(!entitlements.enabled('finance')){delete out.financial;delete out.costs;delete out.finance;delete out.entries;delete out.budget;delete out.results;delete out.commercial;if(out.cards)out.cards={...out.cards,resultMinor:null};}
    if(!entitlements.enabled('inventory')){delete out.inventory;delete out.stock;delete out.requirements;if(out.cards)out.cards={...out.cards,lowStock:null};}
    if(!entitlements.enabled('files'))delete out.files;
    if(!entitlements.enabled('checklists'))delete out.checklists;
    return Object.freeze(out);
  };
  async function requireSession(auth,permission=null){
    const c=credentials(auth);
    if(permission)return security.authorize({...c,permission});
    return security.authenticateSession(c);
  }
  async function allowed(auth,permission){
    try{await requireSession(auth,permission);return true;}
    catch(error){if(error?.code==='FORBIDDEN')return false;throw error;}
  }
  const permissionFor=(screenId,mode,action=null)=>security.permissionFor?.({screenId,mode,action})??null;
  async function adminSnapshot(auth){
    const c=credentials(auth);
    const session=await requireSession(auth,'users:read');
    const [users,usersWrite,auditRead,passwordChange]=await Promise.all([
      security.listUsers(c),
      allowed(auth,'users:write'),
      entitlements.enabled('audit')?allowed(auth,'audit:read'):false,
      allowed(auth,'session:revoke')
    ]);
    const audit=auditRead?await security.listAudit(c):[];
    const roles=Object.entries(security.policy??{}).map(([id,permissions])=>Object.freeze({id,permissions:Object.freeze([...permissions])}));
    return Object.freeze({currentUser:session.user,users:Object.freeze(users),roles:Object.freeze(roles),audit:Object.freeze([...audit].reverse()),capabilities:Object.freeze({usersRead:true,usersWrite,auditRead,passwordChange})});
  }
  async function adminAction({action,input={},auth}={}){
    const c=credentials(auth);
    if(action==='createUser')return security.createUser({...c,user:{id:userId(),username:input.username,password:input.password,roles:input.roles??[],active:input.active!==false}});
    if(action==='setUserRoles')return security.setUserRoles({...c,userId:input.userId,roles:input.roles??[]});
    if(action==='setUserActive')return security.setUserActive({...c,userId:input.userId,active:input.active});
    if(action==='changePassword')return security.changePassword({...c,currentPassword:input.currentPassword,newPassword:input.newPassword});
    throw new Error(`Unknown admin action: ${String(action)}`);
  }
  async function iotFieldOptions(){
    try{const fields=await presentation.load('fields',{});return Object.freeze((fields?.rows??[]).map(fieldOption));}
    catch{return Object.freeze([]);}
  }
  async function iotSnapshot(auth){
    await requireSession(auth,'iot:read');
    const configure=await allowed(auth,'iot:configure');
    if(typeof iot?.snapshot!=='function')return EMPTY_IOT;
    const value=await iot.snapshot();
    const options=await iotFieldOptions();
    const names=new Map(options.map(item=>[item.value,item.label]));
    return Object.freeze({
      available:value?.available!==false,
      source:value?.source??'desktop',
      readOnly:value?.readOnly!==false,
      reason:value?.reason??null,
      devices:Object.freeze((value?.devices??[]).map(item=>safeIoTDevice({...item,fieldName:item.fieldName??names.get(String(item.fieldId))??null}))),
      telemetry:Object.freeze((value?.telemetry??[]).map(safeIoTTelemetry)),
      alerts:Object.freeze((value?.alerts??[]).map(safeIoTAlert)),
      integrations:Object.freeze((value?.integrations??[]).map(safeIoTIntegration)),
      rules:Object.freeze((value?.rules??[]).map(safeIoTRule)),
      fieldOptions:options,
      capabilities:Object.freeze({configure:configure&&value?.available!==false&&typeof iot?.action==='function'})
    });
  }
  async function iotAction({action,input={},auth}={}){
    if(!IOT_SETUP_ACTIONS.has(action))throw new Error(`Unknown IoT setup action: ${String(action)}`);
    if(typeof iot?.action!=='function')throw new Error('IoT setup requires the local desktop runtime.');
    const c=credentials(auth);
    const entityId=input?.id??input?.deviceId??null;
    const execution=await security.execute({...c,permission:'iot:configure',action:`iot.${action}`,entityType:'iot-setup',entityId,metadata:{protocol:input?.protocol??null,ruleType:input?.type??null}},()=>iot.action(action,input));
    return execution.result;
  }
  async function describe(auth=null){
    const baseNavigation=presentation.shell.navigation.filter(item=>entitlements.enabled(capabilityForScreen(item.id))).map(item=>({...item}));
    const baseScreens=presentation.screenIds().filter(id=>entitlements.enabled(capabilityForScreen(id))).map(id=>cleanScreen(presentation.screen(id)));
    if(!auth)return {productId:security.productId,edition:entitlements.edition,brand:presentation.shell.brand,navigation:baseNavigation,screens:baseScreens};
    const navigation=[],screens=[];
    for(const item of baseNavigation){
      if(await allowed(auth,permissionFor(item.id,'read'))){navigation.push(item);const screen=baseScreens.find(value=>value.id===item.id);if(screen)screens.push(screen);}
    }
    if(entitlements.enabled('iot')&&await allowed(auth,'iot:read')){navigation.push({...IOT_NAVIGATION});screens.push({...IOT_SCREEN});}
    if(entitlements.enabled('admin')&&await allowed(auth,'users:read')){navigation.push({...ADMIN_NAVIGATION});screens.push({...ADMIN_SCREEN});}
    return {productId:security.productId,edition:entitlements.edition,brand:presentation.shell.brand,navigation,screens};
  }
  return Object.freeze({
    describe,
    async authState(){return {hasUsers:await security.hasUsers()};},
    async bootstrap({username,password}={}){const id=globalThis.crypto?.randomUUID?.()??`admin-${Date.now()}`;return security.bootstrapUser({id,username,password,roles:['admin'],active:true});},
    async login({username,password}={}){return security.authenticate({username,password});},
    async validate(auth){return requireSession(auth);},
    async logout(auth){return security.revoke(credentials(auth));},
    async load({screenId,auth,context={}}={}){
      requireScreen(screenId);
      if(screenId==='admin')return adminSnapshot(auth);
      if(screenId==='iot')return iotSnapshot(auth);
      await requireSession(auth,permissionFor(screenId,'read'));
      if(screenId==='overview'&&typeof iot?.refreshAlerts==='function'&&await allowed(auth,'iot:read'))await iot.refreshAlerts();
      return sanitizeData(screenId,await presentation.load(screenId,context));
    },
    async action({screenId,action,input={},auth,context={}}={}){requireAction(screenId,action);if(screenId==='admin')return adminAction({action,input,auth});if(screenId==='iot')return iotAction({action,input,auth});return commands.execute({screenId,action,input,auth,context});}
  });
}
