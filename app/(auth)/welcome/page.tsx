import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { ArrowRight, ChartNoAxesColumnIncreasing, UsersRound, Zap } from "lucide-react";
import { redirect } from "next/navigation";
import { Brand } from "@/components/ui/brand";
import { TURNMARK_ASSETS } from "@/lib/brand/assets";
import styles from "./welcome.module.css";

export const metadata: Metadata = { title: "Welcome" };

const benefits = [
  { title: "Save Time", description: "Reduce waiting time and congestion.", icon: Zap },
  { title: "Better Experience", description: "Keep people informed in real-time.", icon: UsersRound },
  { title: "More Productivity", description: "Serve more people, every day.", icon: ChartNoAxesColumnIncreasing },
] as const;

export default async function WelcomePage() {
  const { userId } = await auth();
  if (userId) redirect("/dashboard");

  const receptionist = TURNMARK_ASSETS.auth.receptionistCutout;

  return (
    <main id="main" className={styles.viewport}>
      <article className={styles.screen} aria-labelledby="welcome-title">
        <header className={styles.header}>
          <Brand className={styles.brand} priority />
          <Link className={styles.skip} href="/sign-in">Skip</Link>
        </header>

        <section className={styles.intro}>
          <p className={styles.eyebrow}>Queues <span>•</span> Appointments <span>•</span> Attendance</p>
          <h1 id="welcome-title" aria-label="People flow better with TuRnMaRk.">People flow<br />better with<br /><strong>TuRnMaRk.</strong></h1>
          <p className={styles.description}>Manage queues, appointments and attendance for your school, hospital, bank or business — all in one place.</p>
        </section>

        <section className={styles.visual} aria-label="TuRnMaRk benefits">
          <span className={styles.orangeShape} aria-hidden="true" />
          <ul className={styles.benefits}>
            {benefits.map(({ title, description, icon: Icon }) => (
              <li key={title}>
                <span className={styles.icon}><Icon size={24} strokeWidth={2.8} aria-hidden="true" /></span>
                <span><strong>{title}</strong><small>{description}</small></span>
              </li>
            ))}
          </ul>
          <Image
            className={styles.receptionist}
            src={receptionist.src}
            width={receptionist.width}
            height={receptionist.height}
            alt={receptionist.alt}
            sizes="(max-width: 430px) 70vw, 300px"
            priority
          />
        </section>

        <figure className={styles.quote}>
          <span aria-hidden="true">“</span>
          <div>
            <blockquote>Finally, a simple and modern way to manage queues and attendance.</blockquote>
            <figcaption>— School Administrator</figcaption>
            <span className="sr-only">Illustrative product scenario</span>
          </div>
        </figure>

        <div className={styles.pagination} aria-label="Welcome slide 1 of 3">
          <span className={styles.active} />
          <span />
          <span />
        </div>

        <Link className={styles.getStarted} href="/sign-up">
          Get started <ArrowRight size={22} aria-hidden="true" />
        </Link>
      </article>
    </main>
  );
}
