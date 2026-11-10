import type { Column } from '@shared/ui/molecules/table/DataTable';
import type { Order } from '@entities/order';

/* features/orders-overview/config/orderColumns — same pattern, second entity.
   NOTE: orderColumns are SIMILAR to projectColumns but deliberately separate.
   If a third entity needed the same money-column pattern twice more, THAT
   would be the graduation trigger — not sooner. */

export const orderColumns: Column<Order>[] = [
  {
    header: 'Reference',
    render: (row) => <strong>{row.reference}</strong>,
  },
  {
    header: 'Project',
    render: (row) => row.projectName,
  },
  {
    header: 'Amount',
    align: 'right',
    render: (row) => `$${row.amount.toLocaleString('en-US')}`,
  },
  {
    header: 'Status',
    render: (row) =>
      row.status === 'paid' ? '✅ paid' : row.status === 'pending' ? '⏳ pending' : '❌ cancelled',
  },
];