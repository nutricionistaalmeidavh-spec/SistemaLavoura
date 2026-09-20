import { validateAgroEvent } from "../shared/agro-contract-v1.js";

export function createLavouraAgroAdapter({ onMachineUsage = async()=>{}, onFueling = async()=>{}, onMaintenance = async()=>{} }={}) {
 const processed=new Set();
 return async function consume(event) {
  validateAgroEvent(event);
  if(processed.has(event.eventId)) return {ok:true,duplicate:true};
  const handlers={"machine.usage.recorded":onMachineUsage,"field-operation.machine-used":onMachineUsage,"fueling.recorded":onFueling,"maintenance.completed":onMaintenance};
  const handler=handlers[event.event];
  if(!handler) return {ok:true,ignored:true};
  await handler({machineId:event.entityId,...event.data,links:event.links,source:event.source,eventId:event.eventId,occurredAt:event.occurredAt});
  processed.add(event.eventId); return {ok:true,duplicate:false};
 };
}
