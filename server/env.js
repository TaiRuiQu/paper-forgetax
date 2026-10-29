import { loadEnvFile } from 'node:process';
import { fileURLToPath } from 'node:url';

// Resolve from the project root, regardless of the launch directory.
// Existing environment variables take precedence over .env values.
try {
  loadEnvFile(fileURLToPath(new URL('../.env', import.meta.url)));
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}
