export interface Community {
  id: string;
  name: string;
  description: string;
  type: 'geographic' | 'thematic';
  managerIds: string[];
  memberIds: string[];
  createdAt: number;
}
