import type { Column } from '@shared/ui/molecules/table/DataTable';
import { TableHeaderCell } from '@shared/ui/atoms/TableCell';
import type { Project } from '@entities/project';

/* features/projects-overview/config/projectColumns — BUSINESS columns.
   Built from shared molecules/atoms, but knowing projects — so they live
   in the feature, not in shared. This is THE FSAA answer to "where does UI go". */

type ProjectRow = Project & { id: string };

export const projectColumns: Column<ProjectRow>[] = [
  {
    header: 'Project',
    render: (row) => <strong>{row.name}</strong>,
  },
  {
    header: 'Status',
    render: (row) => (row.status === 'active' ? '🟢 active' : '📦 archived'),
  },
  {
    header: 'Budget',
    align: 'right',
    render: (row) => `$${row.budget.toLocaleString('en-US')}`,
  },
];
