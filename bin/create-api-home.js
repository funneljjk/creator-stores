#!/usr/bin/env node
// create-api-home — analyze a YouTube/influencer channel and build a CREATOR
// COMMERCE storefront (강의 + 일반상품 + 결제) on the runmoa platform.
//
// Usage:
//   create-api-home <youtube-url|@handle> [options]
import { config, canWrite } from '../src/config.js';
import { RunmoaClient } from '../src/runmoa.js';
import { ingest } from '../src/ingest.js';
import { courseToContentPayload, productToProductPayload } from '../src/mapper.js';
import { log, color, fmtCount } from '../src/util.js';

function won(n) {
  return n == null ? '—' : '₩' + Number(n).toLocaleString('ko-KR');
}

function parseArgs(argv) {
  const args = { _: [] };
  const want = new Set([
    '--limit-videos', '--limit-shorts', '--category-id', '--product-category-id', '--status',
  ]);
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (want.has(a)) args[a.slice(2)] = argv[++i];
    else if (a === '-h' || a === '--help') args.help = true;
    else if (a === '--dry-run') args.dryRun = true;
    else if (a === '--live') args.live = true;
    else if (a === '--with-products') args.withProducts = true;
    else if (a === '--force') args.force = true;
    else if (a === '--no-web') args.noWeb = true;
    else if (a === '--show-payloads') args.showPayloads = true;
    else if (a.startsWith('--')) log.warn(`unknown option ${a}`);
    else args._.push(a);
  }
  return args;
}

const HELP = `${color.bold('create-api-home')} — YouTube/인플루언서 채널 → 크리에이터 커머스 스토어

${color.bold('Usage')}
  create-api-home <youtube-url|@handle> [options]

${color.bold('Options')}
  --dry-run               분석 + 카탈로그 + 스토어 데이터만 (쓰기 API 미호출)
  --live                  라이브 (RUNMOA_SITE_HOST + RUNMOA_SERVER_KEY 필요)
  --with-products         일반상품도 runmoa products로 생성 (라이브)
  --limit-videos <n>      강의로 만들 영상 수 (기본 10)
  --limit-shorts <n>      가져올 쇼츠 수 (기본 12)
  --category-id <id>      강의(content) 카테고리 id
  --product-category-id <id>  상품(product) 카테고리 id
  --status <s>            pending | publish (기본 'pending')
  --force                 동일 제목이어도 생성
  --no-web                web 스토어 데이터 미생성
  --show-payloads         생성될 JSON 페이로드 출력
  -h, --help

${color.bold('Examples')}
  create-api-home @jangproai --dry-run --show-payloads
  create-api-home @jangproai --live --with-products --status publish
`;

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || args._.length === 0) {
    console.log(HELP);
    process.exit(args.help ? 0 : 1);
  }
  const input = args._[0];
  const wantLive = args.live || (!args.dryRun && canWrite());
  const dryRun = !wantLive;
  if (args.live && !canWrite()) {
    log.err('--live requires RUNMOA_SITE_HOST and RUNMOA_SERVER_KEY (see .env.example).');
    process.exit(1);
  }

  let client = null;
  if (wantLive) {
    client = new RunmoaClient({
      siteHost: config.siteHost,
      storefrontKey: config.storefrontKey,
      serverKey: config.serverKey,
    });
  }
  console.log(color.dim(`mode: ${dryRun ? color.yellow('dry-run') : color.green('LIVE → ' + config.siteHost)}`));

  const status = args.status || config.contentStatus || 'pending';
  const result = await ingest({
    input,
    client,
    dryRun,
    limitVideos: Number(args['limit-videos'] || 10),
    limitShorts: Number(args['limit-shorts'] || 12),
    categoryId: args['category-id'] ? Number(args['category-id']) : config.categoryId,
    productCategoryId: args['product-category-id'] ? Number(args['product-category-id']) : null,
    status,
    force: Boolean(args.force),
    withProducts: Boolean(args.withProducts),
    emitWeb: !args.noWeb,
  });

  const { catalog } = result;

  // Dry-run: show the exact payloads that WOULD be POSTed.
  if (dryRun) {
    console.log('');
    log.step(`${catalog.courses.length} 강의 → POST /api/public/v1/contents`);
    for (const co of catalog.courses) {
      const p = co.price;
      console.log(`  ${color.cyan('강의')} ${won(p.sale ?? p.base)}${p.onSale ? color.dim(' (' + won(p.base) + ')') : ''}  ${co.title}`);
    }
    log.step(`${catalog.products.length} 상품 → POST /api/public/v1/products`);
    for (const pr of catalog.products) {
      const p = pr.price;
      console.log(`  ${color.cyan('상품')} ${won(p.sale ?? p.base)}${p.onSale ? color.dim(' (' + won(p.base) + ')') : ''}  ${pr.title}`);
    }
    if (args.showPayloads) {
      const catId = args['category-id'] ? Number(args['category-id']) : config.categoryId || 0;
      console.log(color.dim('\n── sample 강의 payload ──'));
      console.log(JSON.stringify(courseToContentPayload(catalog.courses[0], { categoryIds: [catId], status }), null, 2));
      console.log(color.dim('── sample 상품 payload ──'));
      console.log(JSON.stringify(productToProductPayload(catalog.products[0], { categoryId: catId, status }), null, 2));
    } else {
      log.info('--show-payloads 로 전체 JSON 확인');
    }
  }

  // Revenue-oriented summary
  const potential = catalog.courses.reduce((s, c) => s + (c.price.sale ?? c.price.base) * Math.min(c.students, 50), 0);
  console.log('');
  log.step(color.bold('Summary'));
  console.log(`  브랜드     : ${catalog.brand.name} (구독자 ${fmtCount(catalog.brand.subscribers) ?? '?'})`);
  console.log(`  카탈로그   : ${color.bold(catalog.courses.length + '개 강의')} · ${catalog.products.length}개 상품`);
  console.log(`  지표       : 수강생 ${fmtCount(catalog.stats.students)} · 평균 ★${catalog.stats.avgRating}`);
  console.log(`  예상매출   : ${color.green(won(potential))} ${color.dim('(강의 판매 가정치)')}`);
  if (dryRun) console.log(`  ${color.yellow('dry-run')}    : 미생성 (키 + --live 로 실제 등록)`);
  else console.log(`  created    : ${color.green(result.created.length)}  failed: ${color.red(result.failed.length)}`);
  if (result.outFile) console.log(`  스토어     : ${result.outFile}  ${color.dim('→ npm run serve')}`);
}

main().catch((e) => {
  log.err(e.message);
  if (process.env.DEBUG) console.error(e);
  process.exit(1);
});
