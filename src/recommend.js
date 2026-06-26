// Recommendation engine — the "brain". Given a channel analysis, classify the
// creator archetype and pick the OPTIMAL monetization solution (a blueprint of
// runmoa-backed modules) plus alternatives and human-readable reasons.

// modules available, each maps to a concrete runmoa capability
export const MODULES = {
  courses:    { key: 'courses',    label: '온라인 강의',   icon: '🎬', runmoa: 'contents · vod',           desc: '영상을 가격이 매겨진 강의로 판매' },
  membership: { key: 'membership', label: '멤버십 구독',   icon: '💎', runmoa: 'membership · subscription', desc: '월 구독으로 프리미엄 콘텐츠 제공' },
  digital:    { key: 'digital',    label: '디지털 상품',   icon: '📦', runmoa: 'products · digital',         desc: '전자책·템플릿·리포트 다운로드 판매' },
  merch:      { key: 'merch',      label: '굿즈 · 머치',   icon: '🎁', runmoa: 'products · shipping',        desc: '실물 굿즈를 배송 판매' },
  coaching:   { key: 'coaching',   label: '코칭 · 클래스', icon: '🗓️', runmoa: 'contents · offline',        desc: '1:1·그룹 세션을 일정 예약으로 판매' },
  community:  { key: 'community',  label: '커뮤니티',      icon: '💬', runmoa: 'boards · posts',             desc: '멤버 전용 게시판·소통 공간' },
};

// archetype → optimal solution blueprint
const BLUEPRINTS = {
  educator: {
    key: 'educator', title: '온라인 클래스 스토어', emoji: '🎓',
    pitch: '튜토리얼·강좌형 콘텐츠를 체계적인 유료 강의로 전환하는 데 최적입니다.',
    primary: 'courses', modules: ['courses', 'digital', 'community'],
    theme: 'violet', priceTier: 'mid',
  },
  insight: {
    key: 'insight', title: '프리미엄 인사이트 멤버십', emoji: '🧠',
    pitch: '분석·인사이트 채널은 월 구독 멤버십과 심화 강의·리포트 조합이 수익이 가장 안정적입니다.',
    primary: 'membership', modules: ['membership', 'courses', 'digital'],
    theme: 'indigo', priceTier: 'mid',
  },
  commerce: {
    key: 'commerce', title: '크리에이터 커머스 샵', emoji: '🛍️',
    pitch: '리뷰·추천 콘텐츠는 큐레이션 상품 판매로 바로 매출이 납니다.',
    primary: 'merch', modules: ['merch', 'digital', 'courses'],
    theme: 'rose', priceTier: 'low',
  },
  relax: {
    key: 'relax', title: '프리미엄 구독 (광고 없는 콘텐츠)', emoji: '🌙',
    pitch: 'ASMR·힐링·음악 채널은 광고 없는 고음질·롱폼을 월 구독으로 제공하는 모델이 적합합니다.',
    primary: 'membership', modules: ['membership', 'digital'],
    theme: 'teal', priceTier: 'low',
  },
  coach: {
    key: 'coach', title: '코칭 & 클래스 예약', emoji: '🏋️',
    pitch: '코칭·피트니스·컨설팅 채널은 1:1/그룹 세션 예약과 식단·루틴 자료 판매가 핵심입니다.',
    primary: 'coaching', modules: ['coaching', 'courses', 'digital'],
    theme: 'amber', priceTier: 'high',
  },
  finance: {
    key: 'finance', title: '고가 강의 + 투자 커뮤니티', emoji: '📈',
    pitch: '재테크·투자 채널은 고가 강의와 멤버 전용 커뮤니티로 객단가를 높이는 전략이 효과적입니다.',
    primary: 'courses', modules: ['courses', 'membership', 'community'],
    theme: 'emerald', priceTier: 'high',
  },
  creator: {
    key: 'creator', title: '크리에이터 올인원 스토어', emoji: '⚡',
    pitch: '다양한 콘텐츠를 가진 채널에 맞춘 강의·상품·멤버십 통합 스토어입니다.',
    primary: 'courses', modules: ['courses', 'digital', 'merch', 'membership'],
    theme: 'violet', priceTier: 'mid',
  },
};

const SIGNAL_WORDS = {
  educator: ['강의', '강좌', '튜토리얼', '클래스', '배우', '가이드', '방법', '강의록', '기초', '입문', '마스터', 'tutorial', 'course', 'lesson', 'how to', 'howto', '하는법', '정리', '설명', '꿀팁'],
  insight:  ['인사이트', '분석', '트렌드', '뉴스', '속보', '전망', '브리핑', '요약', '정리', '리뷰', 'insight', 'news', 'trend', 'analysis', '미쳤', '경고', '핵심'],
  commerce: ['추천', '언박싱', '제품', '구매', '할인', '쇼핑', '템플릿', '굿즈', '리뷰', 'unboxing', 'haul', 'review', '비교', 'best', '템플', '직구'],
  relax:    ['asmr', '힐링', '수면', '멍때', '백색소음', '브금', 'relax', 'relaxing', 'sleep', 'ambient', 'lofi', '명상', '브라운노이즈', 'meditation', 'calm', 'rain', 'spa'],
  coach:    ['코칭', '컨설팅', '상담', '1:1', '피티', '운동', '식단', '루틴', '챌린지', 'coaching', 'workout', 'fitness', 'diet', '다이어트', '홈트'],
  finance:  ['주식', '투자', '부동산', '재테크', '코인', '비트코인', '수익', '경제', '배당', 'invest', 'stock', 'crypto', '돈', '월급', '파이어'],
};

