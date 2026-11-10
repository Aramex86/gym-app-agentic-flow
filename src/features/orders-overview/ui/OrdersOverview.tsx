import { useEffect, useState } from 'react';
import { DataTable } from '@shared/ui/molecules/table/DataTable';
import { getOrders, type Order } from '@entities/order';
import { orderColumns } from '../config/orderColumns';

/* features/orders-overview — second feature of the canonical example.
   The lint rule "features do not import each other" guarantees
   ProjectsOverview and OrdersOverview stay independent. */

export function OrdersOverview() {
  const [orders, setOrders] = useState<Order[] | null>(null);

  useEffect(() => {
    let alive = true;
    getOrders().then((data) => {
      if (alive) setOrders(data);
    });
    return () => {
      alive = false;
    };
  }, []);

  return (
    <section>
      <h2>Orders</h2>
      {orders && <DataTable columns={orderColumns} data={orders} rowKey={(row) => row.id} />}
    </section>
  );
}