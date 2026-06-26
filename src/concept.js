// Synthesizes the creator's BRAND CONCEPT from the combined analysis, so the
// generated site leads with what the creator is *about* — not "here is their
// YouTube channel". YouTube is just the data source; the concept is the star.
// Template-based (no LLM) but archetype- + topic-aware.

const ROLE = {
  insight: '인사이트 크리에이터',
  educator: '클래스 크리에이터',
  commerce: '큐레이터 · 셀러',
  relax: '힐링 크리에이터',
  coach: '코치 · 멘토',
  finance: '투자 · 머니 멘토',
  creator: '크리에이터',
};

// headline = the concept (protagonist). uses the top theme word.
function headlineFor(arche, t0, t1, name) {
  const t = t0 || '콘텐츠';
  const span = t1 ? `${t0}부터 ${t1}까지` : t;
  switch (arche) {
    case 'insight': return `${span}, 누구보다 빠르고 깊게.`;
    case 'educator': return `${t}, 처음부터 끝까지 제대로.`;
    case 'commerce': return `직접 써보고 고른 ${span}, 여기 다 있어요.`;
    case 'relax': return `${t}으로 채우는, 하루의 쉼.`;
    case 'coach': return `${t}, 혼자 말고 함께 바꿔요.`;
    case 'finance': return `${t}, 막연한 불안 대신 전략으로.`;
    default: return `${name}의 모든 것을, 한 곳에서.`;
  }
}

const PILLARS = {
  insight: [
    { i: '🧠', t: '깊이 있는 분석', d: '표면이 아니라 맥락까지 짚어드려요' },
    { i: '⚡', t: '가장 빠른 정리', d: '쏟아지는 소식, 핵심만 골라서' },
    { i: '🎯', t: '쉬운 설명', d: '어려운 주제도 이해되게' },
  ],
  educator: [
    { i: '🎬', t: '체계적 커리큘럼', d: '입문부터 실전까지 단계별로' },
    { i: '🛠️', t: '직접 만들며 배우기', d: '보는 강의 말고 하는 강의' },
    { i: '🧾', t: '평생 소장 · 수료증', d: '한 번 사면 계속, 인증까지' },
  ],
  commerce: [
    { i: '🔎', t: '엄선 큐레이션', d: '직접 검증한 것만 추천' },
    { i: '💸', t: '합리적인 가격', d: '거품 없이, 가치 있게' },
    { i: '🚚', t: '믿을 수 있는 배송', d: '주문부터 도착까지 안심' },
  ],
  relax: [
    { i: '🌙', t: '광고 없는 몰입', d: '끊김 없이 온전한 쉼' },
    { i: '🎧', t: '고품질 사운드', d: '더 깊은 몰입을 위한 음질' },
    { i: '♾️', t: '언제든 무제한', d: '필요할 때 언제나' },
  ],
  coach: [
    { i: '🤝', t: '1:1 맞춤', d: '나에게 맞춘 피드백' },
    { i: '📅', t: '꾸준한 루틴', d: '혼자서는 어려운 지속' },
    { i: '📈', t: '눈에 보이는 변화', d: '결과로 증명하는 코칭' },
  ],
  finance: [
    { i: '📊', t: '데이터 기반', d: '감이 아니라 근거로' },
    { i: '🛡️', t: '리스크 관리', d: '잃지 않는 것부터' },
    { i: '👥', t: '함께하는 커뮤니티', d: '같은 목표의 사람들' },
  ],
  creator: [
    { i: '✨', t: '하나의 브랜드', d: '흩어진 채널을 한 곳에' },
    { i: '🎬', t: '꾸준한 콘텐츠', d: '새 소식을 가장 먼저' },
    { i: '💛', t: '팬과 가까이', d: '직접 소통하고 응원받기' },
  ],
};

