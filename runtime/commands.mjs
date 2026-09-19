const credentials=(auth={})=>({sessionId:auth.sessionId,token:auth.token});
const keyOf=(screenId,action)=>`${String(screenId)}.${String(action)}`;
const NON_TRANSACTIONAL=new Set(['reports.csv','settings.backup','settings.restore']);
const clone=value=>value==null?value:structuredClone(value);
const entityIdOf=(input,result)=>input?.id??result?.id??result?.payload?.id??result?.record?.id??result?.record?.payload?.id??null;

export function createCommandDispatcher({presentation}={}){
  if(!presentation?.action||!presentation?.services?.security)throw new TypeError('Functional presentation with security is required.');
  const security=presentation.services.security;
  const persistence=presentation.services.persistence;
  const eventBus=presentation.services.eventBus??null;
  const permissionFor=(screenId,action)=>security.permissionFor?.({screenId,mode:'write',action})??null;

  return Object.freeze({
    async execute({screenId,action,input={},auth,context={}}={}){
      const command=keyOf(screenId,action);
      const transactional=!NON_TRANSACTIONAL.has(command)&&typeof persistence?.runInTransaction==='function';
      const commandId=globalThis.crypto?.randomUUID?.()??`command-${Date.now()}-${Math.random().toString(16).slice(2)}`;
      let domainEvent=null;
      const work=async()=>{
        const result=await presentation.action(screenId,action,input,context);
        if(eventBus){
          domainEvent=await eventBus.publish(`agro.${String(screenId)}.${String(action)}.completed`,{
            entityId:entityIdOf(input,result),
            input:clone(input??{})
          },{metadata:{commandId,screenId:String(screenId),action:String(action),transactional}});
        }
        return result;
      };
      const invoke=transactional?()=>persistence.runInTransaction(work):work;
      const executed=await security.execute({
        ...credentials(auth),
        permission:permissionFor(screenId,action),
        action:command,
        entityType:String(screenId),
        entityId:input?.id??null,
        metadata:{commandId,screenId:String(screenId),action:String(action),transactional}
      },invoke);
      if(domainEvent&&eventBus)await eventBus.flush(domainEvent.id);
      return executed.result;
    }
  });
}
