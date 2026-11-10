/* entities/order — data access. Swap for a real API without touching features. */

import type { Order } from './types';

const ORDERS: Order[] = [
  { id: 'o1', reference: 'INV-2026-001', projectName: 'Core Banking Migration', amount: 18500, status: 'paid' },
  { id: 'o2', reference: 'INV-2026-002', projectName: 'Mobile App v2', amount: 6200, status: 'pending' },
  { id: 'o3', reference: 'INV-2026-003', projectName: 'Mobile App v2', amount: 12400, status: 'pending' },
  { id: 'o4', reference: 'INV-2026-004', projectName: 'Legacy CRM Sunset', amount: 3100, status: 'cancelled' },
];

export function getOrders(): Promise<Order[]> {
  return Promise.resolve(ORDERS);
}
