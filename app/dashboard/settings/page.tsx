import { OrganizationModeForm } from "@/components/dashboard/organization-mode";
import { requireBusinessOwner } from "@/lib/business/membership";
import { getBusinessDetails } from "@/lib/dashboard/data";
import { PageHeading } from "@/components/ui/workspace";
import { BusinessSettingsForm } from "@/components/business/forms";
export default async function SettingsPage(){const business=await getBusinessDetails();const membership=await requireBusinessOwner();return <><PageHeading eyebrow="SETTINGS" title="Make yourself at home." description="Keep your business details and preferences up to date."/><div className="settings-layout"><div className="space-y-6"><BusinessSettingsForm business={business}/><OrganizationModeForm mode={membership.organizationMode??"BUSINESS"}/></div><aside className="panel settings-note"><h2>Your business, your identity.</h2><p>Your name appears on public queue pages and customer tickets. Choose something customers recognize.</p><hr/><h3>Country</h3><p>{business.country_code}</p><h3>Customer privacy</h3><p>Customer names and contact details stay inside your authorized workspace. Public tickets show only their own number and position.</p></aside></div></>}
