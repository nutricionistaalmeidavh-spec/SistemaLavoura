import {createCommandDispatcher} from './commands.mjs';

const credentials=(auth={})=>({sessionId:auth.sessionId,token:auth.token});
const cleanScreen=(screen)=>({id:screen.id,title:screen.title,kind:screen.kind,actionDefinitions:screen.actionDefinitions??{}});
const userId=()=>globalThis.crypto?.randomUUID?.()??`user-${Date.now()}-${Math.random().toString(16).slice(2)}`;
const ADMIN_NAVIGATION=Object.freeze({id:'admin',label:'Administração',icon:'shield',group:'Sistema'});
const ADMIN_SCREEN=Object.freeze({id:'admin',title:'Administração',kind:'admin',actionDefinitions:Object.freeze({})});
const IOT_NAVIGATION=Object.freeze({id:'iot',label:'Sensores e IoT',icon:'radio',group:'Integrações'});
const IOT_SCREEN=Object.freeze({id:'iot',title:'Sensores e IoT',kind:'iot',actionDefinitions:Object.freeze({})});
const EMPTY_IOT=Object.freeze({available:false,source:'browser',readOnly:true,reason:'desktop-required',devices:Object.freeze([]),telemetry:Object.freeze([]),alerts:Object.freeze([]),integrations:Object.freeze([])});

const safeIoTDevice=device=>Object.freeze({id:device?.id,name:device?.name,type:device?.type,protocol:device?.protocol,status:device?.status??'unknown',lastSeenAt:device?.lastSeenAt??null,batteryLevel:device?.batteryLevel??null,signalStrength:device?.signalStrength??null,fieldId:device?.fieldId??null,fieldName:device?.fieldName??null});
const safeIoTTelemetry=reading=>Object.freeze({id:reading?.id,deviceId:reading?.deviceId,metric:reading?.metric,value:reading?.value,unit:reading?.unit,observedAt:reading?.observedAt,receivedAt:reading?.receivedAt,quality:reading?.quality??'unknown',sequence:reading?.sequence??null});
const safeIoTIntegration=item=>Object.freeze({id:item?.id,protocol:item?.protocol,enabled:Boolean(item?.enabled),updatedAt:item?.updatedAt??null,health:Object.freeze({status:item?.health?.status??(item?.enabled?'configured':'stopped')})});
const safeIoTAlert=alert=>Object.freeze({id:alert?.id,title:alert?.title,severity:alert?.severity??'info',read:Boolean(alert?.read),occurredAt:alert?.occurredAt??alert?.createdAt??null,deviceId:alert?.deviceId??null});

export function createRpcBackend({presentation,iot=null}){
  if(!presentation?.screen||!presentation?.services?.security)throw new TypeError('Functional presentation with security is required.');
  const security=presentation.services.security;
  const commands=createCommandDispatcher({presentation});
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
      allowed(auth,'audit:read'),
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
  async function iotSnapshot(auth){
    await requireSession(auth,'iot:read');
    if(typeof iot?.snapshot!=='function')return EMPTY_IOT;
    const value=await iot.snapshot();
    return Object.freeze({
      available:value?.available!==false,
      source:value?.source??'desktop',
      readOnly:true,
      reason:value?.reason??null,
      devices:Object.freeze((value?.devices??[]).map(safeIoTDevice)),
      telemetry:Object.freeze((value?.telemetry??[]).map(safeIoTTelemetry)),
      alerts:Object.freeze((value?.alerts??[]).map(safeIoTAlert)),
      integrations:Object.freeze((value?.integrations??[]).map(safeIoTIntegration))
    });
  }
  async function describe(auth=null){
    const baseNavigation=presentation.shell.navigation.map(item=>({...item}));
    const baseScreens=presentation.screenIds().map(id=>cleanScreen(presentation.screen(id)));
    if(!auth)return {productId:security.productId,brand:presentation.shell.brand,navigation:baseNavigation,screens:baseScreens};
    const navigation=[],screens=[];
    for(const item of baseNavigation){
      if(await allowed(auth,permissionFor(item.id,'read'))){navigation.push(item);const screen=baseScreens.find(value=>value.id===item.id);if(screen)screens.push(screen);}
    }
    if(await allowed(auth,'iot:read')){navigation.push({...IOT_NAVIGATION});screens.push({...IOT_SCREEN});}
    if(await allowed(auth,'users:read')){navigation.push({...ADMIN_NAVIGATION});screens.push({...ADMIN_SCREEN});}
    return {productId:security.productId,brand:presentation.shell.brand,navigation,screens};
  }
  return Object.freeze({
    describe,
    async authState(){return {hasUsers:await security.hasUsers()};},
    async bootstrap({username,password}={}){const id=globalThis.crypto?.randomUUID?.()??`admin-${Date.now()}`;return security.bootstrapUser({id,username,password,roles:['admin'],active:true});},
    async login({username,password}={}){return security.authenticate({username,password});},
    async validate(auth){return requireSession(auth);},
    async logout(auth){return security.revoke(credentials(auth));},
    async load({screenId,auth,context={}}={}){if(screenId==='admin')return adminSnapshot(auth);if(screenId==='iot')return iotSnapshot(auth);await requireSession(auth,permissionFor(screenId,'read'));return presentation.load(screenId,context);},
    async action({screenId,action,input={},auth,context={}}={}){if(screenId==='admin')return adminAction({action,input,auth});if(screenId==='iot'){await requireSession(auth,'iot:read');throw new Error('IoT is read-only in this product surface.');}return commands.execute({screenId,action,input,auth,context});}
  });
}