function computeSignals(profile, insights) {
  const videos = profile.videos || [];
  const shorts = profile.shorts || [];
  const items = [...videos, ...shorts];
  const total = items.length || 1;
  const shortsRatio = shorts.length / total;
  const durs = videos.map((v) => v.duration).filter((n) => n != null);
  const avgDurMin = durs.length ? Math.round(durs.reduce((a, b) => a + b, 0) / durs.length / 60) : null;
  const subs = profile.channel?.subscribers ?? null;

  // Document-frequency scoring: each ITEM contributes at most once per archetype
  // (presence, not term frequency) so one hashtag-stuffed video can't dominate.
  // Channel about/tagline and derived topics are strong, weighted signals.
  const aboutBlob = `${profile.channel?.about || profile.channel?.description || ''} ${insights?.tagline || ''}`.toLowerCase();
  const topicBlob = (insights?.topics || []).join(' ').toLowerCase();
  const itemsLC = items.map((i) => ({
    title: (i.title || '').toLowerCase(),
    body: (i.description || '').slice(0, 300).toLowerCase(),
  }));
  const scores = {};
  for (const [arche, words] of Object.entries(SIGNAL_WORDS)) {
    let docFreq = 0, titleFreq = 0;
    for (const it of itemsLC) {
      const inTitle = words.some((w) => it.title.includes(w));
      const inBody = inTitle || words.some((w) => it.body.includes(w));
      if (inBody) docFreq++;
      if (inTitle) titleFreq++;
    }
    const aboutHits = words.filter((w) => aboutBlob.includes(w)).length;
    const topicHits = words.filter((w) => topicBlob.includes(w)).length;
    scores[arche] = titleFreq * 3 + docFreq * 2 + aboutHits * 6 + topicHits * 4;
  }
  return { shortsRatio, avgDurMin, subs, videoCount: videos.length, shortsCount: shorts.length, scores };
}

function reasonsFor(arche, sig) {
  const r = [];
  const top = Object.entries(sig.scores).sort((a, b) => b[1] - a[1]);
  const winner = top[0];
  if (winner && winner[1] > 0) r.push(`콘텐츠 키워드 분석 결과 '${labelOf(winner[0])}' 신호가 가장 강함 (점수 ${winner[1]})`);
  if (sig.shortsRatio >= 0.6) r.push(`쇼츠 비중 ${Math.round(sig.shortsRatio * 100)}% — 짧은 훅 콘텐츠 중심`);
  else if (sig.shortsRatio <= 0.25 && sig.avgDurMin) r.push(`롱폼 중심 (평균 ${sig.avgDurMin}분) — 강의화에 적합`);
  if (sig.avgDurMin && sig.avgDurMin >= 20) r.push(`긴 영상(평균 ${sig.avgDurMin}분)은 유료 강의 전환률이 높음`);
  if (sig.subs != null) {
    if (sig.subs < 5000) r.push(`구독자 ${sig.subs.toLocaleString()}명 — 입문~중간 가격대 + 멤버십으로 충성 팬 수익화 권장`);
    else if (sig.subs < 100000) r.push(`구독자 ${sig.subs.toLocaleString()}명 — 강의·멤버십 객단가 확대 여력 있음`);
    else r.push(`구독자 ${sig.subs.toLocaleString()}명 — 고가 강의·대규모 멤버십 가능`);
  }
  return r;
}
function labelOf(k) {
  return { educator: '교육·강의', insight: '인사이트·분석', commerce: '리뷰·커머스', relax: '힐링·음악', coach: '코칭·피트니스', finance: '재테크·투자' }[k] || k;
}

/**
 * @returns {{ archetype, blueprint, alternatives, signals, reasons }}
 */
export function recommend(profile, insights) {
  const sig = computeSignals(profile, insights);
  const ranked = Object.entries(sig.scores).sort((a, b) => b[1] - a[1]);
  let arche = ranked[0] && ranked[0][1] > 0 ? ranked[0][0] : 'creator';

  // content-shape overrides
  if (sig.scores.relax >= 4 && sig.scores.relax >= (ranked[0] ? ranked[0][1] : 0) * 0.8) arche = 'relax';

  const blueprint = { ...BLUEPRINTS[arche], reasons: reasonsFor(arche, sig) };
  // 2 alternatives: next best distinct archetypes (+ always offer creator all-in-one)
  const altKeys = ranked.map((r) => r[0]).filter((k) => k !== arche).slice(0, 2);
  if (!altKeys.includes('creator') && arche !== 'creator') altKeys.push('creator');
  const alternatives = [...new Set(altKeys)].slice(0, 3).map((k) => BLUEPRINTS[k]).filter(Boolean);

  return {
    archetype: arche,
    archetypeLabel: labelOf(arche),
    blueprint,
    alternatives,
    signals: sig,
    modulesMeta: MODULES,
  };
}

export { BLUEPRINTS };
