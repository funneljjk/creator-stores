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

// prompt tuned for a clean commerce thumbnail (no text/logo, on-topic).
// REALISTIC — real-world product/lifestyle photography, NOT sci-fi/abstract.
export function thumbPrompt(item, kind) {
  const t = item.title || '';
  if (kind === 'product') {
    return `Realistic professional commercial product photography for "${t}" (${item.category || 'product'}). A real, tangible physical product shown on a clean neutral studio background with soft natural lighting, shallow depth of field, photorealistic, high detail, like a real online-store listing photo. Absolutely NO science-fiction, NO robots, NO holograms, NO neon, NO abstract 3D — keep it grounded and real. No text, no words, no logo, no watermark. Square 1:1.`;
  }
  if (kind === 'coaching') {
    return `Realistic warm photograph for a coaching/class session: "${t}". Real people in a bright modern workspace or classroom, candid mentoring/learning moment, natural lighting, photorealistic, inviting. NO sci-fi, NO robots, NO abstract. No text, no logo, no watermark. 16:9.`;
  }
  return `Clean realistic editorial thumbnail for an online course "${t}". Real-world relevant imagery (desk setup, hands working, real objects related to the topic), bright professional photography style, subtle modern accents. NOT sci-fi, NOT robots, NOT heavy abstract. No text, no words, no logo, no watermark. 16:9.`;
}
