/** Load project/.env into process.env without printing values. */
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadEnvFile } from '../../../project/src/env.js';

const here = dirname(fileURLToPath(import.meta.url));
const projectEnv = join(here, '../../../project/.env');

export function loadProjectEnv(target = process.env) {
  loadEnvFile(projectEnv, target);
  return {
    path: projectEnv,
    has_model_api_key: Boolean(target.MODEL_API_KEY),
    key_len: target.MODEL_API_KEY ? String(target.MODEL_API_KEY).length : 0,
  };
}
