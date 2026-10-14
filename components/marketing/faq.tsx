import { jsonLd } from "@/lib/site/metadata";
import styles from "./site.module.css";
const questions = [
  ["Do customers need an app or account?", "No. Ordinary queue customers open a QR link in their browser and join without an account or installation."],
  ["Can customers leave the waiting area?", "They can track their place from their ticket link. They should stay close enough to return when called and follow the organization’s instructions."],
  ["Are waiting times guaranteed?", "No. Wait times are estimates based on queue conditions. Service time and staff availability can change."],
  ["What happens if a phone loses its connection?", "The ticket reloads the authoritative queue state after reconnecting. Keep the ticket link private and reopen it when connectivity returns."],
  ["Can schools use TuRnMaRk?", "Yes. School and hybrid workspaces support campus queues and accountless class attendance, with roster validation and PDF, CSV and XLSX registers."],
] as const;
export function FrequentlyAskedQuestions() { return <section className={styles.stepsSection} id="questions"><div className={styles.sectionHeading}><h2>Five things to know.</h2></div><div className={styles.faq}>{questions.map(([question, answer]) => <details key={question}><summary>{question}</summary><p>{answer}</p></details>)}</div><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd({ "@context": "https://schema.org", "@type": "FAQPage", mainEntity: questions.map(([name, text]) => ({ "@type": "Question", name, acceptedAnswer: { "@type": "Answer", text } })) }) }} /></section>; }
