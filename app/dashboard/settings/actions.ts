"use server";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import { clerkClient } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { unstable_rethrow } from "next/navigation";
import { requireBusinessManager,requireBusinessOwner } from "@/lib/business/membership";
import { createUserSupabaseClient } from "@/lib/db/server";
export type FormResult={ok:boolean;message:string};
const timezone=z.string().max(100).refine(v=>{try{new Intl.DateTimeFormat('en',{timeZone:v});return true}catch{return false}});
const locationSchema=z.object({id:z.uuid(),name:z.string().trim().min(1).max(160),address:z.string().trim().min(1).max(500),timezone,active:z.boolean()});
export async function saveLocation(_previous:FormResult,form:FormData):Promise<FormResult>{
 const m=await requireBusinessManager();const input=locationSchema.safeParse({id:form.get('id')||randomUUID(),name:form.get('name'),address:form.get('address'),timezone:form.get('timezone'),active:form.get('active')==='on'});
 if(!input.success)return {ok:false,message:'Enter a name, address and valid timezone.'};
 try{const db=await createUserSupabaseClient(),v=input.data;const {error}=await db.rpc('save_location',{p_business_id:m.businessId,p_location_id:v.id,p_name:v.name,p_address:v.address,p_timezone:v.timezone,p_active:v.active});if(error)throw new Error();revalidatePath('/dashboard','layout');return {ok:true,message:'Location saved.'}}catch(e){unstable_rethrow(e);return {ok:false,message:'Could not save this location. Check your access and try again.'}}
}
export async function saveBusiness(_previous:FormResult,form:FormData):Promise<FormResult>{
 const m=await requireBusinessOwner();const input=z.object({name:z.string().trim().min(1).max(160),industry:z.string().trim().min(1).max(100),timezone}).safeParse(Object.fromEntries(form));if(!input.success)return {ok:false,message:'Enter a business name, industry and valid timezone.'};
 try{const db=await createUserSupabaseClient();const {error}=await db.rpc('save_business',{p_business_id:m.businessId,p_name:input.data.name,p_industry:input.data.industry,p_timezone:input.data.timezone});if(error)throw new Error();revalidatePath('/dashboard','layout');return {ok:true,message:'Business details saved.'}}catch(e){unstable_rethrow(e);return {ok:false,message:'Could not save your business details. Please try again.'}}
}
export async function saveTeamMember(_previous:FormResult,form:FormData):Promise<FormResult>{
 const m=await requireBusinessManager();const parsed=z.object({email:z.email().max(254).optional(),userId:z.string().regex(/^user_[A-Za-z0-9]+$/).optional(),role:z.enum(['admin','staff']),queueIds:z.array(z.uuid()).max(100),remove:z.boolean()}).safeParse({email:form.get('email')||undefined,userId:form.get('userId')||undefined,role:form.get('role'),queueIds:form.getAll('queueIds'),remove:form.get('remove')==='true'});
 if(!parsed.success)return {ok:false,message:'Enter a valid email, role and queue assignments.'};
 try{const v=parsed.data;let userId=v.userId;if(!v.remove){if(!v.email)return {ok:false,message:'Enter your teammate’s email.'};const client=await clerkClient();const users=await client.users.getUserList({emailAddress:[v.email],limit:1});userId=users.data[0]?.id;if(!userId)return {ok:false,message:'Ask this teammate to create a QueueZero account with that email, then add them here.'}}
 if(!userId)return {ok:false,message:'Member unavailable.'};const db=await createUserSupabaseClient();const {error}=await db.rpc('save_staff',{p_business_id:m.businessId,p_user_id:userId,p_role:v.role,p_queue_ids:v.queueIds,p_remove:v.remove});if(error)throw new Error();revalidatePath('/dashboard/team');return {ok:true,message:v.remove?'Team access removed.':'Team member saved.'};
 }catch(e){unstable_rethrow(e);return {ok:false,message:'Could not update team access. Check your permissions and authentication configuration.'}}
}
