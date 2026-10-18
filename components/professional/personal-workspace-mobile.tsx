import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  Check,
  Clock3,
  ListFilter,
  ListOrdered,
  Pause,
  Plus,
  UserRound,
  UsersRound,
  Archive,
} from "lucide-react";
import type { getDashboardQueues } from "@/lib/dashboard/data";
import type { BusinessMetrics } from "@/lib/validation/operations";
import { TURNMARK_ASSETS } from "@/lib/brand/assets";
import { formatServiceDuration } from "@/lib/queue/format";
import styles from "./personal-workspace-mobile.module.css";

type QueueRows = Awaited<ReturnType<typeof getDashboardQueues>>;
type Profile = {
  service_name: string | null;
  locations: { name: string; address: string } | null;
} | null;

const queueHref = "/dashboard/queues/new";

function PersonalHero({ variant = "overview", canManage }: { variant?: "overview" | "queues"; canManage: boolean }) {
  const queues = variant === "queues";
  return <section className={styles.hero} aria-labelledby={`personal-${variant}-title`}>
    <span className={styles.heroShape} aria-hidden="true" />
    <div className={styles.heroCopy}>
      <p>{queues ? "QUEUES" : "WELCOME BACK"}</p>
      <h1 id={`personal-${variant}-title`}>{queues ? <>The work<br />customers<br />come to you for.</> : <>Make every<br />arrival easier.</>}</h1>
      <span>{queues ? "Create and manage your service queues to keep everything running smoothly." : <>Manage your independent<br />service queue from one<br />focused workspace.</>}</span>
      {canManage && <Link href={queueHref} className={styles.primaryAction}><Plus aria-hidden="true" size={21} />Create queue<ArrowRight aria-hidden="true" size={19} /></Link>}
    </div>
    <Image className={styles.heroCharacter} src={TURNMARK_ASSETS.characters.businessProfessionalCutout.src} width={TURNMARK_ASSETS.characters.businessProfessionalCutout.width} height={TURNMARK_ASSETS.characters.businessProfessionalCutout.height} sizes="(max-width: 430px) 62vw, 280px" alt="" priority />
  </section>;
}

function KpiCard({ icon: Icon, value, label, note, tone }: {
  icon: typeof UsersRound;
  value: string | number;
  label: string;
  note?: string;
  tone: "coral" | "purple" | "green" | "orange";
}) {
  return <article className={styles.kpi}>
    <span className={`${styles.kpiIcon} ${styles[tone]}`}><Icon size={19} aria-hidden="true" /></span>
    <strong>{value}</strong>
    <h2>{label}</h2>
    {note && <p>{note}</p>}
  </article>;
}

function MetricGrid({ kind, queues, metrics, customerCount }: {
  kind: "overview" | "queues";
  queues: QueueRows;
  metrics: BusinessMetrics | null;
  customerCount?: number | null;
}) {
  return <div className={styles.kpis} aria-label="Workspace metrics">
    <KpiCard icon={kind === "overview" ? UsersRound : ListOrdered} value={kind === "overview" ? customerCount ?? "—" : queues.length} label={kind === "overview" ? "Total Customers" : "Total Queues"} note={kind === "overview" ? "All time" : undefined} tone="coral" />
    <KpiCard icon={UserRound} value={metrics?.waiting ?? "—"} label="Waiting Now" note={kind === "overview" ? "In all queues" : undefined} tone="purple" />
    <KpiCard icon={Check} value={metrics?.completed_today ?? "—"} label="Served Today" note={kind === "overview" ? "Completed" : undefined} tone="green" />
    <KpiCard icon={Clock3} value={metrics?.average_wait_seconds === null || metrics?.average_wait_seconds === undefined ? "—" : `${Math.round(metrics.average_wait_seconds / 60)} min`} label="Avg. Wait Time" note={kind === "overview" ? "Last 7 days" : undefined} tone="orange" />
  </div>;
}

function DataError({ children }: { children: React.ReactNode }) {
  return <div className={styles.dataError} role="alert"><p>{children}</p><Link href="">Try again</Link></div>;
}

function QueueEmpty({ canManage }: { canManage: boolean }) {
  return <section className={styles.empty} aria-labelledby="no-personal-queues">
    <span className={styles.emptyMarks} aria-hidden="true">•••</span>
    <Image src={TURNMARK_ASSETS.illustrations.waitingChairs.src} width={TURNMARK_ASSETS.illustrations.waitingChairs.width} height={TURNMARK_ASSETS.illustrations.waitingChairs.height} sizes="190px" alt="" />
    <h2 id="no-personal-queues">No queues yet</h2>
    <p>Create a queue for each service your customers wait for, and start serving them smoothly.</p>
    {canManage && <Link href={queueHref} className={styles.primaryAction}><Plus aria-hidden="true" size={21} />Create your first queue<ArrowRight aria-hidden="true" size={19} /></Link>}
  </section>;
}

