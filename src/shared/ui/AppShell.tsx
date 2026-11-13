/* shared/ui — persistent app shell ("Kinetic Obsidian").
   Styling via tokens (src/shared/ui/tokens.css) only — ADR-0001 D5. */

import type { ReactNode } from "react";
import { SITE } from "@shared/config/site";

export type AppShellProps = {
  children: ReactNode;
  title?: string;
  sessionStatus?: string;
};

export function AppShell({
  children,
  title = SITE.name,
  sessionStatus = "Session active",
}: AppShellProps) {
  return (
    <div
      className="app-shell"
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        background: "var(--canvas)",
        color: "var(--text-high)",
        fontFamily: "var(--font-body)",
      }}
    >
      <header
        className="app-shell__header"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "var(--sp-md) var(--sp-gutter)",
        }}
      >
        <h1
          style={{
            margin: 0,
            fontFamily: "var(--font-heading)",
            fontSize: "24px",
            fontWeight: "bold",
            color: "var(--text-high)",
          }}
        >
          {title}
        </h1>
        {/* Right slot reserved for a later task (profile button etc.). */}
        <div />
      </header>

      <main
        className="app-shell__main"
        style={{
          flex: 1,
          background: "var(--surface-lifted)",
        }}
      >
        {children}
      </main>

      <footer
        className="app-shell__footer"
        style={{
          padding: "var(--sp-xs) var(--sp-gutter)",
          borderTop: "1px solid var(--edge)",
          color: "var(--text-muted)",
        }}
      >
        {sessionStatus}
      </footer>
    </div>
  );
}
