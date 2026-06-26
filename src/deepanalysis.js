// Deep channel report — the detailed analysis shown on the builder result page.
// Pure rule-based (no LLM, no deps): every claim is grounded in real extracted
// data (view counts, title patterns, durations, engagement ratios, keywords,
// archetype). Produces 4 sections: 기본 분석 / 콘텐츠 패턴 / 수익화 / 런모아 연결.

// ── archetype copy templates (filled with real numbers/keywords at runtime) ──
const ARCHE = {
  educator: {
    label: '교육·강의',
    audience: '특정 기술·주제를 “제대로 배우고 싶은” 입문~중급 학습자. 검색으로 유입되는 실용 지향 시청자가 많습니다.',
    problem: '무료 영상은 흩어져 있어 “순서대로, 끝까지” 배우기 어렵습니다. 독학으로는 체계와 피드백이 부족합니다.',
    expert: '복잡한 걸 쉽게 풀어주는 친절한 선생 / 실무 전문가 포지션.',
    thumb: '큰 텍스트로 “방법·정리·총정리”를 강조하고, 결과물이나 비포·애프터를 노출하는 스타일이 잘 먹힙니다.',
    current: ['유튜브 광고(애드센스)', '간헐적 강의·클래스 홍보', '협찬·PPL'],
  },
  insight: {
    label: '인사이트·분석',
    audience: '정보 과부하 속에서 “핵심만 빠르게” 알고 싶은 의사결정자·얼리어답터.',
    problem: '정보는 넘치는데 무엇이 중요한지 판단이 어렵습니다. 신뢰할 수 있는 큐레이터가 필요합니다.',
    expert: '흐름을 먼저 읽고 정리해 주는 애널리스트 / 인사이더 포지션.',
    thumb: '단정형 카피(“이게 핵심”, “지금 벌어지는 일”)와 인물+키워드 오버레이가 특징입니다.',
    current: ['유튜브 광고(애드센스)', '협찬·PPL', '뉴스레터(가능성)'],
  },
  commerce: {
    label: '리뷰·커머스',
    audience: '구매 직전 “뭘 살지” 고민하며 비교·검색하는 소비자.',
    problem: '선택지가 너무 많고, 광고성 후기 사이에서 진짜 추천을 찾기 어렵습니다.',
    expert: '직접 써보고 솔직하게 말하는 믿을 만한 큐레이터 포지션.',
    thumb: '제품 클로즈업 + 가격·비교·추천 텍스트, “BEST·직구·할인” 강조형.',
    current: ['제휴 마케팅(쿠팡파트너스 등 어필리에이트)', '브랜드 협찬·PPL', '유튜브 광고'],
  },
  relax: {
    label: '힐링·음악',
    audience: '집중·수면·휴식을 위해 배경으로 콘텐츠를 트는 장시간 시청자.',
    problem: '광고로 흐름이 끊기고, 고음질·롱폼을 원하지만 무료로는 한계가 있습니다.',
    expert: '분위기를 만드는 크리에이터 / 아티스트 포지션.',
    thumb: '무드 이미지 중심, 미니멀한 텍스트.',
    current: ['유튜브 광고(롱폼 미드롤)', '음원·BGM 판매(가능성)'],
  },
  coach: {
    label: '코칭·피트니스',
    audience: '몸·습관·성과 같은 “결과”를 내고 싶지만 혼자선 지속이 어려운 실행 지향층.',
    problem: '동기·피드백·맞춤 루틴이 없어 작심삼일로 끝납니다.',
    expert: '끌어주고 책임져 주는 코치 / 트레이너 포지션.',
    thumb: '비포·애프터, 실행 장면 + 도전형 카피.',
    current: ['1:1 코칭(외부 결제·DM)', '협찬', '유튜브 광고'],
  },
  finance: {
    label: '재테크·투자',
    audience: '자산을 불리고 싶은 직장인·투자 입문~중급자.',
    problem: '정보 비대칭과 손실 공포, 검증 안 된 정보로 인한 불안이 큽니다.',
    expert: '검증된 트랙레코드를 가진 실전 투자자 / 전문가 포지션.',
    thumb: '숫자·수익률·경고형 카피로 즉시 클릭을 유도.',
    current: ['유료 강의·클래스', '제휴(증권사 등)', '협찬', '유튜브 광고'],
  },
  creator: {
    label: '종합 크리에이터',
    audience: '채널을 좋아하는 팬 전반 — 관심사가 다양합니다.',
    problem: '흩어진 콘텐츠를 한곳에서 깊이 있게 누리고 싶어 합니다.',
    expert: '여러 주제를 다루는 멀티 크리에이터 포지션.',
    thumb: '채널 톤을 일관되게 유지하는 브랜딩형.',
    current: ['유튜브 광고(애드센스)', '협찬·PPL'],
  },
};