function QueueCards({ queues }: { queues: QueueRows }) {
  return <ul className={styles.queueList}>{queues.map((queue) => <li key={queue.id}>
    <div><span className={`${styles.queueStatus} ${styles[`status_${queue.status}`]}`}>{queue.status === "closed" ? "Archived" : queue.status}</span><h2>{queue.name}</h2><p>{queue.locations?.name ?? "Location unavailable"}</p></div>
    <dl><div><dt>Service time</dt><dd>{formatServiceDuration(queue.average_service_seconds)}</dd></div></dl>
    <Link href={`/dashboard/queues/${queue.id}`}>View queue<ArrowRight size={17} aria-hidden="true" /><span className="sr-only"> {queue.name}</span></Link>
  </li>)}</ul>;
}

export function PersonalOverviewMobile({ queues, metrics, customerCount, canManage, queueError = false, metricError = false }: {
  queues: QueueRows;
  metrics: BusinessMetrics | null;
  customerCount: number | null;
  canManage: boolean;
  queueError?: boolean;
  metricError?: boolean;
}) {
  return <div className={styles.mobilePage}>
    <PersonalHero canManage={canManage} />
    <MetricGrid kind="overview" queues={queues} metrics={metrics} customerCount={customerCount} />
    {metricError && <DataError>We couldn’t load your latest metrics.</DataError>}
    <div className={styles.sectionHeading}><div><h2>Queues</h2><p>Queues across your service locations.</p></div>{canManage && <Link href={queueHref}><Plus size={18} aria-hidden="true" />Create queue</Link>}</div>
    {queueError ? <DataError>We couldn’t load your queues.</DataError> : queues.length ? <QueueCards queues={queues} /> : <QueueEmpty canManage={canManage} />}
  </div>;
}

export function PersonalServicesMobile({ profile, fallbackLabel, canManage, loadError = false }: {
  profile: Profile;
  fallbackLabel: string;
  canManage: boolean;
  loadError?: boolean;
}) {
  const location = profile?.locations;
  return <div className={styles.mobilePage}>
    <section className={styles.serviceIntro}>
      <p>SERVICES</p>
      <h1>The work customers<br />come to you for.</h1>
      <span>Your onboarding service is saved here.<br />Create queues only when you are ready<br />to receive customers.</span>
      {canManage && <Link href={queueHref} className={styles.primaryAction}><Plus aria-hidden="true" size={21} />Create queue<ArrowRight aria-hidden="true" size={19} /></Link>}
    </section>
    {loadError ? <DataError>We couldn’t load your saved service.</DataError> : profile ? <section className={styles.serviceCard}>
      <p>PRIMARY SERVICE</p>
      <h2>{profile.service_name ?? fallbackLabel}</h2>
      {location && <span>{location.name}{location.address ? ` · ${location.address}` : ""}</span>}
      <div className={styles.serviceArt} aria-hidden="true"><span /><span /><span /></div>
    </section> : <section className={styles.serviceCard}><p>PRIMARY SERVICE</p><h2>No service details available</h2><span>Your workspace exists, but its professional service profile could not be found.</span></section>}
  </div>;
}

export function PersonalQueuesMobile({ queues, metrics, canManage, activeFilter, queueError = false, metricError = false }: {
  queues: QueueRows;
  metrics: BusinessMetrics | null;
  canManage: boolean;
  activeFilter: "all" | "open" | "paused" | "closed";
  queueError?: boolean;
  metricError?: boolean;
}) {
  const filters = [
    { value: "all", label: "All Queues", icon: ListFilter },
    { value: "open", label: "Active", icon: UserRound },
    { value: "paused", label: "Paused", icon: Pause },
    { value: "closed", label: "Archived", icon: Archive },
  ] as const;
  const visible = activeFilter === "all" ? queues : queues.filter((queue) => queue.status === activeFilter);
  return <div className={styles.mobilePage}>
    <PersonalHero variant="queues" canManage={canManage} />
    <MetricGrid kind="queues" queues={queues} metrics={metrics} />
    {metricError && <DataError>We couldn’t load your latest queue metrics.</DataError>}
    <nav className={styles.filters} aria-label="Filter queues">{filters.map(({ value, label, icon: Icon }) => <Link key={value} href={value === "all" ? "/dashboard/queues" : `/dashboard/queues?status=${value}`} aria-current={activeFilter === value ? "page" : undefined}><Icon size={17} aria-hidden="true" />{label}</Link>)}</nav>
    {queueError ? <DataError>We couldn’t load your queues.</DataError> : visible.length ? <QueueCards queues={visible} /> : activeFilter === "all" ? <QueueEmpty canManage={canManage} /> : <section className={styles.filteredEmpty}><h2>No {filters.find((filter) => filter.value === activeFilter)?.label.toLowerCase()} queues</h2><p>Queues with this status will appear here.</p></section>}
  </div>;
}
