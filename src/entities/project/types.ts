/* entities/project — types. */

export interface Project {
  id: string;
  name: string;
  status: 'active' | 'archived';
  budget: number;
}
