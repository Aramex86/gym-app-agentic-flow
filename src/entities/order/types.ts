/* entities/order — types. */

export interface Order {
  id: string;
  reference: string;
  projectName: string;
  amount: number;
  status: 'pending' | 'paid' | 'cancelled';
}
