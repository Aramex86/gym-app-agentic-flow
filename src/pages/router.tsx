import { Route, Routes } from 'react-router-dom';
import { ProjectsPage } from './ProjectsPage';
import { OrdersPage } from './OrdersPage';
import { HomePage } from './HomePage';
import { ProgressPage } from './ProgressPage';
import { LoggerPage } from './LoggerPage';
import { OnboardingPage } from './OnboardingPage';

/* src/pages — FSAA pages layer, Vite template.
   In the Next.js template this layer IS the App Router (route files).
   Here it is react-router: route compositions stay thin, business logic
   stays in features. Both templates share the SAME rule set. */

export function AppRouter() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/projects" element={<ProjectsPage />} />
      <Route path="/orders" element={<OrdersPage />} />
      <Route path="/progress" element={<ProgressPage />} />
      {/* Logger + Onboarding are real feature surfaces linked from nav ids. */}
      <Route path="/logger" element={<LoggerPage />} />
      <Route path="/onboarding" element={<OnboardingPage />} />
    </Routes>
  );
}