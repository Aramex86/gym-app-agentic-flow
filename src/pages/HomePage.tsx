import { Link } from 'react-router-dom';
import { SITE } from "@shared/config/site";

/* Thin page composition: import -> render. */

export function HomePage() {
  return (
    <section>
      <p className="crumb">Vite + react-router template</p>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <h1>FSAA — Feature-Sliced Atomic Architecture</h1>
        <a
          style={{ color: '#43e0bd', textDecoration: 'none', fontSize: '18px', fontWeight: 'bold' }}
          href="https://aramex86.github.io/fsaa/"
          target="_blank"
          rel="noopener noreferrer"
        >
          Docs
        </a>
      </div>
      <p className="pitch">
        FSD + Atomic Design with the missing decision rules:{' '}
        <strong>where does UI go?</strong>
      </p>
      <div className="chips">
        <span className="chip on">ESLint-enforced layers</span>
        <span className="chip">Projects/Orders example</span>
        <span className="chip">React 19 SPA</span>
      </div>
      <ul>
        <li>
          <Link to="/projects">Projects overview</Link> — feature owns business columns
        </li>
        <li>
          <Link to="/orders">Orders overview</Link> — second feature, same molecules, zero coupling
        </li>
      </ul>
      <p className="hint">
        Same layers and ESLint boundaries as the{' '}
        <a href="https://github.com/Aramex86/fsaa-react">Next.js template</a> — only the pages
        layer differs. Try violating a layer: <code className="inline">pnpm lint</code> → red.
      </p>
    </section>
  );
}