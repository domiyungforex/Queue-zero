"use client";
import { useActionState } from 'react';
import { saveOrganizationMode } from '@/app/dashboard/settings/actions';
export function OrganizationModeForm({mode}:{mode:'BUSINESS'|'SCHOOL'|'HYBRID'}){
 const [state,action,pending]=useActionState(saveOrganizationMode,{ok:false,message:''});
 return <form action={action} className="panel settings-form"><h2>How will you use TuRnMaRk?</h2><p>Queues remain available in every workspace. School modes also enable courses, attendance and exports. Switching modes keeps existing records.</p><label>Workspace modules<select key={mode} name="mode" defaultValue={mode} disabled={pending}><option value="BUSINESS">Manage customer queues</option><option value="SCHOOL">Manage school queues &amp; attendance</option><option value="HYBRID">Both</option></select></label>{state.message&&<p role={state.ok?'status':'alert'}>{state.message}</p>}<button className="button-primary" disabled={pending}>{pending?'Updating…':'Update workspace'}</button></form>;
}
