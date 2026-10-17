import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Check, Clock3, QrCode, Radio, ScanLine } from "lucide-react";
import { FrequentlyAskedQuestions } from "@/components/marketing/faq";
import { Arrow, MarketingFrame } from "@/components/marketing/site";
import { FeatureIllustrationCard, IndustryIllustration, ProfessionalCharacter } from "@/components/ui/turnmark-system";
import { TURNMARK_ASSETS } from "@/lib/brand/assets";
import { pageMetadata } from "@/lib/site/metadata";
import styles from "@/components/marketing/site.module.css";

const steps = [
  { number: "01", title: "Scan", text: "Open the queue QR with the camera already on your phone.", icon: ScanLine },
  { number: "02", title: "Join", text: "Enter the details requested by the organization and receive a private ticket.", icon: QrCode },
  { number: "03", title: "Leave the line", text: "Track your place live and return when your turn is close.", icon: Clock3 },
] as const;

const modules = [
  { asset: TURNMARK_ASSETS.icons.queue, eyebrow: "QUEUE MANAGEMENT", title: "Smarter queues", description: "Create QR queues, call the next person safely, and keep every ticket current." },
  { asset: TURNMARK_ASSETS.icons.attendance, eyebrow: "EDUCATION", title: "Accountless attendance", description: "Roster-validated class attendance with live lecturer views and real exports." },
  { asset: TURNMARK_ASSETS.icons.appointments, eyebrow: "SCHEDULED SERVICES", title: "Supported appointments", description: "Coordinate scheduled arrivals where the workspace has appointment support enabled." },
  { asset: TURNMARK_ASSETS.icons.analytics, eyebrow: "REPORTING", title: "Operational insight", description: "Review actual queue and attendance activity without invented dashboard data." },
] as const;

export const metadata = pageMetadata(
  "Queue management that gives people their time back",
  "TuRnMaRk lets people scan, join and track their place from their phone while organizations manage every arrival in realtime.",
  "/",
);

