// AI thumbnail generation via Gemini image models. Each course/product gets a
// bespoke image (no stock YouTube frame / brand logo). Returns base64 PNG; the
// server saves + serves it so runmoa re-hosts it as featured_image.

const ENDPOINT = (m) => `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent`;

export async function generateImage(prompt, key, model = 'gemini-2.5-flash-image') {
  const res = await fetch(ENDPOINT(model) + '?key=' + encodeURIComponent(key), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
    signal: AbortSignal.timeout(60000),
  });
  const j = await res.json();
  if (j.error) throw new Error('gemini-img ' + j.error.code + ' ' + (j.error.message || '').slice(0, 80));
  const parts = (j.candidates && j.candidates[0] && j.candidates[0].content && j.candidates[0].content.parts) || [];
  const img = parts.find((p) => p.inlineData && p.inlineData.data);
  if (!img) throw new Error('no image in response');
  return img.inlineData.data; // base64 PNG
}

// bounded-concurrency map (avoid hammering the image API)
export async function mapLimit(items, limit, fn) {
  const out = new Array(items.length);
  let i = 0;
  async function worker() {
    while (i < items.length) { const idx = i++; try { out[idx] = await fn(items[idx], idx); } catch (e) { out[idx] = null; } }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

// deterministic short hash → stable filename so generate + deploy reuse the same file
export function imgHash(s) {
  let h = 2166136261;
  for (let i = 0; i < String(s).length; i++) { h ^= String(s).charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0).toString(36);
}

// prompt tuned for a clean commerce thumbnail (no text/logo, on-topic)
export function thumbPrompt(item, kind) {
  const t = item.title || '';
  if (kind === 'product') {
    return `High-quality e-commerce product thumbnail representing "${t}" (${item.category || 'digital product'}). Clean minimal studio background, soft lighting, centered subject, vibrant, photorealistic. No text, no words, no logo, no watermark. Square composition.`;
  }
  return `Modern online-course cover thumbnail for a class titled "${t}". Sleek tech-editorial style, abstract/illustrative on-topic imagery, vibrant gradient accents. No text, no words, no logo, no watermark. 16:9 composition.`;
}
