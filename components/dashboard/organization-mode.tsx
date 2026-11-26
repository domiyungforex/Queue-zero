"use client";
import { useActionState } from 'react';
import { saveOrganizationMode } from '@/app/dashboard/settings/actions';
import { CustomDropdown } from '@/components/ui/custom-dropdown';
export function OrganizationModeForm({mode}:{mode:'BUSINESS'|'SCHOOL'|'HYBRID'}){
 const [state,action,pending]=useActionState(saveOrganizationMode,{ok:false,message:''});
 return <form action={action} className="panel settings-form"><h2>How will you use TuRnMaRk?</h2><p>Queues remain available in every workspace. School modes also enable courses, attendance and exports. Switching modes keeps existing records.</p><div style={{margin:'16px 0'}}><CustomDropdown key={mode} name="mode" label="Workspace modules" defaultValue={mode} disabled={pending} options={[{value:'BUSINESS',label:'Manage customer queues'},{value:'SCHOOL',label:'Manage school queues & attendance'},{value:'HYBRID',label:'Both'}]} /></div>{state.message&&<p role={state.ok?'status':'alert'}>{state.message}</p>}<button className="button-primary" disabled={pending}>{pending?'Updating…':'Update workspace'}</button></form>;
}
