// Turns a ChannelProfile + insights + a chosen blueprint into a COMMERCE
// catalog. Blueprint-driven: only the selected modules' data is generated.
//   modules: courses · digital · merch · membership · coaching · community
// Deterministic (no randomness) so re-runs are stable.
import { slugify } from './util.js';
import { buildConcept } from './concept.js';
import { pickTheme } from './themes.js';
import { designCourses } from './coursegen.js';

function hash(str = '') {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return Math.abs(h);
}
function priceFrom(seed, min, max) {
  const span = Math.max(1000, max - min);
  return Math.max(900, Math.round((min + (seed % span)) / 1000) * 1000 - 100);
}
function ratingFrom(seed) { return Number((4.5 + (seed % 45) / 100).toFixed(1)); }
function levelFrom(d) { return !d ? '입문' : d > 2400 ? '심화' : d > 900 ? '중급' : '입문'; }
const TIER_MULT = { low: 0.7, mid: 1, high: 1.8 };

function extractTags(item) {
  const out = []; const re = /#([\p{L}\p{N}_]+)/gu; let m;
  while ((m = re.exec(`${item.title} ${item.description || ''}`)) && out.length < 4) out.push(m[1]);
  return out;
}
function pickCat(v, topics, fallback) {
  const blob = `${v.title} ${v.description || ''}`.toLowerCase();
  const map = [
    { k: ['로봇', 'robot', '휴머노이드', '옵티머스', '아틀라스'], name: '로보틱스' },
    { k: ['일론', '머스크', 'musk', 'tesla', '테슬라'], name: '테크 트렌드' },
    { k: ['gpt', '클로드', 'claude', '제미나이', 'llm', '에이전트'], name: 'AI 활용' },
    { k: ['힐링', 'asmr', '멍', '수면', 'relax'], name: '힐링 · 라이프' },
  ];
  for (const c of map) if (c.k.some((w) => blob.includes(w))) return c.name;
  return fallback;
}

function videoToCourse(v, i, brand, cat, mult) {
  const seed = hash(v.id || v.title || String(i));
  const base = Math.round(priceFrom(seed + (v.duration || 0), 19900, 99000) * mult / 1000) * 1000 - 100;
  const onSale = seed % 3 !== 0;
  const sale = onSale ? Math.max(9900, Math.round((base * (55 + (seed % 25)) / 100) / 1000) * 1000 - 100) : null;
  const students = v.views != null ? Math.max(12, Math.round(v.views * (1.1 + (seed % 7) / 10))) : 50 + (seed % 400);
  return {
    id: `c_${v.id || i}`, kind: 'course', youtubeId: v.id, preview: v.id,
    title: v.title, slug: slugify(v.title) || `course-${i}`, thumbnail: v.thumbnail,
    instructor: brand.name, instructorAvatar: brand.logo, category: cat, level: levelFrom(v.duration),
    durationSec: v.duration || null, lessons: 6 + (seed % 18), rating: ratingFrom(seed),
    reviews: 8 + (seed % 220), students, bestseller: students > 300, isNew: i < 2,
    price: { base: Math.max(9900, base), sale, onSale: Boolean(sale), free: false },
    description: v.description || '', tags: extractTags(v),
  };
}

