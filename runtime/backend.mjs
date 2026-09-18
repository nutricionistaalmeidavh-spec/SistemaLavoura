const credentials=(auth={})=>({sessionId:auth.sessionId,token:auth.token});
const cleanScreen=(screen)=>({id:screen.id,title:screen.title,kind:screen.kind,actionDefinitions:screen.actionDefinitions??{}});

export function createRpcBackend({presentation}){
  if(!presentation?.screen||!presentation?.services?.security)throw new TypeError('Functional presentation with security is required.');
  const security=presentation.services.security;
  async function requireSession(auth,permission=null){
    const c=credentials(auth);
    if(permission)return security.authorize({...c,permission});
    return security.authenticateSession(c);
  }
  const permissionFor=(screenId,mode,action=null)=>security.permissionFor?.({screenId,mode,action})??null;
  return Object.freeze({
    async describe(){return {productId:security.productId,brand:presentation.shell.brand,navigation:presentation.shell.navigation.map(item=>({...item})),screens:presentation.screenIds().map(id=>cleanScreen(presentation.screen(id)))};},
    async authState(){return {hasUsers:await security.hasUsers()};},
    async bootstrap({username,password}={}){const id=globalThis.crypto?.randomUUID?.()??`admin-${Date.now()}`;return security.bootstrapUser({id,username,password,roles:['admin'],active:true});},
    async login({username,password}={}){return security.authenticate({username,password});},
    async validate(auth){return requireSession(auth);},
    async logout(auth){return security.revoke(credentials(auth));},
    async load({screenId,auth,context={}}={}){await requireSession(auth,permissionFor(screenId,'read'));return presentation.load(screenId,context);},
    async action({screenId,action,input={},auth,context={}}={}){await requireSession(auth,permissionFor(screenId,'write',action));return presentation.action(screenId,action,input,context);}
  });
}
