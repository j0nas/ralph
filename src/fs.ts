import { access } from 'node:fs/promises';

export const exists = (path: string): Promise<boolean> =>
  access(path)
    .then(() => true)
    .catch(() => false);
