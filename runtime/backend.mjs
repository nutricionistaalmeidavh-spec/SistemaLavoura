import {createCommandDispatcher} from './commands.mjs';

const credentials=(auth={})=>({sessionId:auth.sessionId,token:auth.token});
const cleanScreen=(screen)=>({id:screen.id,title:screen.title,kind:screen.kind,actionDefinitions:screen.actionDefinitions??{}});
const userId=()=>globalThis.crypto?.randomUUID?.()??`user-${Date.now()}-${Math.random().toString(16).slice(2)}`;
const ADMIN_NAVIGATION=Object.freeze({id:'admin',label:'Administração',icon:'shield',group:'Sistema'});
const ADMIN_SCREEN=Object.freeze({id:'admin',title:'Administração',kind:'admin',actionDefinitions:Object.freeze({})});

export function createRpcBackend({presentation}){
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
    return Object.freeze({
      currentUser:session.user,
      users:Object.freeze(users),
      roles:Object.freeze(roles),
      audit:Object.freeze([...audit].reverse()),
      capabilities:Object.freeze({usersRead:true,usersWrite,auditRead,passwordChange})
    });
  }
  async function adminAction({action,input={},auth}={}){
    const c=credentials(auth);
    if(action==='createUser')return security.createUser({...c,user:{id:userId(),username:input.username,password:input.password,roles:input.roles??[],active:input.active!==false}});
    if(action==='setUserRoles')return security.setUserRoles({...c,userId:input.userId,roles:input.roles??[]});
    if(action==='setUserActive')return security.setUserActive({...c,userId:input.userId,active:input.active});
    if(action==='changePassword')return security.changePassword({...c,currentPassword:input.currentPassword,newPassword:input.newPassword});
    throw new Error(`Unknown admin action: ${String(action)}`);
  }
  async function describe(auth=null){
    const baseNavigation=presentation.shell.navigation.map(item=>({...item}));
    const baseScreens=presentation.screenIds().map(id=>cleanScreen(presentation.screen(id)));
    if(!auth)return {productId:security.productId,brand:presentation.shell.brand,navigation:baseNavigation,screens:baseScreens};
    const navigation=[],screens=[];
    for(const item of baseNavigation){
      if(await allowed(auth,permissionFor(item.id,'read'))){navigation.push(item);const screen=baseScreens.find(value=>value.id===item.id);if(screen)screens.push(screen);}
    }
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
    async load({screenId,auth,context={}}={}){if(screenId==='admin')return adminSnapshot(auth);await requireSession(auth,permissionFor(screenId,'read'));return presentation.load(screenId,context);},
    async action({screenId,action,input={},auth,context={}}={}){if(screenId==='admin')return adminAction({action,input,auth});return commands.execute({screenId,action,input,auth,context});}
  });
}
