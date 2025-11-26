import { config } from '../config';
import { memoryStore } from './memoryStore';
import { createPostgresStore } from './postgresStore';
import type { Store } from './store';
export { ConcurrencyConflictError } from './store';

let storeInstance: Store;

if (config.storeBackend === 'postgres') {
  storeInstance = createPostgresStore();
} else {
  storeInstance = memoryStore;
}

export const store: Store = storeInstance;

