// Small dependency-free helpers shared across the pipeline.
import { spawn } from 'node:child_process';

/** ANSI colors (no dep). Disabled when not a TTY. */
const useColor = process.stdout.isTTY;
const c = (code) => (s) => (useColor ? `\x1b[${code}m${s}\x1b[0m` : String(s));
export const color = {
  dim: c('2'),
  bold: c('1'),
  red: c('31'),
  green: c('32'),
  yellow: c('33'),
  blue: c('34'),
  cyan: c('36'),
};

export const log = {
  step: (m) => console.log(color.cyan('▶ ') + m),
  ok: (m) => console.log(color.green('✓ ') + m),
  warn: (m) => console.log(color.yellow('! ') + m),
  err: (m) => console.error(color.red('✗ ') + m),
  info: (m) => console.log(color.dim('  ' + m)),
};

/**
 * Run a command, capturing stdout. Rejects on non-zero exit.
 * @returns {Promise<string>} stdout
 */
export function run(cmd, args = [], { timeoutMs = 120000 } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    let err = '';
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error(`${cmd} timed out after ${timeoutMs}ms`));
    }, timeoutMs);
    child.stdout.on('data', (d) => (out += d));
    child.stderr.on('data', (d) => (err += d));
    child.on('error', (e) => {
      clearTimeout(timer);
      reject(e);
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      if (code === 0) resolve(out);
      else reject(new Error(`${cmd} exited ${code}: ${err.trim().slice(0, 500)}`));
    });
  });
}

/** Run yt-dlp with args and JSON-parse the single-line output. */
export async function ytdlpJSON(args, opts) {
  const raw = await run('yt-dlp', args, opts);
  return JSON.parse(raw);
}

/** Is a binary available on PATH? */
export async function hasBinary(name) {
  try {
    await run(process.platform === 'win32' ? 'where' : 'which', [name]);
    return true;
  } catch {
    return false;
  }
}

export function escapeHtml(s = '') {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function truncate(s = '', n = 120) {
  s = String(s);
  return s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s;
}

/** Turn arbitrary text into a url-safe slug (keeps unicode letters). */
export function slugify(s = '') {
  return String(s)
    .normalize('NFKC')
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

/** Format a yt-dlp upload_date (YYYYMMDD) as YYYY-MM-DD. */
export function fmtDate(yyyymmdd) {
  if (!yyyymmdd || String(yyyymmdd).length !== 8) return null;
  const s = String(yyyymmdd);
  return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
}

/** Seconds → H:MM:SS / M:SS. */
export function fmtDuration(sec) {
  if (sec == null) return null;
  sec = Math.round(Number(sec));
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  const pad = (n) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

/** Compact view counts: 12345 → 1.2만 (Korean) style. */
export function fmtCount(n) {
  if (n == null) return null;
  n = Number(n);
  if (n >= 100000000) return (n / 100000000).toFixed(1).replace(/\.0$/, '') + '억';
  if (n >= 10000) return (n / 10000).toFixed(1).replace(/\.0$/, '') + '만';
  if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + '천';
  return String(n);
}

/** Pick avatar / banner / best thumbnail from a yt-dlp thumbnails array. */
export function pickThumb(thumbnails = [], kind) {
  if (!Array.isArray(thumbnails) || thumbnails.length === 0) return null;
  const withSize = thumbnails.filter((t) => t && t.url);
  if (kind === 'avatar') {
    const named = withSize.find((t) => t.id === 'avatar_uncropped');
    if (named) return named.url;
    // most square, largest
    const square = [...withSize]
      .filter((t) => t.width && t.height)
      .sort((a, b) => {
        const ra = Math.abs(a.width / a.height - 1);
        const rb = Math.abs(b.width / b.height - 1);
        return ra - rb || b.width - a.width;
      });
    return (square[0] || withSize[withSize.length - 1]).url;
  }
  if (kind === 'banner') {
    const named = withSize.find((t) => t.id === 'banner_uncropped');
    if (named) return named.url;
    const wide = [...withSize]
      .filter((t) => t.width && t.height)
      .sort((a, b) => b.width / b.height - a.width / a.height || b.width - a.width);
    return wide[0] ? wide[0].url : null;
  }
  // best: largest by width
  const best = [...withSize].sort((a, b) => (b.width || 0) - (a.width || 0));
  return best[0].url;
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
