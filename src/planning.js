import {validatePlan,calculateProgress,findResourceConflicts,toFullCalendarEvents,toFrappeGantt} from '../shared/vendor/release-modules/artisys-planning/src/index.mjs';

const text=(v,l)=>{if(typeof v!=='string'||!v.trim())throw new TypeError(`${l} is required.`);return v.trim();};
const rows=records=>records.map(record=>record.payload);

export function createPlanningService(repos){
  if(!repos?.plans?.save)throw new TypeError('Plans repository is required.');
  const normalize=input=>{
    const tasks=validatePlan(input?.tasks??[]);
    return Object.freeze({id:text(input?.id,'Plan id'),seasonId:text(input?.seasonId,'Season id'),name:String(input?.name??input?.id),tasks:Object.freeze(tasks.map(task=>Object.freeze({...task,dependencies:Object.freeze([...task.dependencies])}))),status:String(input?.status??'planned'),metadata:Object.freeze({...input?.metadata})});
  };
  return Object.freeze({
    async save(input,{expectedVersion}={}){const plan=normalize(input);return repos.plans.save(plan,{expectedVersion});},
    get:id=>repos.plans.get(id),
    list:async()=>rows(await repos.plans.list()),
    async snapshot(){
      const plans=await this.list();
      const allTasks=plans.flatMap(plan=>plan.tasks??[]);
      const conflicts=plans.flatMap(plan=>findResourceConflicts(plan.tasks??[]).map(conflict=>({planId:plan.id,...conflict})));
      const calendar=plans.flatMap(plan=>toFullCalendarEvents(plan.tasks??[]).map(event=>({...event,planId:plan.id})));
      const gantt=plans.flatMap(plan=>toFrappeGantt(plan.tasks??[]).map(task=>({...task,planId:plan.id})));
      const progress=allTasks.length?allTasks.reduce((sum,task)=>sum+Number(task.progress??0),0)/allTasks.length:0;
      return Object.freeze({plans:Object.freeze(plans),progress,conflicts:Object.freeze(conflicts),calendar:Object.freeze(calendar),gantt:Object.freeze(gantt)});
    }
  });
}
