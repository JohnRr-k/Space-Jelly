// Copies assets into public/media. Restricted (client-related) visuals are only
// copied for private builds. PUBLIC_MODE=true never ships them.
import { cpSync, rmSync, mkdirSync, existsSync } from 'node:fs';

const publicMode = process.env.PUBLIC_MODE === 'true';
rmSync('public/media', { recursive: true, force: true });
mkdirSync('public/media', { recursive: true });
cpSync('assets/open', 'public/media', { recursive: true });
if (!publicMode && existsSync('assets/restricted')) {
  cpSync('assets/restricted', 'public/media', { recursive: true });
}
console.log(`[assets] ${publicMode ? 'PUBLIC edition: restricted visuals excluded' : 'private edition: restricted visuals included'}`);
