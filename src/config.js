// Loads runmoa credentials from environment + an optional .env file.
// No external dependency (tiny .env parser).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

function loadDotEnv() {
  const file = path.join(ROOT, '.env');
  if (!fs.existsSync(file)) return;
  const text = fs.readFileSync(file, 'utf8');
  for (const line of text.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq === -1) continue;
    const key = t.slice(0, eq).trim();
    let val = t.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = val;
  }
}

loadDotEnv();

function cleanHost(h) {
  if (!h) return '';
  return h.replace(/^https?:\/\//, '').replace(/\/.*$/, '').trim();
}

export const ROOT_DIR = ROOT;

export const config = {
  siteHost: cleanHost(process.env.RUNMOA_SITE_HOST),
  storefrontKey: (process.env.RUNMOA_STOREFRONT_KEY || '').trim(),
  serverKey: (process.env.RUNMOA_SERVER_KEY || '').trim(),
  categoryId: process.env.RUNMOA_CATEGORY_ID ? Number(process.env.RUNMOA_CATEGORY_ID) : null,
  contentStatus: (process.env.RUNMOA_CONTENT_STATUS || 'pending').trim(),
};

/** Can we read the storefront (homepage data)? */
export const canRead = () => Boolean(config.siteHost && config.storefrontKey);
/** Can we write contents (ingest)? */
export const canWrite = () => Boolean(config.siteHost && config.serverKey);