const PRODUCT_BP = [
  { suffix: '인사이트 전자책', cat: '전자책', kind: 'digital', icon: '📘', ship: false, min: 12900, max: 29000 },
  { suffix: 'AI 프롬프트 템플릿 팩', cat: '템플릿', kind: 'digital', icon: '🧩', ship: false, min: 9900, max: 24000 },
  { suffix: '트렌드 리포트 2026', cat: '리포트', kind: 'digital', icon: '📊', ship: false, min: 19900, max: 49000 },
  { suffix: '실전 워크북', cat: '전자책', kind: 'digital', icon: '📒', ship: false, min: 14900, max: 34000 },
  { suffix: '굿즈 스티커 팩', cat: '굿즈', kind: 'physical', icon: '🎁', ship: true, min: 8900, max: 18000 },
  { suffix: '브랜드 머그컵', cat: '굿즈', kind: 'physical', icon: '☕', ship: true, min: 16900, max: 26000 },
];
function buildProducts(brand, topics, kindFilter) {
  const words = (topics && topics.length ? topics : ['AI', '인사이트']).slice(0, 6);
  return PRODUCT_BP
    .filter((bp) => (kindFilter === 'digital' ? !bp.ship : kindFilter === 'physical' ? bp.ship : true))
    .map((bp, idx) => {
      const i = PRODUCT_BP.indexOf(bp);
      const theme = words[i % words.length];
      const title = `${theme} ${bp.suffix}`;
      const seed = hash(title);
      const base = priceFrom(seed, bp.min, bp.max);
      const onSale = seed % 2 === 0;
      const sale = onSale ? Math.max(4900, Math.round((base * 0.7) / 1000) * 1000 - 100) : null;
      return {
        id: `p_${i}`, kind: 'product', title, slug: slugify(title) || `product-${i}`,
        category: bp.cat, productType: bp.kind, icon: bp.icon, cover: i % 6,
        rating: ratingFrom(seed), reviews: 4 + (seed % 90), sold: 20 + (seed % 600),
        requiresShipping: bp.ship, price: { base, sale, onSale: Boolean(sale), free: false },
        badge: idx === 0 ? 'BEST' : idx === 2 ? 'HOT' : null,
        description: bp.ship
          ? `${brand.name}의 공식 ${bp.suffix}. 한정 수량으로 제작되었습니다.`
          : `${theme} 주제를 깊이 있게 정리한 ${bp.suffix} (PDF/디지털 다운로드).`,
        options: bp.ship ? [{ name: '수량', values: ['1개', '2개', '3개'] }] : [],
      };
    });
}

function buildMembership(brand, mult) {
  const m = (n) => Math.round((n * mult) / 100) * 100 - 100;
  return [
    { id: 'm_basic', name: '베이직', price: Math.max(2900, m(9900)), period: '월', popular: false,
      perks: ['멤버 전용 영상 공개', '커뮤니티 입장', '신규 강의 10% 할인'] },
    { id: 'm_pro', name: '프로', price: Math.max(4900, m(19900)), period: '월', popular: true,
      perks: ['베이직 혜택 전체', '전 강의 무제한 수강', '월간 심화 리포트', '라이브 Q&A 참여'] },
    { id: 'm_vip', name: 'VIP', price: Math.max(9900, m(49000)), period: '월', popular: false,
      perks: ['프로 혜택 전체', '1:1 코칭 월 1회', '신규 굿즈 무료 제공', '우선 문의 응대'] },
  ];
}

function buildCoaching(brand, topics, mult) {
  const t = (topics && topics[0]) || brand.name;
  const p = (n) => Math.round((n * mult) / 1000) * 1000 - 100;
  // fallback mix mirrors the Gemini path: 2 offline sessions + 2 live classes
  // (runmoa content_type offline/live — mapper picks by the `live` flag).
  return [
    { id: 'co_1', kind: 'coaching', live: false, title: `${t} 1:1 맞춤 코칭 (60분)`, mode: '1:1 오프라인', seats: 1,
      schedule: '매주 화·목 저녁', price: { base: Math.max(29900, p(120000)), sale: null, onSale: false, free: false },
      cover: 0, icon: '🎯', description: '직접 만나 진행하는 1:1 맞춤 코칭 세션입니다. 신청 후 일정을 조율합니다.' },
    { id: 'co_2', kind: 'coaching', live: false, title: `오프라인 워크숍 · ${t}`, mode: '오프라인 워크숍', seats: 20,
      schedule: '월 1회 · 서울', price: { base: Math.max(39900, p(90000)), sale: null, onSale: false, free: false },
      cover: 3, icon: '🏫', description: '현장에서 직접 만나는 하루 집중 워크숍입니다. 장소는 결제 후 안내됩니다.' },
    { id: 'lv_1', kind: 'coaching', live: true, title: `${t} 라이브 클래스 (90분)`, mode: '라이브 스트리밍', seats: 30,
      schedule: '격주 수요일 저녁 8시', price: { base: Math.max(19900, p(45000)), sale: Math.max(14900, p(33000)), onSale: true, free: false },
      cover: 4, icon: '🔴', description: '실시간 라이브로 진행하고 Q&A로 마무리하는 클래스입니다.' },
    { id: 'lv_2', kind: 'coaching', live: true, title: `${t} 라이브 Q&A 세션`, mode: '라이브 스트리밍', seats: 50,
      schedule: '월 1회 일요일 저녁', price: { base: Math.max(9900, p(25000)), sale: null, onSale: false, free: false },
      cover: 1, icon: '🔴', description: '궁금한 것을 실시간으로 묻고 답하는 라이브 Q&A입니다.' },
  ];
}

