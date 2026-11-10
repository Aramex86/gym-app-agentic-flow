import type { ReactNode } from 'react';
import { TableCell, TableHeaderCell } from '@shared/ui/atoms/TableCell';

/* shared/ui/molecules/table/DataTable — generic composition of atoms.
   Knows NOTHING about projects or orders (boundary test passes).
   Business columns are injected via props — they live in FEATURES. */

export interface Column<T> {
  header: string;
  align?: 'left' | 'right';
  render: (row: T) => ReactNode;
}

export interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  isLoading?: boolean;
  rowKey: (row: T) => string;
}

export function DataTable<T>({ columns, data, isLoading = false, rowKey }: DataTableProps<T>) {
  if (isLoading) {
    return <p aria-busy="true">Loading…</p>;
  }

  return (
    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
      <thead>
        <tr>
          {columns.map((col) => (
            <TableHeaderCell key={col.header} align={col.align}>
              {col.header}
            </TableHeaderCell>
          ))}
        </tr>
      </thead>
      <tbody>
        {data.map((row) => (
          <tr key={rowKey(row)}>
            {columns.map((col) => (
              <TableCell key={col.header} align={col.align}>
                {col.render(row)}
              </TableCell>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}