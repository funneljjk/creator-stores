// Orchestrates: analyze channel → derive insights → build a COMMERCE catalog
// (강의 + 일반상품) → (live) create runmoa contents/products → emit the
// platform data the storefront renders. Works in dry-run with no creds.
import fs from 'node:fs';
import path from 'node:path';
import { analyzeChannel } from './youtube.js';
import { deriveInsights } from './analyze.js';
import { buildCatalog } from './catalog.js';
import { courseToContentPayload, productToProductPayload } from './mapper.js';
import { normalizeCategories } from './runmoa.js';
import { log, color, slugify, fmtCount } from './util.js';
import { ROOT_DIR } from './config.js';

/** The single object the storefront (web/) consumes. */
export function buildPlatformData(catalog, { mode, created = [] } = {}) {
  return {
    ...catalog,
    generatedAt: new Date().toISOString(),
    meta: { mode, createdCount: created.length },
  };
}

async function resolveCategory(client, { categoryId, topics, kind }) {
  if (categoryId) return { id: categoryId, name: '(configured)' };
  let cats = [];
  try {
    const raw =
      kind === 'product'
        ? await client._request(client.serverBase, '/product-categories', { surface: 'server' })
        : await client.getContentCategoriesServer();
    cats = normalizeCategories(raw);
  } catch (e) {
    log.warn(`Could not list ${kind} categories: ${e.message}`);
  }
  if (!cats.length) return null;
  for (const t of topics || []) {
    const hit = cats.find((c) => c.name && c.name.toLowerCase().includes(String(t).toLowerCase()));
    if (hit) return hit;
  }
  return cats[0];
}

async function createCourses(client, catalog, { categoryId, status, force }) {
  const cat = await resolveCategory(client, {
    categoryId,
    topics: catalog.brand.topics,
    kind: 'content',
  });
  if (!cat) {
    throw new Error(
      'No content category available. Create one in the runmoa dashboard, then pass ' +
        '--category-id <id> (the API cannot create categories).'
    );
  }
  log.ok(`강의 category → ${color.bold(cat.name)} (id ${cat.id})`);

  let existing = new Set();
  try {
    const list = await client.listServerContents({ limit: 100 });
    const items = Array.isArray(list) ? list : list?.contents || list?.data || list?.items || [];
    existing = new Set(items.map((c) => (c.title || '').trim()).filter(Boolean));
  } catch (e) {
    log.warn(`dedupe off: ${e.message}`);
  }

  const created = [];
  const failed = [];
  for (const course of catalog.courses) {
    const body = courseToContentPayload(course, { categoryIds: [cat.id], status });
    if (!force && existing.has(body.title.trim())) {
      log.info(`${color.dim('skip')} ${body.title}`);
      continue;
    }
    try {
      const res = await client.createContent(body);
      const id = res?.content_id ?? res?.id ?? res?.data?.content_id ?? '?';
      created.push({ id, title: body.title, kind: 'course' });
      log.ok(`강의 #${id}  ${body.title}`);
    } catch (e) {
      failed.push({ title: body.title, error: e.message });
      log.err(`${body.title} — ${e.message}`);
    }
  }
  return { created, failed };
}

async function createProducts(client, catalog, { productCategoryId, status, force }) {
  const cat = await resolveCategory(client, {
    categoryId: productCategoryId,
    topics: catalog.brand.topics,
    kind: 'product',
  });
  if (!cat) {
    log.warn('No product category available — skipping product creation.');
    return { created: [], failed: [] };
  }
  log.ok(`상품 category → ${color.bold(cat.name)} (id ${cat.id})`);
  const created = [];
  const failed = [];
  for (const product of catalog.products) {
    const body = productToProductPayload(product, {
      categoryId: cat.id,
      featuredImage: catalog.brand.banner || catalog.brand.logo, // synth products have no image
      status,
    });
    try {
      const res = await client.createProduct(body);
      const id = res?.product_id ?? res?.id ?? res?.data?.product_id ?? '?';
      created.push({ id, title: body.title, kind: 'product' });
      log.ok(`상품 #${id}  ${body.title}`);
    } catch (e) {
      failed.push({ title: body.title, error: e.message });
      log.err(`${body.title} — ${e.message}`);
    }
  }
  return { created, failed };
}

/**
 * @param {object} args input, client, dryRun, limitVideos, limitShorts,
 *   categoryId, productCategoryId, status, force, withProducts, emitWeb
 */
export async function ingest(args) {
  const {
    input,
    client = null,
    dryRun = true,
    limitVideos = 10,
    limitShorts = 12,
    categoryId = null,
    productCategoryId = null,
    status = 'pending',
    force = false,
    withProducts = false,
    emitWeb = true,
  } = args;

  // 1) analyze + insights + catalog
  const profile = await analyzeChannel(input, { limitVideos, limitShorts });
  const insights = deriveInsights(profile);
  const catalog = buildCatalog(profile, insights);
  log.ok(`Catalog: ${color.bold(catalog.courses.length + '개 강의')} · ${catalog.products.length}개 상품 · ${catalog.categories.course.length + catalog.categories.product.length}개 카테고리`);
  log.info(
    `예상 수강생 ${fmtCount(catalog.stats.students)}명 · 평균 ★${catalog.stats.avgRating} · 토픽 ${insights.topics.slice(0, 4).join(', ')}`
  );

  let created = [];
  let failed = [];
  if (!dryRun) {
    if (!client) throw new Error('Live ingest requires a configured RunmoaClient');
    const courseRes = await createCourses(client, catalog, { categoryId, status, force });
    created = created.concat(courseRes.created);
    failed = failed.concat(courseRes.failed);
    if (withProducts) {
      const prodRes = await createProducts(client, catalog, { productCategoryId, status, force });
      created = created.concat(prodRes.created);
      failed = failed.concat(prodRes.failed);
    }
  }

  // 2) emit platform data for the storefront
  let outFile = null;
  if (emitWeb) {
    const data = buildPlatformData(catalog, { mode: dryRun ? 'dry-run' : 'live', created });
    const json = JSON.stringify(data, null, 2);
    const slug = slugify(catalog.brand.name) || 'channel';
    const dataDir = path.join(ROOT_DIR, 'data');
    const jsDir = path.join(ROOT_DIR, 'web', 'js');
    fs.mkdirSync(dataDir, { recursive: true });
    fs.mkdirSync(jsDir, { recursive: true });
    fs.writeFileSync(path.join(dataDir, `${slug}.json`), json);
    // global → storefront works on file:// (double-click) AND via a server
    fs.writeFileSync(path.join(jsDir, 'data.js'), `window.__PLATFORM_DATA__ = ${json};\n`);
    outFile = path.join('web', 'index.html');
    log.ok(`Storefront → ${color.bold(outFile)}  (web/js/data.js, data/${slug}.json)`);
  }

  return { profile, insights, catalog, created, failed, outFile };
}
