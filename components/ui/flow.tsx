import Link from "next/link";
import { Check, ChevronRight } from "lucide-react";
import type { ReactNode } from "react";

export type BreadcrumbItem = { label: string; href?: string };

/**
 * Breadcrumb trail. Items with an href render as links; the last item is
 * always plain text marked aria-current="page". Styles: .flow-crumbs in
 * globals.css.
 */
export function Breadcrumbs({ items }: { items: BreadcrumbItem[] }) {
  if (items.length === 0) return null;
  return (
    <nav className="flow-crumbs" aria-label="Breadcrumb">
      <ol>
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          return (
            <li key={`${item.label}-${index}`}>
              {index > 0 && <ChevronRight className="flow-crumbs-sep" size={14} aria-hidden="true" />}
              {isLast ? (
                <span aria-current="page">{item.label}</span>
              ) : item.href ? (
                <Link href={item.href}>{item.label}</Link>
              ) : (
                <span>{item.label}</span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/**
 * Horizontal step progress for multi-step flows (onboarding, checkout,
 * submission). `current` is the zero-based index of the active step:
 * earlier steps render completed (orange fill + check), later steps
 * upcoming (muted). Styles: .flow-steps in globals.css.
 */
export function StepIndicator({ steps, current }: { steps: string[]; current: number }) {
  return (
    <ol className="flow-steps" aria-label="Progress">
      {steps.map((step, index) => {
        const state = index < current ? "completed" : index === current ? "active" : "upcoming";
        return (
          <li
            key={`${step}-${index}`}
            className={`flow-step flow-step-${state}`}
            aria-current={state === "active" ? "step" : undefined}
          >
            <span className="flow-step-marker" aria-hidden="true">
              {state === "completed" ? <Check size={14} /> : index + 1}
            </span>
            <span className="flow-step-label">{step}</span>
          </li>
        );
      })}
    </ol>
  );
}

/**
 * Sticky bottom action bar for forms and flows: panel surface, top border,
 * blurred backdrop, actions aligned to the end. Styles: .flow-sticky-bar
 * in globals.css.
 */
export function StickyActionBar({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={`flow-sticky-bar${className ? ` ${className}` : ""}`}>{children}</div>;
}