// Hand-authored DEEP concepts for known channels (proof of the target bar —
// what an LLM analysis should produce: real positioning, not keyword frequency).
const CURATED = [
  {
    match: ['슈카', 'syuka'],
    concept: {
      role: '대한민국 No.1 경제·시사 크리에이터',
      headline: '어려운 경제, 세상에서 제일 재미있게.',
      statement: '주식·부동산·세계 정세까지 — 복잡한 경제를 누구나 이해하고 즐길 수 있게 풀어드립니다.',
      themes: ['경제', '투자', '주식', '부동산', '시사', '세계정세', '금융'],
      pillars: [
        { i: '📊', t: '쉬운 경제', d: '전문 용어 없이, 누구나 이해되게' },
        { i: '🌍', t: '세계를 한눈에', d: '국내외 경제·정세를 빠르게 정리' },
        { i: '🎙️', t: '재미가 기본', d: '딱딱한 경제를 가장 재미있게' },
      ],
    },
  },
  {
    match: ['장프로', 'jangpro'],
    concept: {
      role: 'AI·로보틱스 인사이트 크리에이터',
      headline: '쏟아지는 AI 뉴스, 핵심만 가장 빠르게.',
      statement: 'AI·로봇·미래 기술의 흐름을 누구보다 빠르고 깊게 정리해 드립니다.',
      themes: ['AI', '로보틱스', '휴머노이드', '미래기술', '테크 트렌드', '특이점'],
      pillars: [
        { i: '🧠', t: '깊이 있는 분석', d: '표면이 아니라 맥락까지 짚어드려요' },
        { i: '⚡', t: '가장 빠른 정리', d: '쏟아지는 소식, 핵심만 골라서' },
        { i: '🎯', t: '쉬운 설명', d: '어려운 기술도 이해되게' },
      ],
    },
  },
  {
    match: ['marques', 'mkbhd', 'brownlee'],
    concept: {
      role: 'Tech Reviewer · 테크 큐레이터',
      headline: '최고의 테크, 타협 없이 리뷰합니다.',
      statement: '스마트폰·카메라·전자기기 — 직접 써보고 가장 솔직하게 리뷰하고 큐레이션합니다.',
      themes: ['스마트폰', '카메라', '가젯', '테크 리뷰', 'Apple', '전자기기'],
      pillars: [
        { i: '🔍', t: '솔직한 리뷰', d: '광고가 아니라 진짜 경험' },
        { i: '🎥', t: '최고의 화질', d: '제품을 가장 잘 보여주는 영상' },
        { i: '⭐', t: '엄선 큐레이션', d: '직접 검증한 것만 추천' },
      ],
    },
  },
];
function findCurated(brand) {
  const hay = `${brand.name || ''} ${brand.handle || ''}`.toLowerCase();
  const hit = CURATED.find((c) => c.match.some((m) => hay.includes(m)));
  return hit ? hit.concept : null;
}

/**
 * @param {object} brand  { name, tagline, about, topics }
 * @param {string} archetype  recommend() archetype key
 */
export function buildConcept(brand, archetype) {
  const arche = ROLE[archetype] ? archetype : 'creator';
  const curated = findCurated(brand);
  if (curated) return { ...curated, archetype: arche, curated: true };
  const topics = brand.topics || [];
  const t0 = topics[0] ? cap(topics[0]) : null;
  const t1 = topics[1] ? cap(topics[1]) : null;
  const role = `${t0 ? t0 + ' ' : ''}${ROLE[arche]}`;
  const statement =
    (brand.tagline && brand.tagline.length > 8 ? brand.tagline : '') ||
    `${topics.slice(0, 3).map(cap).join(' · ') || brand.name} 를 다루는 ${ROLE[arche]}, ${brand.name}.`;
  return {
    role,
    headline: headlineFor(arche, t0, t1, brand.name),
    statement,
    themes: topics.slice(0, 8).map(cap),
    pillars: PILLARS[arche],
    archetype: arche,
  };
}

function cap(s) { return String(s).charAt(0).toUpperCase() + String(s).slice(1); }
