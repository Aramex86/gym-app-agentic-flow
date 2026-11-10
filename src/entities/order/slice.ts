/* entities/order — state / business logic. */

import type { Order } from './types';

export function selectOpenOrders(orders: Order[]): Order[] {
  return orders.filter((order) => order.status !== 'cancelled');
}

export function selectOrdersTotal(orders: Order[]): number {
  return orders.reduce((total, order) => total + order.amount, 0);
}
