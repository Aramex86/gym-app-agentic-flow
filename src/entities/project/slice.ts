/* entities/project — state / business logic. */

import type { Project } from './types';

export function selectActiveProjects(projects: Project[]): Project[] {
  return projects.filter((project) => project.status === 'active');
}
