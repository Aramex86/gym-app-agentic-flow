import { useEffect, useState } from 'react';
import { DataTable } from '@shared/ui/molecules/table/DataTable';
import { getProjects, type Project } from '@entities/project';
import { projectColumns } from '../config/projectColumns';

/* features/projects-overview/ui/ProjectsOverview — the FEATURE owns the scenario:
   data (via entities), business columns, and composition of shared molecules. */

export function ProjectsOverview() {
  const [projects, setProjects] = useState<Project[] | null>(null);

  useEffect(() => {
    let alive = true;
    getProjects().then((data) => {
      if (alive) setProjects(data);
    });
    return () => {
      alive = false;
    };
  }, []);

  return (
    <section>
      <h2>Projects</h2>
      {projects && (
        <DataTable
          columns={projectColumns}
          data={projects}
          rowKey={(row) => row.id}
        />
      )}
    </section>
  );
}