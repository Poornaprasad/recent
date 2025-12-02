/**
 * File storage configuration
 */

import 'server-only';

export const STORAGE_CONFIG = {
  uploadsDir: './data/uploads',
  dataDir: './data',
  maxFileSize: 10 * 1024 * 1024, // 10MB
} as const;





