// Gemini-generated store copy. Turns the channel analysis into BESPOKE, per-
// creator marketing copy (hero / why-buy / reviews / product ideas) so two
// different channels never read the same. Falls back to null on any error so
// the caller keeps the rule-based templates.

const ENDPOINT = (model) => `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

async function geminiJSON(prompt, key, model) {
  const res = await fetch(ENDPOINT(model) + '?key=' + encodeURIComponent(key), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.85, responseMimeType: 'application/json', maxOutputTokens: 16384 },
    }),
    signal: AbortSignal.timeout(75000),
  });
  const j = await res.json();
  if (j.error) throw new Error('gemini ' + j.error.code + ' ' + (j.error.message || '').slice(0, 120));
  const text = j.candidates && j.candidates[0] && j.candidates[0].content && j.candidates[0].content.parts && j.candidates[0].content.parts[0] && j.candidates[0].content.parts[0].text;
  if (!text) throw new Error('gemini empty response');
  return JSON.parse(text);
}

// archetype → the verb the store should sell on (so framing fits the channel)
const ACTION = {
  educator: '이 강의를 들어야',
  insight: '이 멤버십을 구독해야',
  commerce: '여기서 사야',
  relax: '이 구독을 들어야',
  coach: '이 코칭을 받아야',
  finance: '이 강의를 들어야',
  creator: '이 크리에이터를 선택해야',
};

function buildPrompt(c) {
  const action = ACTION[c.archetype] || ACTION.creator;
  return [
    '너는 크리에이터 커머스 사이트 전문 카피라이터다. 아래 유튜버 분석 자료를 읽고, 이 채널 "전용" 스토어 카피를 한국어로 작성하라.',
    '절대 일반론·뻔한 문구 금지. 이 채널의 실제 주제·영상·이력·숫자를 구체적으로 녹여라. 과장/허위 수치 생성 금지(주어진 숫자만 사용).',
    '',
    '[채널] ' + c.name + (c.subs ? ' · 구독자 ' + Number(c.subs).toLocaleString('ko-KR') + '명' : '') + ' · 유형: ' + (c.archetypeLabel || ''),
    c.about ? '[소개] ' + c.about : '',
    c.coreMessage ? '[핵심 메시지] ' + c.coreMessage : '',
    c.target ? '[타깃 시청자] ' + c.target : '',
    c.problem ? '[해결하는 문제] ' + c.problem : '',
    c.expertImage ? '[전문가 포지션] ' + c.expertImage : '',
    c.topVideos && c.topVideos.length ? '[대표 영상] ' + c.topVideos.slice(0, 6).join(' / ') : '',
    c.keywords && c.keywords.length ? '[반복 키워드] ' + c.keywords.slice(0, 10).join(', ') : '',
    c.topics && c.topics.length ? '[주제] ' + c.topics.slice(0, 8).join(', ') : '',
    '',
    '이 스토어는 "' + action + '" 하는지 설득하는 전환형 사이트다. 그 관점으로 카피를 써라.',
    '',
    '아래 JSON "스키마 그대로" 출력하라(설명/마크다운 금지, JSON만):',
    '{',
    '  "role": "한 줄 포지셔닝 (예: 국내 유일 AI 이커머스 전문가)",',
    '  "headline": "히어로 헤드라인 — 짧고 강렬한 한 줄 후킹. 8~20자 권장, 완결 문장/마침표 금지, 광고 카피처럼 임팩트. 긴 설명 절대 금지 (그건 statement로)",',
    '  "highlight": "headline에서 가장 강조할 핵심 단어/구 — 반드시 headline의 정확한 부분 문자열(1~8자), 색으로 강조됨",',
    '  "statement": "헤드라인 아래 서브카피 1~2문장 (여기에 구체 설명·숫자·이력)",',
    '  "pillars": [{"t":"강점 제목(짧게)","d":"이 채널 근거로 1문장"} ] (정확히 3개),',
    '  "why": {"title":"왜 ' + c.name + '에게(서) ' + action.replace(/이 |여기서 /, '') + ' 하는지 섹션 제목", "reasons":[{"t":"이유 제목","d":"이 채널의 구체적 근거 2문장"}] (정확히 4개)},',
    '  "reviews": [{"name":"한국식 가명 또는 닉네임","role":"수강생/구매자 유형","text":"이 채널 주제에 딱 맞는 진짜같은 후기 2~3문장","rating":5}] (정확히 6개, rating 4~5 섞기),',
    '  "products": [{"title":"이 채널에 어울리는 디지털/실물 상품명","category":"카테고리","desc":"한 줄 설명","priceKRW":29000,"kind":"digital 또는 physical"}] (4개, 이 채널 주제 기반의 현실적인 상품),',
    '  "courses": [{"title":"이 채널이 실제로 팔 법한 온라인 강의명","category":"짧은 카테고리","level":"입문|중급|심화 중 하나","tagline":"카드용 한 줄 훅","priceKRW":49000,"outcomes":["수강 후 얻는 것 4개"],"curriculum":["1강부터 마지막 강까지 실제 커리큘럼 제목 6~12개 — 이 채널 주제의 진짜 수업처럼"]}] (정확히 4개, 입문→심화 순),',
    '  "coaching": [{"title":"코칭/클래스 상품명 — 이 채널 주제 그대로","mode":"1:1 온라인|소규모 그룹|오프라인 중 하나","minutes":60,"seats":1,"priceKRW":120000,"schedule":"매주 화·목 저녁 식 짧은 일정 문구","desc":"무엇을 봐주고 무엇을 얻는지 2문장"}] (정확히 3개: 1:1, 그룹, 오프라인 워크숍 순),',
    '  "guarantee": "구매 안심 배너 문구 한 줄"',
    '}',
    '',
    '강의·코칭·상품은 전부 [주제]/[대표 영상]/[반복 키워드]에서 직접 도출하라. 채널 주제와 무관한 것(예: 건축 채널에 명상 강의)은 절대 금지. 커리큘럼 제목엔 이 분야 실제 용어를 써라.',
  ].filter(Boolean).join('\n');
}

/**
 * @param {object} ctx channel analysis context
 * @param {{geminiApiKey:string, model?:string}} opts
 * @returns {Promise<object|null>} copy object, or null on failure
 */
export async function generateCopy(ctx, opts = {}) {
  const key = opts.geminiApiKey;
  if (!key) return null;
  const prompt = buildPrompt(ctx);
  const primary = opts.model || 'gemini-3.1-pro-preview';
  try {
    return await geminiJSON(prompt, key, primary);
  } catch (e) {
    console.warn('[gemini] ' + primary + ' failed: ' + e.message + ' — trying flash');
    try { return await geminiJSON(prompt, key, 'gemini-2.5-flash'); } catch (e2) { console.warn('[gemini] flash failed: ' + e2.message); return null; }
  }
}
