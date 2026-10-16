import Link from "next/link";
import { AlertCircle, ArrowLeft, ArrowRight, Check, CheckCircle2, Pencil, Sparkles } from "lucide-react";
import { AuthNavigation } from "@/components/auth/auth-navigation";
import { Brand } from "@/components/ui/brand";
import styles from "./onboarding.module.css";

export function OnboardingShell({ children }: { children: React.ReactNode }) {
  return <div className={styles.shell}>
    <span className={styles.shapeOne} aria-hidden="true"/><span className={styles.shapeTwo} aria-hidden="true"/><span className={styles.shapeThree} aria-hidden="true"/>
    <header className={styles.header}><Brand/><nav aria-label="Account"><AuthNavigation/></nav></header>
    <main id="main" className={styles.main}>{children}</main>
    <footer className={styles.footer}><span>TuRnMaRk</span><span aria-hidden="true">·</span><Link href="/privacy">Privacy</Link></footer>
  </div>;
}

export function OnboardingFrame({ children, steps, step }: { children: React.ReactNode; steps: readonly string[]; step: number }) {
  const percentage = Math.round(((step + 1) / steps.length) * 100);
  return <div className={styles.frame}>
    <aside className={styles.rail} aria-label="Onboarding progress">
      <p className={styles.railEyebrow}>Workspace setup</p><h2>Make TuRnMaRk<br/>work your way.</h2><p>Only the details needed to open your workspace.</p>
      <ol className={styles.steps}>{steps.map((label,index)=><li key={label} className={`${styles.step} ${index===step?styles.stepCurrent:""} ${index<step?styles.stepDone:""}`} aria-current={index===step?"step":undefined}><span className={styles.stepDot}>{index<step?<Check size={13}/>:index+1}</span><span>{label}</span></li>)}</ol>
      <p className={styles.railNote}>Your selections are saved while you move between steps. Nothing is created until you confirm.</p>
    </aside>
    <div className={styles.body}>
      <div className={styles.mobileProgress} aria-label={`Step ${step+1} of ${steps.length}: ${steps[step]}`}><div className={styles.mobileProgressTop}><span>Step {step+1} of {steps.length}</span><strong>{steps[step]}</strong></div><div className={styles.progressTrack} aria-hidden="true"><span style={{width:`${percentage}%`}}/></div></div>
      {children}
    </div>
  </div>;
}

export function ScreenHeader({ eyebrow, title, description, brand = false }: { eyebrow: string; title: string; description: string; brand?: boolean }) {
  return <><p className={styles.screenEyebrow}>{eyebrow}</p><h1 id="onboarding-step-title" tabIndex={-1}>{brand?<>{title} <span className={styles.gradientText}>TuRnMaRk</span></>:title}</h1><p className={styles.lead}>{description}</p></>;
}

export function ChoiceCard({ title, description, selected, icon, disabled = false, onSelect }: { title: string; description?: string; selected: boolean; icon: React.ReactNode; disabled?: boolean; onSelect: () => void }) {
  return <button type="button" role="radio" aria-label={title} aria-checked={selected} disabled={disabled} onClick={onSelect} className={styles.choice}><span className={styles.choiceIcon}>{icon}</span><span className={styles.choiceCopy}><span className={styles.choiceTitle}>{title}</span>{description?<span className={styles.choiceDescription}>{description}</span>:null}</span><span className={styles.choiceCheck} aria-hidden="true"><Check size={13}/></span></button>;
}

export function Field({ id, label, optional, error, hint, className, children }: { id: string; label: string; optional?: boolean; error?: string; hint?: string; className?: string; children: React.ReactNode }) {
  return <div className={`${styles.field} ${className??""}`}><label htmlFor={id}>{label} {optional?<span className={styles.optional}>(optional)</span>:null}</label>{children}{hint?<p className={styles.fieldHint}>{hint}</p>:null}{error?<p id={`${id}-error`} className={styles.fieldError}>{error}</p>:null}</div>;
}

export function ErrorBanner({ message }: { message: string }) { return <div role="alert" tabIndex={-1} className={styles.alert}><AlertCircle size={18}/><span>{message}</span></div>; }

export function LoadingState({ label }: { label: string }) { return <span className={styles.loadingState} role="status"><span className={styles.loadingDot} aria-hidden="true"/>{label}</span>; }

export function ActionFooter({ first, final, pending, onBack, onContinue }: { first: boolean; final: boolean; pending: boolean; onBack: () => void; onContinue: () => void }) {
  return <div className={styles.actions}><button type="button" onClick={onBack} disabled={first||pending} className={styles.back}><ArrowLeft size={16}/>Back</button><button type={final?"submit":"button"} onClick={final?undefined:onContinue} disabled={pending} className={styles.primary}>{pending?<LoadingState label="Creating workspace…"/>:<><span>{final?"Create workspace":"Continue"}</span><ArrowRight size={16}/></>}</button></div>;
}

export function ReviewRow({ label, value, onEdit }: { label: string; value?: string; onEdit: () => void }) { return <div className={styles.reviewRow}><dt>{label}</dt><dd>{value||"—"}</dd><button type="button" onClick={onEdit} className={styles.edit} aria-label={`Edit ${label}`}><Pencil size={12}/>Edit</button></div>; }

export function SuccessPanel({ name, pendingVerification, organization }: { name: string; pendingVerification: boolean; organization: boolean }) {
  return <section className={styles.result} aria-labelledby="workspace-ready-title"><div className={styles.resultIcon}><CheckCircle2 size={46}/></div><p className={styles.screenEyebrow}>Setup complete</p><h1 id="workspace-ready-title">{pendingVerification?"Request received":"Your workspace is ready!"}</h1><p className={styles.resultLead}>{pendingVerification?`Your ${name} workspace has been created. Your organization request is awaiting verification before official public activation.`:`Welcome to ${name}. Your workspace was confirmed and is ready for its first real setup.`}</p><div className={styles.resultActions}><Link href="/dashboard" className={styles.resultPrimary}>Go to Dashboard <ArrowRight size={16}/></Link><Link href="/dashboard/services" className={styles.resultSecondary}>Configure first service</Link>{organization?<Link href="/dashboard/team" className={styles.resultSecondary}>Invite team members</Link>:null}</div><ul className={styles.nextList}><li><strong><Sparkles size={13}/> Set up your service</strong>Choose what people will join or attend.</li><li><strong>Share when ready</strong>No public queue is activated by onboarding.</li><li><strong>Keep control</strong>Invite people only when their access is needed.</li></ul></section>;
}

export { styles as onboardingStyles };
