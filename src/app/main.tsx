/* src/app/main.tsx — FSAA app layer (Vite template): providers + router wiring.
   This is the composition root of a plain-React FSAA app. */

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { AppRouter } from "@pages/router";
import "@app/globals.css";
import { SITE } from "@shared/config/site";

export function TopBar() {
  return (
    <header className="topbar">
      <a href={SITE.repoUrl} className="brand">
        <svg viewBox="0 0 26 26" aria-hidden>
          <rect x="3" y="3" width="20" height="5" rx="1.5" fill="#7ab8ff" />
          <rect x="3" y="10.5" width="20" height="5" rx="1.5" fill="#43e0bd" />
          <rect x="3" y="18" width="20" height="5" rx="1.5" fill="#e0c96a" />
        </svg>
        <span>
          <b>{SITE.name} starter</b>
          <small>Vite + react-router template</small>
        </span>
      </a>
      <div className="top-spacer" />
      <div style={{ display: "flex", gap: 8 }}>
        <span className="pill live">FSAA layers enforced</span>
        <a
          href={SITE.repoUrl}
          target="_blank"
          rel="noreferrer"
          className="pill hide-sm"
        >
          methodology ↗
        </a>
      </div>
    </header>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <TopBar />
      <div className="page">
        <AppRouter />
      </div>
    </BrowserRouter>
  </StrictMode>,
);
