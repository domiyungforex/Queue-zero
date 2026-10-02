import { randomUUID } from "node:crypto";
import { getDashboardLocations } from "@/lib/dashboard/data";
import { PageHeading } from "@/components/ui/workspace";
import { LocationsManager } from "@/components/business/forms";
export default async function LocationsPage(){const locations=await getDashboardLocations();return <><PageHeading eyebrow="LOCATIONS" title="Every branch. One workspace." description="Manage the places where your customers find you."/><LocationsManager locations={locations} newId={randomUUID()}/></>}
