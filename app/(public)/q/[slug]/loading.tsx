import { PublicQueueShell } from "@/components/customer/public-queue-shell";
import { QrLoader } from "@/components/ui/loading";
export default function Loading() {
  return <PublicQueueShell><QrLoader label="Opening queue" /><div aria-hidden="true" className="skeleton-card"><span/><span/><span/></div></PublicQueueShell>;
}
