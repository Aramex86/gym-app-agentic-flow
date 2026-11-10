import { describe, expect, it } from 'vitest';
import { getProjects, selectActiveProjects } from '../index';

describe('entities/project', () => {
  it('returns projects and derives the active subset', async () => {
    const projects = await getProjects();
    expect(projects.length).toBeGreaterThan(0);
    expect(selectActiveProjects(projects).every((project) => project.status === 'active')).toBe(true);
  });
});
