/* entities/project — data access. Isolated here so a real API swaps in without touching features. */

import type { Project } from './types';

const PROJECTS: Project[] = [
  { id: 'p1', name: 'Core Banking Migration', status: 'active', budget: 120000 },
  { id: 'p2', name: 'Mobile App v2', status: 'active', budget: 86000 },
  { id: 'p3', name: 'Legacy CRM Sunset', status: 'archived', budget: 45000 },
];

export function getProjects(): Promise<Project[]> {
  return Promise.resolve(PROJECTS);
}
