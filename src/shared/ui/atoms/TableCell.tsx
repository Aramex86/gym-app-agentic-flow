/* shared/ui/atoms/TableCell — generic table cell. Passes the boundary test:
   describable without users/orders/projects. */

export interface TableCellProps {
  children: React.ReactNode;
  align?: 'left' | 'right';
}

export function TableCell({ children, align = 'left' }: TableCellProps) {
  return (
    <td style={{ padding: '8px 12px', borderBottom: '1px solid #e2e8f0', textAlign: align }}>
      {children}
    </td>
  );
}

export function TableHeaderCell({ children, align = 'left' }: TableCellProps) {
  return (
    <th style={{ padding: '8px 12px', textAlign: align, fontWeight: 600, color: '#475569' }}>
      {children}
    </th>
  );
}