const ALL = ['courses', 'digital', 'merch', 'membership', 'coaching', 'community'];

/**
 * @param {object} profile
 * @param {object} insights
 * @param {object} [blueprint] from recommend(); blueprint.modules selects output
 */
export function buildCatalog(profile, insights, blueprint) {
  const ch = profile.channel || {};
  const topics = insights?.topics || [];
  const modules = (blueprint && blueprint.modules) || ALL;
  const mult = TIER_MULT[(blueprint && blueprint.priceTier) || 'mid'] || 1;
  const has = (m) => modules.includes(m);

  const brand = {
    name: ch.name || 'Creator', handle: ch.handle || null,
    tagline: insights?.tagline || (ch.description || '').split('\n')[0] || '',
    about: ch.description || '', logo: ch.avatar || null, banner: ch.banner || null,
    youtube: ch.url || null, subscribers: ch.subscribers ?? null, topics,
  };

  // concept first — it drives both the copy AND the AI-designed courses
  const concept = buildConcept(brand, blueprint && blueprint.key);
  const videoThumbs = (profile.videos || []).map((v) => v.thumbnail).filter(Boolean);
  const courses = has('courses')
    ? designCourses(concept, blueprint && blueprint.key, brand.name, videoThumbs)
    : [];

  // prefer the cleaned concept themes (Korean, curated) over raw english topics
  const themeWords = (concept.themes && concept.themes.length) ? concept.themes : topics;
  let products = [];
  if (has('digital')) products = products.concat(buildProducts(brand, themeWords, 'digital'));
  if (has('merch')) products = products.concat(buildProducts(brand, themeWords, 'physical'));

  const membership = has('membership') ? buildMembership(brand, mult) : [];
  const coaching = has('coaching') ? buildCoaching(brand, themeWords, mult) : [];
  const community = has('community')
    ? { board: '멤버 라운지', desc: `${brand.name} 멤버들이 질문하고 인사이트를 나누는 공간입니다.` }
    : null;

  const categories = {
    course: [...new Set(courses.map((c) => c.category))],
    product: [...new Set(products.map((p) => p.category))],
  };

  const totalStudents = courses.reduce((s, c) => s + (c.students || 0), 0) || (brand.subscribers || 0);
  const avgRating = courses.length
    ? Number((courses.reduce((s, c) => s + c.rating, 0) / courses.length).toFixed(2)) : 4.8;

  return {
    brand,
    theme: pickTheme(blueprint && blueprint.key),
    concept,
    blueprint: blueprint ? { key: blueprint.key, title: blueprint.title, emoji: blueprint.emoji, primary: blueprint.primary, modules, theme: blueprint.theme } : null,
    modules,
    courses, products, membership, coaching, community, categories,
    stats: {
      courseCount: courses.length, productCount: products.length,
      membershipCount: membership.length, coachingCount: coaching.length,
      students: totalStudents, avgRating, satisfaction: 98,
    },
    insights,
  };
}

function cap(s) { return String(s).charAt(0).toUpperCase() + String(s).slice(1); }
