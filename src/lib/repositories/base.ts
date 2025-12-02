/**
 * Base repository types and interfaces
 */

export interface BaseEntity {
  id: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Repository<T extends BaseEntity> {
  findAll(): Promise<T[]>;
  findById(id: string): Promise<T | undefined>;
  create(entity: Omit<T, 'id'>): Promise<T>;
  update(id: string, updates: Partial<Omit<T, 'id'>>): Promise<T | undefined>;
  delete(id: string): Promise<boolean>;
}

