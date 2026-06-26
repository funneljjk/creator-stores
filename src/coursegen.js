// AI course DESIGNER. Instead of mirroring YouTube videos, this analyzes the
// creator's expertise (archetype + concept themes) and DESIGNS courses the
// creator should make & sell — title, curriculum, outcomes, level, price.
// (Template-driven now; an LLM can replace designCourses() to generate fully.)

function hash(s = '') { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return Math.abs(h); }
function won900(n) { return Math.max(9900, Math.round(n / 1000) * 1000 - 100); }
function ratingFrom(seed) { return Number((4.6 + (seed % 39) / 100).toFixed(1)); }

// course "specs" per archetype. {t} fills with a concept theme. Fixed titles
// where a known concept exists (finance = 슈카).
const PLANS = {
  finance: [
    { title: '왕초보 주식 투자 첫걸음', cat: '주식', lv: '입문', n: 8, p: 39000, icon: '📈' },
    { title: '경제 뉴스, 200% 읽는 법', cat: '경제', lv: '입문', n: 6, p: 29000, icon: '📰' },
    { title: '부동산 첫 투자 전략', cat: '부동산', lv: '중급', n: 10, p: 59000, icon: '🏠' },
    { title: '세계 경제 흐름 마스터', cat: '시사', lv: '중급', n: 8, p: 49000, icon: '🌍' },
    { title: '나만의 자산 포트폴리오 설계', cat: '투자', lv: '심화', n: 12, p: 89000, icon: '💰' },
  ],
  insight: [
    { title: '{t} 트렌드, 한 번에 정리', cat: '트렌드', lv: '입문', n: 6, p: 33000, icon: '🧠' },
    { title: 'AI 시대 생존 전략', cat: 'AI 활용', lv: '입문', n: 8, p: 39000, icon: '🤖' },
    { title: '{t} 실전 활용 워크숍', cat: '실전', lv: '중급', n: 10, p: 55000, icon: '⚙️' },
    { title: '미래 기술 읽는 눈 기르기', cat: '인사이트', lv: '중급', n: 8, p: 49000, icon: '🔭' },
  ],
  educator: [
    { title: '{t} 완전 정복 (기초부터)', cat: '기초', lv: '입문', n: 12, p: 49000, icon: '🎓' },
    { title: '실전 {t} 프로젝트', cat: '실전', lv: '중급', n: 10, p: 69000, icon: '🛠️' },
    { title: '{t} 포트폴리오 만들기', cat: '포트폴리오', lv: '중급', n: 8, p: 59000, icon: '📁' },
    { title: '현업 {t} 심화 마스터', cat: '심화', lv: '심화', n: 14, p: 99000, icon: '🚀' },
  ],
  commerce: [
    { title: '{t} 구매 완벽 가이드', cat: '가이드', lv: '입문', n: 5, p: 19000, icon: '🛍️' },
    { title: '{t} 200% 활용법', cat: '활용', lv: '입문', n: 6, p: 29000, icon: '✨' },
    { title: '실패 없는 {t} 셋업', cat: '셋업', lv: '중급', n: 8, p: 39000, icon: '🧩' },
  ],
  relax: [
    { title: '나만의 힐링 루틴 만들기', cat: '루틴', lv: '입문', n: 6, p: 25000, icon: '🌙' },
    { title: '깊은 수면을 위한 사운드 디자인', cat: '사운드', lv: '입문', n: 5, p: 22000, icon: '🎧' },
    { title: '마음챙김 명상 4주 클래스', cat: '명상', lv: '중급', n: 8, p: 39000, icon: '🧘' },
  ],
  coach: [
    { title: '4주 {t} 챌린지', cat: '챌린지', lv: '입문', n: 12, p: 49000, icon: '🔥' },
    { title: '{t} 홈트레이닝 완성', cat: '홈트', lv: '입문', n: 10, p: 39000, icon: '🏋️' },
    { title: '맞춤 {t} 식단·루틴 설계', cat: '루틴', lv: '중급', n: 8, p: 59000, icon: '🥗' },
  ],
  creator: [
    { title: '{t} 시작하기 (입문 클래스)', cat: '입문', lv: '입문', n: 8, p: 39000, icon: '✨' },
    { title: '{t} 한 단계 더, 실전편', cat: '실전', lv: '중급', n: 10, p: 55000, icon: '🚀' },
    { title: '나만의 {t} 만들기', cat: '제작', lv: '중급', n: 8, p: 49000, icon: '🎨' },
  ],
};

