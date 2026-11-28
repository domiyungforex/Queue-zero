import { requireBusinessManager } from "@/lib/business/membership";
import { createUserSupabaseClient } from "@/lib/db/server";
import { EmptyState, PageHeading, StatusPill } from "@/components/ui/workspace";
export default async function CustomersPage(){
 const membership=await requireBusinessManager();const db=await createUserSupabaseClient();
 const {data,error}=await db.from('tickets').select('id,customer_name,display_number,status,created_at,queues!inner(business_id)').eq('queues.business_id',membership.businessId).order('created_at',{ascending:false}).limit(100);
 if(error)throw new Error('Customer visits could not be loaded. Please try again.');
 return <><PageHeading eyebrow="CUSTOMERS" title="People you have welcomed." description="Recent queue visits. Customers can join without creating a permanent profile."/><section className="panel"><div className="panel-heading"><h2>Latest 100 visits</h2></div>{data?.length?<div className="overflow-x-auto p-5"><table className="w-full text-left text-sm"><thead><tr><th className="p-3">Name</th><th className="p-3">Number</th><th className="p-3">Status</th><th className="p-3">Joined</th></tr></thead><tbody>{data.map(ticket=><tr key={ticket.id}><td className="p-3">{ticket.customer_name}</td><td className="p-3">{ticket.display_number}</td><td className="p-3"><StatusPill status={ticket.status.toLowerCase()}/></td><td className="p-3">{new Date(ticket.created_at).toLocaleString('en-GB',{timeZone:'UTC'})} UTC</td></tr>)}</tbody></table></div>:<div className="p-5"><EmptyState title="No customers yet" description="No customers have joined your queues yet."/></div>}</section></>;
}
