import { pageMetadata } from "@/lib/site/metadata";
import { Breadcrumbs } from "@/components/marketing/breadcrumbs";
import { MarketingFrame } from "@/components/marketing/site";
import styles from "@/components/marketing/site.module.css";
import { Plans } from "@/components/billing/plans";
import { billingConfigured,getPaidPlan } from "@/lib/paystack/server";
export const dynamic='force-dynamic';
export const metadata = pageMetadata('Queue management plans and pricing', 'Compare TuRnMaRk queue capacity and plans. Start with free queues and upgrade using secure billing when your business grows.', '/pricing');
export default async function PricingPage(){const prices:Record<string,string>={};let configured=billingConfigured();if(configured){try{for(const p of ['STARTER','BUSINESS'] as const){const v=await getPaidPlan(p);prices[p]=new Intl.NumberFormat('en',{style:'currency',currency:v.currency,maximumFractionDigits:0}).format(v.amount/100)}}catch{configured=false}}return <MarketingFrame><main id="main" className={styles.subpage}><Breadcrumbs label="Plans" path="/pricing" /><p className={styles.eyebrow}>ROOM TO GROW</p><h1>Better waiting.<br/><em>At your own pace.</em></h1><p className={styles.subpageLead}>Start with three queues, then add capacity as your business grows. No app downloads for your customers. No complicated setup for your team.</p><Plans current="FREE" prices={prices} configured={configured} publicPage/></main></MarketingFrame>}