const num = (n) => (n == null ? null : Number(n));
const pct = (x) => (x == null ? '—' : (x * 100).toFixed(1) + '%');
const won = (n) => '₩' + Number(n || 0).toLocaleString('ko-KR');
const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);
const median = (a) => {
  if (!a.length) return null;
  const s = [...a].sort((x, y) => x - y);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

function titlePatterns(titles) {
  const j = titles.join('  ');
  const out = [];
  if (titles.some((t) => /\d/.test(t))) out.push('숫자 활용 ("N가지·N분")');
  if (titles.some((t) => /[\[\]【】]/.test(t))) out.push('대괄호 태그 ("[리뷰]·[속보]")');
  if (titles.some((t) => /[?？]/.test(t))) out.push('질문형 후킹');
  if (/방법|하는\s?법|how\s?to/i.test(j)) out.push('"방법·하는법" 실용형');
  if (/총정리|정리|핵심|요약/.test(j)) out.push('"정리·핵심" 요약형');
  if (/best|top\s?\d|추천|순위|비교/i.test(j)) out.push('"추천·BEST" 큐레이션형');
  if (/미쳤|충격|경고|역대급|레전드|드디어|결국/.test(j)) out.push('강한 감정 카피');
  return out.length ? out : ['간결한 직접 서술형'];
}

// scan all descriptions + channel about for monetization signals already in use
function detectChannelSignals(profile) {
  const blob = [
    profile.channel?.description || '',
    ...(profile.videos || []).map((v) => v.description || ''),
  ].join('\n').toLowerCase();
  return {
    links: /https?:\/\/|\.com|\.kr|smartstore|linktr|bit\.ly/.test(blob),
    sponsor: /협찬|sponsor|광고\s?포함|유료\s?광고|ad\b|ppl|제공받/.test(blob),
    membership: /멤버십|membership|patreon|후원|가입/.test(blob),
    course: /강의|클래스|class|course|수강|클래스101|인프런|udemy/.test(blob),
    affiliate: /쿠팡|파트너스|어필리|제휴|partners|affiliate|구매\s?링크/.test(blob),
    ebook: /전자책|ebook|pdf|템플릿|자료|노션/.test(blob),
    shop: /스토어|스마트스토어|구매|판매|상품|굿즈|store|shop/.test(blob),
  };
}

/**
 * @returns the full report object consumed by builder.js
 */
export function buildReport(profile, insights, rec) {
  const arche = rec.archetype || 'creator';
  const tpl = ARCHE[arche] || ARCHE.creator;
  const name = profile.channel?.name || '이 채널';
  const subs = num(profile.channel?.subscribers);
  const videos = (profile.videos || []).filter(Boolean);
  const sig = rec.signals || {};
  const stats = insights.stats || {};
  // strip the creator's own name/handle + youtube boilerplate from topic words
  const JUNK = new Set(['playlist', 'video', 'videos', 'channel', 'music', 'audio', 'full', 'official', 'live']);
  const brandTokens = `${name} ${profile.channel?.handle || ''}`.toLowerCase().split(/[^a-z0-9가-힣]+/).filter((w) => w.length >= 2);
  const clean = (w) => { const lo = String(w).toLowerCase(); return !JUNK.has(lo) && !brandTokens.some((b) => lo === b || (b.length >= 3 && lo.includes(b))); };
  const kws = (insights.keywords || []).map((k) => k.word).filter(clean).slice(0, 10);
  const tags = (insights.hashtags || []).map((h) => h.tag).filter(clean).slice(0, 8);
  const topics = (insights.topics || []).filter(clean).slice(0, 8);

  // ── content metrics ──
  const withViews = videos.filter((v) => v.views != null).sort((a, b) => b.views - a.views);
  const topVideos = withViews.slice(0, 3).map((v) => ({
    title: v.title, views: v.views, likes: v.likes, comments: v.comments,
    likeRate: v.views ? v.likes / v.views : null,
  }));
  const medViews = median(withViews.map((v) => v.views));
  const avgViews = stats.avgViews;
  const avgDurMin = sig.avgDurMin;
  const likeRates = videos.filter((v) => v.views && v.likes != null).map((v) => v.likes / v.views);
  const cmtRates = videos.filter((v) => v.views && v.comments != null).map((v) => v.comments / v.views);
  const avgLikeRate = mean(likeRates);
  const avgCmtRate = mean(cmtRates);
  // best-reacted video by like rate
  const byLike = videos.filter((v) => v.views && v.likes != null).sort((a, b) => b.likes / b.views - a.likes / a.views);
  const bestReact = byLike[0] || null;
  // which keywords recur in the highest-view titles
  const topTitles = withViews.slice(0, 5).map((v) => (v.title || '').toLowerCase());
  const commonInTop = kws.filter((k) => topTitles.filter((t) => t.includes(k.toLowerCase())).length >= 2).slice(0, 6);

  const detected = detectChannelSignals(profile);
  const longform = avgDurMin != null && avgDurMin >= 12;
  const highEngage = avgLikeRate != null && avgLikeRate >= 0.03; // ≥3% like rate = strong
  const highComment = avgCmtRate != null && avgCmtRate >= 0.003;

  // ── 1. 기본 분석 ──
  const basics = {
    concept: `${name}은(는) ${topics.slice(0, 3).join(' · ') || tpl.label} 중심의 ${tpl.label} 채널입니다. ${insights.tagline || ''}`.trim(),
    target: tpl.audience,
    problem: tpl.problem,
    expertImage: tpl.expert,
    coreMessage: topics.length
      ? `“${topics.slice(0, 3).join(', ')}”을(를) ${arche === 'commerce' ? '솔직하게 골라주고' : arche === 'finance' ? '검증해서 알려주고' : '쉽게 정리해 전달'}한다.`
      : `${name}만의 관점으로 핵심을 전달한다.`,
    keywords: kws,
    hashtags: tags,
  };

  // ── 2. 콘텐츠 패턴 ──
  const titleStyle = titlePatterns(withViews.slice(0, 8).map((v) => v.title || ''));
  const content = {
    topVideos,
    highViewPattern: topVideos.length
      ? `조회수 상위 영상 평균 ${Number(Math.round(mean(topVideos.map((t) => t.views)) || 0)).toLocaleString('ko-KR')}회로, 채널 중앙값(${medViews ? Math.round(medViews).toLocaleString('ko-KR') : '—'}회) 대비 ${medViews && topVideos.length ? '약 ' + (mean(topVideos.map((t) => t.views)) / medViews).toFixed(1) + '배' : '높음'}. ${commonInTop.length ? '상위 영상 제목에 “' + commonInTop.join(', ') + '” 키워드가 반복됩니다.' : '특정 주제가 조회수를 견인합니다.'}`
      : '조회수 데이터가 충분치 않아 상위 패턴은 생략합니다.',
    titleExpressions: titleStyle,
    thumbnailStyle: tpl.thumb,
    repeatedThemes: topics.slice(0, 6),
    reactionPoint: bestReact
      ? `가장 반응이 좋은 영상은 “${bestReact.title}” (좋아요율 ${pct(bestReact.likes / bestReact.views)}). 평균 좋아요율 ${pct(avgLikeRate)} · 댓글율 ${pct(avgCmtRate)}.`
      : `평균 좋아요율 ${pct(avgLikeRate)} · 댓글율 ${pct(avgCmtRate)}.`,
    commentNeeds: highComment
      ? '댓글 참여가 평균 이상으로 활발합니다 — 시청자가 “더 묻고, 더 깊이 배우고, 소통하고” 싶어 합니다. 멤버십·커뮤니티·Q&A 수요가 큽니다.'
      : '댓글보다 시청·좋아요 위주의 “소비형” 반응입니다 — 강의·자료처럼 바로 가치를 주는 상품이 전환에 유리합니다.',
    cadence: stats.latestUpload ? `최근 업로드 ${stats.latestUpload}, 영상 ${stats.videoCount}개·쇼츠 ${stats.shortsCount}개 분석 기준.` : null,
  };

  // ── 3. 수익화 ──
  const current = tpl.current.map((m) => ({ method: m, status: 'likely' }));
  // upgrade detected signals to "확인됨"
  if (detected.affiliate) current.push({ method: '구매·제휴 링크 (설명란에서 감지)', status: 'detected' });
  if (detected.membership) current.push({ method: '멤버십·후원 (설명란에서 감지)', status: 'detected' });
  if (detected.ebook) current.push({ method: '자료·전자책·템플릿 (설명란에서 감지)', status: 'detected' });

  const untapped = [];
  if (longform) untapped.push({ title: '유료 온라인 강의(VOD)', why: `평균 ${avgDurMin}분 롱폼 — 이미 강의에 가까운 깊이. 무료 영상을 체계적 유료 커리큘럼으로 묶으면 전환률이 높습니다.`, module: 'courses' });
  if (highEngage || highComment) untapped.push({ title: '멤버십 구독', why: `좋아요율 ${pct(avgLikeRate)}로 충성도 높은 팬층 — 월 구독 멤버십으로 안정적 반복 매출(LTV) 확보가 가능합니다.`, module: 'membership' });
  if (arche === 'commerce' || detected.affiliate) untapped.push({ title: '자체 상품 판매(마진 100%)', why: '지금은 제휴 수수료(보통 3~10%)만 받지만, 큐레이션 상품을 직접 판매하면 마진 전체를 가져갑니다.', module: 'merch' });
  if (arche === 'coach') untapped.push({ title: '1:1·그룹 코칭 예약', why: 'DM·외부결제로 새던 코칭 수요를 일정 예약+결제로 자동화하면 객단가와 처리량이 동시에 올라갑니다.', module: 'coaching' });
  untapped.push({ title: '디지털 자료(전자책·템플릿·리포트)', why: '제작은 1회, 판매는 무한 — 영상에서 다룬 노하우를 PDF·템플릿으로 묶으면 추가 비용 없이 매출이 발생합니다.', module: 'digital' });
  if (!detected.links) untapped.push({ title: '구독자 → 고객 DB 전환', why: '설명란에 판매 동선이 거의 없습니다. 전용 사이트 링크 하나로 “보는 사람”을 “결제·가입한 고객”으로 모을 수 있습니다.', module: 'community' });

  const monetization = { current, untapped, note: detected.links ? '설명란에 외부 링크가 있어 이미 일부 트래픽을 외부로 보내고 있습니다 — 그 트래픽을 자체 사이트로 모으면 데이터·매출을 직접 소유합니다.' : '설명란에 판매 동선이 거의 없어, 도달은 크지만 매출 전환 창구가 비어 있습니다.' };

  // ── 4. 런모아 연결 ──
  const subsTxt = subs != null ? subs.toLocaleString('ko-KR') + '명' : '미확인';
  const bestModel = pickModel(arche, subs, { longform, highEngage });
  const runmoa = {
    problems: [
      '수익이 유튜브 광고(애드센스)에 집중 — 단가 변동·비수익 영상·정책 변화에 취약합니다.',
      `구독자(${subsTxt})는 자산이지만 “내 고객 DB”가 아닙니다 — 관계와 데이터를 유튜브가 소유합니다.`,
      '콘텐츠는 많은데 한곳에 모아 “결제까지” 잇는 판매 동선이 없습니다.',
      '팬의 구매 의향을 즉시 매출로 바꿀 결제 창구가 없습니다.',
    ],
    solutions: [
      { problem: '광고 의존', solution: '강의·멤버십·상품으로 광고 밖 직접 매출 — runmoa contents·products·membership' },
      { problem: '고객 DB 부재', solution: '결제·가입 시 회원/주문 DB 확보 — 이메일·연락처·구매이력을 직접 보유' },
      { problem: '판매 동선 없음', solution: '전용 사이트 하나로 콘텐츠 + 강의 + 상품을 한 동선에 배치' },
      { problem: '결제 창구 없음', solution: 'Schoolmoa 로그인 + NicePay 실결제로 클릭→구매를 즉시 전환' },
    ],
    extraRevenue: (rec.blueprint?.modules || []).map((k) => (rec.modulesMeta?.[k]?.label || k)),
    conversion: '유튜브 영상(무료 도달) → 설명란 사이트 링크 → 무료 리드(맛보기 강의·자료) → 핵심 오퍼(강의·멤버십) → 재구매·구독으로 LTV 확대. 유튜브는 “유입”, 런모아 사이트는 “전환·재구매”를 담당합니다.',
    bestModel,
    pitchPoints: pitchFor(arche, name, subs, bestModel),
  };

  return { archetype: arche, archetypeLabel: tpl.label, basics, content, monetization, runmoa };
}

function pickModel(arche, subs, sigs) {
  const low = subs != null && subs < 5000;
  if (low) return { name: '무료 상담·리드마그넷 → 멤버십', why: '아직 구독 규모가 크지 않아, 무료 자료·상담으로 신뢰를 먼저 쌓고 소수 충성 팬을 멤버십으로 전환하는 모델이 적합합니다.' };
  if (arche === 'coach') return { name: '1:1·그룹 코칭 예약', why: '코칭 수요는 객단가가 높고 결과 지향이라, 예약·결제 자동화 시 가장 빠르게 매출이 납니다.' };
  if (arche === 'commerce') return { name: '큐레이션 상품 직판', why: '구매 직전 시청자가 많아, 추천 상품을 자체 판매하면 제휴 수수료가 아닌 전체 마진을 가져갑니다.' };
  if (arche === 'insight' || arche === 'relax') return { name: '월 구독 멤버십', why: '꾸준히 소비되는 인사이트·콘텐츠형이라 반복 매출(구독)이 가장 안정적입니다.' };
  if (sigs.longform || arche === 'educator' || arche === 'finance') return { name: '핵심 유료 강의(VOD)', why: '이미 롱폼·교육형 콘텐츠라 체계적 유료 강의로의 전환률이 가장 높습니다.' };
  return { name: '강의 + 멤버십 혼합', why: '콘텐츠 폭이 넓어 핵심 강의로 객단가를, 멤버십으로 반복 매출을 함께 확보하는 혼합형이 적합합니다.' };
}

function pitchFor(arche, name, subs, model) {
  const subsTxt = subs != null ? subs.toLocaleString('ko-KR') + '명' : '구독자';
  return [
    `“광고 수익 외에 ${model.name}(으)로 새로운 매출 라인을 5분 만에 엽니다.”`,
    `“${subsTxt}의 팬을 ‘보는 사람’에서 ‘결제하는 고객’으로 — 그 고객 DB를 직접 소유합니다.”`,
    '“사이트 제작·결제·회원관리·콘텐츠 보호를 코딩 없이 런모아가 자동화합니다.”',
    '“유튜브 알고리즘에 흔들리지 않는, 내가 소유한 매출 채널을 만듭니다.”',
  ];
}
