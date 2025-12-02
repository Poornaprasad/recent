import { createStore, type BaseEntity } from './store-base';

export type User = BaseEntity & {
    name: string;
    email: string;
    role: 'Admin' | 'Editor' | 'Viewer';
    status: 'Active' | 'Inactive' | 'Invited';
};

const initialUsers: User[] = [
    { id: '1', name: 'Alice Johnson', email: 'alice@example.com', role: 'Admin', status: 'Active' },
    { id: '2', name: 'Bob Williams', email: 'bob@example.com', role: 'Editor', status: 'Active' },
    { id: '3', name: 'Charlie Brown', email: 'charlie@example.com', role: 'Viewer', status: 'Invited' },
    { id: '4', name: 'Diana Miller', email: 'diana@example.com', role: 'Editor', status: 'Inactive' },
    { id: '5', name: 'Ethan Davis', email: 'ethan@example.com', role: 'Viewer', status: 'Active' },
];

const [, store] = createStore(initialUsers, () => String(Date.now()));

export const getUsers = store.getAll;
export const getUserById = store.getById;
export const addUser = store.add;
export const updateUser = store.update;
export const deleteUser = store.delete;
