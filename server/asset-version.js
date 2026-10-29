import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

// Hash content, not timestamps, so identical deployments keep the same URLs.
export function assetVersion(roots) {
  const hash = createHash('sha256');
  function visit(directory, prefix) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const name = `${prefix}/${entry.name}`;
      const file = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(file, name);
      else if (entry.isFile()) {
        const data = fs.readFileSync(file);
        hash.update(`${name}\0${data.length}\0`);
        hash.update(data);
      }
    }
  }
  roots.forEach((root, index) => visit(root, String(index)));
  return hash.digest('hex').slice(0, 16);
}
