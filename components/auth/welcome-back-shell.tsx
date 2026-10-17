import Image from "next/image";
import { Clock3, Sparkles, TrendingUp } from "lucide-react";
import { Brand } from "@/components/ui/brand";
import { TURNMARK_ASSETS } from "@/lib/brand/assets";
import styles from "./welcome-back.module.css";

const benefits = [
  { title: "Save Time", description: "Reduce waiting time and congestion", icon: Clock3 },
  { title: "Better Experience", description: "Keep people informed in real-time", icon: Sparkles },
  { title: "More Productivity", description: "Serve more people, every day", icon: TrendingUp },
] as const;

export function WelcomeBackShell({ children }: { children: React.ReactNode }) {
  const receptionist = TURNMARK_ASSETS.auth.receptionist;
  const avatars = TURNMARK_ASSETS.auth.trustedAvatars;
  const decoration = TURNMARK_ASSETS.auth.gradientDecoration;

  return (
    <main id="main" className={styles.page}>
      <Image
        className={`${styles.decoration} ${styles.decorationTop}`}
        src={decoration.src}
        width={decoration.width}
        height={decoration.height}
        alt=""
        sizes="280px"
      />
      <div className={styles.frame}>
        <section className={styles.story} aria-labelledby="welcome-story-title">
          <Brand className={styles.brand} priority />
          <div className={styles.storyCopy}>
            <p className={styles.pill}>Queues <span>•</span> Appointments <span>•</span> Attendance</p>
            <h2 id="welcome-story-title">People flow<br />better with<br /><span>TuRnMaRk.</span></h2>
            <p className={styles.storyDescription}>Manage queues, appointments and attendance for your school, hospital, bank or business — all in one place.</p>
            <ul className={styles.benefits}>
              {benefits.map(({ title, description, icon: Icon }) => (
                <li key={title}>
                  <span className={styles.benefitIcon}><Icon aria-hidden="true" size={19} /></span>
                  <span><strong>{title}</strong><small>{description}</small></span>
                </li>
              ))}
            </ul>
          </div>

          <div className={styles.character}>
            <Image
              src={receptionist.src}
              width={receptionist.width}
              height={receptionist.height}
              alt={receptionist.alt}
              sizes="(max-width: 900px) 0px, (max-width: 1500px) 38vw, 570px"
            />
          </div>

          <div className={styles.trust}>
            <Image src={avatars.src} width={avatars.width} height={avatars.height} alt={avatars.alt} sizes="136px" />
            <p>Designed for schools, hospitals,<br />banks and businesses</p>
          </div>

          <figure className={styles.quote}>
            <span aria-hidden="true">“</span>
            <blockquote>Finally, a simple and modern way to manage queues and attendance.</blockquote>
            <figcaption>Illustrative product scenario</figcaption>
          </figure>
        </section>

        <section className={styles.authPanel} aria-labelledby="welcome-back-title">
          <div className={styles.mobileBrand}><Brand priority /></div>
          <div className={styles.responsiveLayout}>
            <div className={styles.authContent}>
              <p className={styles.authEyebrow}>Secure access</p>
              <h1 id="welcome-back-title">Welcome back</h1>
              <p className={styles.authDescription}>Sign in to your TuRnMaRk account</p>
              {children}
            </div>

            <aside className={styles.responsiveStory} aria-label="TuRnMaRk product overview">
              <div className={styles.responsiveStoryCopy}>
                <p>Queues <span>•</span> Appointments <span>•</span> Attendance</p>
                <strong>People flow better with TuRnMaRk.</strong>
                <small>Simple tools for smoother service, from arrival to completion.</small>
              </div>
              <Image
                src={receptionist.src}
                width={receptionist.width}
                height={receptionist.height}
                alt=""
                sizes="(max-width: 620px) 150px, (max-width: 900px) 38vw, 0px"
              />
            </aside>
          </div>
        </section>
      </div>
    </main>
  );
}
