import { createStore, type BaseEntity } from './store-base';

export type Vendor = BaseEntity & {
    name: string;
    contactName: string;
    contactEmail: string;
    status: 'Active' | 'Inactive';
};

const initialVendors: Vendor[] = [
    { id: '1', name: 'Global Tech Inc.', contactName: 'Jane Smith', contactEmail: 'jane.smith@globaltech.com', status: 'Active' },
    { id: '2', name: 'Creative Solutions', contactName: 'John Doe', contactEmail: 'john.doe@creativesolutions.com', status: 'Active' },
    { id: '3', name: 'Innovate LLC', contactName: 'Emily White', contactEmail: 'emily.white@innovatellc.com', status: 'Inactive' },
    { id: '4', name: 'Supply Co.', contactName: 'Michael Brown', contactEmail: 'michael.brown@supplyco.com', status: 'Active' },
];

const [, store] = createStore(initialVendors, () => String(Date.now()));

export const getVendors = store.getAll;
export const getVendorById = store.getById;
export const addVendor = store.add;
export const updateVendor = store.update;
export const deleteVendor = store.delete;