export default function Home() {
  return (
    <MarketingFrame>
      <main id="main">
        <section className={styles.tmHero} aria-labelledby="hero-title">
          <div className={styles.tmHeroCopy}>
            <p className={styles.tmPill}><span>NEW</span> Queues, attendance and supported appointments</p>
            <h1 id="hero-title">People flow better with <em>TuRnMaRk.</em></h1>
            <p>Simple, modern queue management that lets people scan, join, leave the line and return when they’re almost next.</p>
            <div className={styles.tmHeroActions}>
              <Link href="/sign-up" className={styles.tmPrimaryAction}>Create a queue <ArrowRight size={18} aria-hidden="true" /></Link>
              <Link href="#how-it-works" className={styles.tmSecondaryAction}><span aria-hidden="true">▶</span> See how it works</Link>
            </div>
            <p className={styles.tmAssurance}><Check size={15} aria-hidden="true" /> No download or customer account required.</p>
          </div>
          <div className={styles.tmHeroVisual}>
            <div className={styles.tmHeroPhoto}>
              <Image src="/images/cafe.jpg" alt="A welcoming service counter where customers can scan to join a queue" fill priority sizes="(max-width: 860px) 100vw, 50vw" />
            </div>
            <div className={styles.tmQueueBoard} aria-label="Illustration of the TuRnMaRk queue flow">
              <div><span>Now serving</span><strong>Your turn</strong></div>
              <div><span>Next step</span><strong>Return</strong></div>
              <div><span>Queue state</span><strong>Live</strong></div>
            </div>
            <div className={styles.tmScanCard}><QrCode size={28} aria-hidden="true" /><span>Scan to join</span><small>Generated QR codes remain live and secure.</small></div>
          </div>
          <div className={styles.tmCapabilityBar} aria-label="Core TuRnMaRk capabilities">
            <span><ScanLine aria-hidden="true" /><strong>No app</strong><small>Join in the browser</small></span>
            <span><Radio aria-hidden="true" /><strong>Realtime</strong><small>Live queue position</small></span>
            <span><Clock3 aria-hidden="true" /><strong>Wait remotely</strong><small>Return when close</small></span>
            <span><QrCode aria-hidden="true" /><strong>One scan</strong><small>Context-aware entry</small></span>
          </div>
        </section>

        <section className={styles.tmFeatureStrip} id="product" aria-labelledby="product-title">
          <div className={styles.tmSectionHeading}><p>BUILT FOR REAL-WORLD FLOW</p><h2 id="product-title">One platform. Specialized tools.</h2><span>Queues stay fast and focused. Attendance and supported appointments use the same trusted organization foundation.</span></div>
          <div className={styles.tmFeatureGrid}>{modules.map((module) => <FeatureIllustrationCard key={module.title} {...module} />)}</div>
        </section>

        <section className={styles.tmSteps} id="how-it-works" aria-labelledby="flow-title">
          <div className={styles.tmSectionHeading}><p>HOW TURNMARK WORKS</p><h2 id="flow-title">A better queue in three small moves.</h2><span>The customer flow remains deliberately simple, even when the organization behind it is complex.</span></div>
          <div className={styles.tmStepGrid}>{steps.map(({ number, title, text, icon: Icon }) => <article key={number}><div><Icon size={24} aria-hidden="true" /><span>{number}</span></div><h3>{title}</h3><p>{text}</p></article>)}</div>
        </section>

        <section className={styles.tmQueueProduct} aria-labelledby="queue-product-title">
          <div className={styles.tmQueueCopy}><p>QUEUE MANAGEMENT FIRST</p><h2 id="queue-product-title">The line keeps moving, even when people step away.</h2><span>Staff get clear controls. Customers get a private live ticket. Postgres remains authoritative when the connection returns.</span><ul><li><Check aria-hidden="true" />Safe Call Next operations</li><li><Check aria-hidden="true" />Live position and approximate waits</li><li><Check aria-hidden="true" />Pause, resume, complete and no-show controls</li></ul><Link href="/how-it-works">Explore the queue flow <Arrow /></Link></div>
          <div className={styles.tmProductPanel} aria-label="Illustrative queue workflow">
            <div className={styles.tmProductTop}><span><i /> Queue open</span><small>Illustrative view</small></div>
            <div className={styles.tmProductMain}><p>Customer journey</p><strong>Scan → Join → Track → Return</strong><span>The real workspace shows only authorized, database-backed queue information.</span></div>
            <div className={styles.tmProductActions}><span>Public QR</span><span>Live ticket</span><span>Staff console</span></div>
          </div>
        </section>

        <section className={styles.tmSolutions} id="solutions" aria-labelledby="solutions-title">
          <div className={styles.tmSectionHeading}><p>ONE PLATFORM. MANY PHYSICAL PLACES.</p><h2 id="solutions-title">Built for the moments people arrive.</h2><span>Each workflow stays specific to the service, while organizations, locations, identity and audit history remain connected.</span></div>
          <div className={styles.tmSolutionGrid}>
            <article><IndustryIllustration industry="education" /><div><h3>Universities & schools</h3><p>Class attendance and campus service queues.</p><Link href="/solutions/education" aria-label="Explore education solutions"><Arrow /></Link></div></article>
            <article><ProfessionalCharacter character="healthcareProfessional" /><div><h3>Hospitals & clinics</h3><p>Reception and consultation queues without medical-record collection.</p><Link href="/contact" aria-label="Discuss healthcare queues"><Arrow /></Link></div></article>
            <article><IndustryIllustration industry="government" /><div><h3>Government services</h3><p>Clear public-service queues across departments and counters.</p><Link href="/contact" aria-label="Discuss government queues"><Arrow /></Link></div></article>
            <article><ProfessionalCharacter character="businessProfessional" /><div><h3>Professionals & businesses</h3><p>Personal workspaces and service queues without false institutional affiliation.</p><Link href="/sign-up" aria-label="Create a professional workspace"><Arrow /></Link></div></article>
          </div>
        </section>

        <section className={styles.tmEducationCallout}>
          <div><p>MORE THAN QUEUES</p><h2>Queues + attendance for modern campuses.</h2><span>Schools can run classroom attendance, campus clinic queues, bursary queues, registration support and student services from one isolated workspace.</span><Link href="/solutions/education">Explore TuRnMaRk for education <Arrow /></Link></div>
          <Image src={TURNMARK_ASSETS.characters.student.src} width={TURNMARK_ASSETS.characters.student.width} height={TURNMARK_ASSETS.characters.student.height} alt={TURNMARK_ASSETS.characters.student.alt} />
        </section>

        <section className={styles.tmPricingPreview}>
          <div><p>START SMALL. GROW WHEN READY.</p><h2>Choose capacity that fits your operation.</h2><span>See current plans and configured pricing without hidden usage claims.</span></div>
          <Link href="/pricing" className={styles.tmSecondaryAction}>View plans <ArrowRight size={18} aria-hidden="true" /></Link>
        </section>

        <FrequentlyAskedQuestions />

        <section className={styles.tmCaseStudy} id="case-studies"><div><p>REAL OPERATIONS. VERIFIED STORIES.</p><h2>Running a TuRnMaRk pilot?</h2><span>We only publish customer results and reviews with permission. Tell us about your workflow, waiting times and lessons.</span></div><Link href="/contact" className={styles.tmPrimaryAction}>Discuss a case study <ArrowRight size={18} aria-hidden="true" /></Link></section>

        <section className={styles.tmClosing}><p>READY TO CHANGE THE WAIT?</p><h2>Give people their place in line—and their time back.</h2><Link href="/sign-up" className={styles.tmPrimaryAction}>Get started free <ArrowRight size={18} aria-hidden="true" /></Link></section>
      </main>
    </MarketingFrame>
  );
}
