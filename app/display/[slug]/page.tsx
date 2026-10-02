import { notFound } from "next/navigation";
import { z } from "zod";
import { createPublicSupabaseClient } from "@/lib/db/public";
import { publicQueueSlugSchema } from "@/lib/validation/public-queue";
import { Brand } from "@/components/marketing/site";
import { LiveRefresh } from "@/components/realtime/refresh";
import { StatusPill } from "@/components/ui/workspace";
export const dynamic='force-dynamic';export const metadata={title:'Now serving',robots:{index:false,follow:false}};
const schema=z.object({business_name:z.string(),queue_name:z.string(),status:z.string(),now_serving:z.string().nullable(),waiting_count:z.number(),next_numbers:z.array(z.string())}).strict();
export default async function Display({params}:{params:Promise<{slug:string}>}){const {slug}=await params;if(!publicQueueSlugSchema.safeParse(slug).success)notFound();const {data,error}=await createPublicSupabaseClient().rpc('get_public_display',{p_slug:slug});if(error)throw new Error('Display is unavailable.');if(!data)notFound();const d=schema.parse(data);return <div className="display-screen"><header><Brand/><div><h1>{d.business_name}</h1><p>{d.queue_name}</p></div><StatusPill status={d.status}/></header><main id="main"><p className="eyebrow">NOW SERVING</p><strong>{d.now_serving??'—'}</strong><p>{d.now_serving?'Please proceed to the service area.':'The next customer will be called here.'}</p><section><h2>Coming up next</h2><div>{d.next_numbers.length?d.next_numbers.map((n,i)=><span key={`${n}-${i}`}>{n}</span>):<p>No customers waiting.</p>}</div></section></main><footer><LiveRefresh topic={`public-queue:${slug}`}/><span>Your place, without the line.</span></footer></div>}
