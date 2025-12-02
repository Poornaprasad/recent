/**
 * Base store pattern for in-memory data stores
 * Provides consistent CRUD operations across all stores
 */

export interface BaseEntity {
  id: string;
}

export interface StoreOperations<T extends BaseEntity> {
  getAll(): T[];
  getById(id: string): T | undefined;
  add(entity: Omit<T, 'id'>): T;
  update(id: string, updates: Partial<Omit<T, 'id'>>): T | undefined;
  delete(id: string): boolean;
}

/**
 * Creates a generic in-memory store with standard CRUD operations
 */
export function createStore<T extends BaseEntity>(
  initialData: T[] = [],
  generateId: () => string = () => String(Date.now())
): [T[], StoreOperations<T>] {
  let data: T[] = [...initialData];

  const operations: StoreOperations<T> = {
    getAll(): T[] {
      return [...data];
    },

    getById(id: string): T | undefined {
      return data.find(item => item.id === id);
    },

    add(entity: Omit<T, 'id'>): T {
      const newEntity = { ...entity, id: generateId() } as T;
      data.push(newEntity);
      return newEntity;
    },

    update(id: string, updates: Partial<Omit<T, 'id'>>): T | undefined {
      const index = data.findIndex(item => item.id === id);
      if (index === -1) return undefined;
      
      data[index] = { ...data[index], ...updates };
      return data[index];
    },

    delete(id: string): boolean {
      const initialLength = data.length;
      data = data.filter(item => item.id !== id);
      return data.length < initialLength;
    },
  };

  return [data, operations];
}





