import { describe, expect, it } from 'vitest';
import { getOrders, selectOpenOrders, selectOrdersTotal } from '../index';

describe('entities/order', () => {
  it('returns orders with valid ids, amounts and statuses', async () => {
    const orders = await getOrders();
    expect(orders.length).toBeGreaterThan(0);
    for (const order of orders) {
      expect(order.id).toBeTruthy();
      expect(order.amount).toBeGreaterThan(0);
      expect(['pending', 'paid', 'cancelled'] as const).toContain(order.status);
    }
  });

  it('derives open orders and total through the slice', async () => {
    const orders = await getOrders();
    expect(selectOpenOrders(orders).every((order) => order.status !== 'cancelled')).toBe(true);
    expect(selectOrdersTotal(orders)).toBe(orders.reduce((sum, order) => sum + order.amount, 0));
  });
});
