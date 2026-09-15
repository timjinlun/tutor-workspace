import type { ReactNode } from "react";
import "./setup-panel.css";

/** Presentation shell only. Each independent setup module owns its forms/actions. */
export function SetupPanel({ title, description, actions, children, footer }: { title: string; description: ReactNode; actions: ReactNode; children: ReactNode; footer?: ReactNode }) {
  return <section className="setup-panel">
    <header className="setup-panel-head"><div><h2>{title}</h2><p>{description}</p></div><div className="setup-actions">{actions}</div></header>
    {children}
    {footer && <footer className="setup-footer">{footer}</footer>}
  </section>;
}