const CHAPTERS = ['오리엔테이션 · 큰 그림 잡기', '핵심 개념 한 번에', '직접 따라하는 실습', '자주 하는 실수와 해결', '한 단계 더 깊이', '실전 케이스 스터디', '나만의 결과물 완성', '다음 단계 로드맵'];
// distinct 1-line hooks so course cards don't read identically (varies by index)
const TAGLINES = [
  '입문자도 끝까지 따라오는 단계별 커리큘럼',
  '영상엔 없던 디테일까지, 실전 중심으로',
  '따라 하다 보면 완성되는 결과물 중심 과정',
  '기초부터 현업 노하우까지 한 번에',
  '핵심만 빠르게, 바로 써먹는 실전반',
];

function designOne(spec, i, theme, brand) {
  const title = spec.title.replace('{t}', theme || '핵심');
  const seed = hash(title + brand);
  const base = won900(spec.p);
  const onSale = seed % 3 !== 0;
  const sale = onSale ? won900(base * (60 + (seed % 20)) / 100) : null;
  const lessons = spec.n;
  const lvDur = spec.lv === '심화' ? 18 : spec.lv === '중급' ? 14 : 10; // min/lesson
  const curriculum = [];
  for (let k = 0; k < lessons; k++) {
    curriculum.push({ t: (k + 1) + '강 · ' + CHAPTERS[k % CHAPTERS.length], d: (lvDur - 2 + (k % 3) * 3) + '분' });
  }
  const outcomes = [
    `${spec.cat}의 핵심 원리를 이해하고 바로 적용합니다`,
    `${brand} 만의 노하우와 실전 팁을 배웁니다`,
    `직접 따라하며 나만의 결과물을 완성합니다`,
    `현업에서 바로 쓰는 실력을 갖춥니다`,
  ];
  return {
    id: 'c_' + i,
    kind: 'course',
    designed: true,
    title,
    subtitle: `${brand}이 직접 설계한 ${spec.lv} 과정`,
    tagline: TAGLINES[i % TAGLINES.length],
    category: spec.cat,
    level: spec.lv,
    lessons,
    durationSec: lessons * lvDur * 60,
    icon: spec.icon,
    cover: i % 6,
    instructor: brand,
    rating: ratingFrom(seed),
    reviews: 12 + (seed % 240),
    students: 80 + (seed % 1800),
    bestseller: i === 0,
    isNew: i >= (PLANS_LEN[spec._a] || 3) - 1,
    price: { base, sale, onSale: Boolean(sale), free: false },
    outcomes,
    curriculum,
    description: `${title} — ${brand}의 전문성을 체계적인 커리큘럼으로 담은 강의입니다. 영상으로만 보던 내용을 단계별 과정으로 깊이 있게 배워보세요.`,
  };
}
const PLANS_LEN = Object.fromEntries(Object.entries(PLANS).map(([k, v]) => [k, v.length]));

/**
 * Design courses for a creator.
 * @param {object} concept  buildConcept() output (themes, role)
 * @param {string} archetype
 * @param {string} brandName
 * @param {string[]} [videoThumbs]  optional channel thumbnails to use as course imagery
 */
export function designCourses(concept, archetype, brandName, videoThumbs = []) {
  const arche = PLANS[archetype] ? archetype : 'creator';
  const themes = (concept && concept.themes) || [];
  return PLANS[arche].map((spec, i) => {
    const theme = themes[i % Math.max(1, themes.length)] || '';
    const c = designOne({ ...spec, _a: arche }, i, theme, brandName);
    // use a real channel thumbnail as cover imagery when available (visual), but
    // the course itself stays an AI-designed offering (no video link/embed)
    if (videoThumbs[i]) c.thumbnail = videoThumbs[i];
    return c;
  });
}
