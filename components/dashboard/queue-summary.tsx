import Link from "next/link";
import { ArrowUpRight,Layers,MapPin } from "lucide-react";
import { formatServiceDuration } from "@/lib/queue/format";
import type { getDashboardQueues } from "@/lib/dashboard/data";
import { EmptyState,StatusPill } from "@/components/ui/workspace";
import { TURNMARK_ASSETS } from "@/lib/brand/assets";
export function QueueSummary({queues,staff=false}:{queues:Awaited<ReturnType<typeof getDashboardQueues>>;staff?:boolean}){
 if(!queues.length)return <EmptyState title={staff?'No queues assigned':'No queues yet'} description={staff?'Your assigned queues will appear here. Contact your business owner for access.':'Create a queue for each service your customers wait for.'} href={staff?undefined:'/dashboard/queues/new'} label="Create your first queue" illustration={TURNMARK_ASSETS.illustrations.waitingChairs}/>;
 return <ul className="queue-card-grid">{queues.map(q=><li className="panel queue-card" key={q.id}><div className="queue-card-top"><span className="tile-icon"><Layers size={23}/></span><StatusPill status={q.status}/></div><h2>{q.name}</h2><div className="location"><MapPin size={13}/>{q.locations?.name??'Location unavailable'}</div>{q.description&&<p>{q.description}</p>}<div className="queue-card-bottom"><span>{formatServiceDuration(q.average_service_seconds)} / customer</span><Link href={`/dashboard/queues/${q.id}`}>View queue<ArrowUpRight size={17}/><span className="sr-only"> {q.name}</span></Link></div></li>)}</ul>
}
