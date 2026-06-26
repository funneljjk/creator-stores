// Derives lightweight insights from a ChannelProfile: topics (hashtags +
// frequent keywords), a tagline, and aggregate stats. No LLM / no deps.

// Korean + English stopwords to drop from keyword frequency.
const STOP = new Set(
  (
    '그리고 그러나 하지만 그런데 그래서 이것 저것 여기 거기 정말 진짜 완전 너무 매우 모든 그냥 ' +
    '오늘 지금 우리 우린 너희 그들 이번 다음 가장 제일 누가 누구 그게 이게 저게 거의 약간 조금 ' +
    '다시 계속 결국 역시 아주 바로 한자 미친 미쳤 the a an and or but for to of in on at is are be ' +
    'this that with from your you his her its our their how why what when who will can just now new ' +
    'video shorts youtube channel subscribe ai ' +
    // web / url / boilerplate junk (esp. English channels)
    'http https www com net org io html amp utm ref via featuring feat ft vs get got one all out more ' +
    'about into over after also here there link links shop store code discount use using watch follow ' +
    'instagram twitter tiktok facebook threads patreon merch sponsor sponsored today day week ' +
    'every ever intro outro thanks thank want need know like time make made get got see go going let ' +
    'part full official episode episodes top first last next people thing things really much many lot ' +
    'good great look looking come came take year years world week day stuff guys hey check below ' +
    'review reviews unboxing vlog podcast live stream'
  ).split(/\s+/)
);
const URL_RE = /https?:\/\/\S+|\b[\w.-]+\.(?:com|net|org|io|ly|co|gl|me|tv|kr|be)\b/gi;

const HASH_JUNK = new Set(
  'shorts short fyp foryou foryoupage viral trending youtube subscribe like likes reels reel explore tiktok video videos new today daily'.split(' ')
);
function extractHashtags(text = '') {
  const out = [];
  const re = /#([\p{L}\p{N}_]+)/gu;
  let m;
  while ((m = re.exec(text))) {
    const t = m[1];
    if (t.length >= 2 && !/^\d+$/.test(t) && !HASH_JUNK.has(t.toLowerCase())) out.push(t);
  }
  return out;
}

function tokenize(text = '') {
  return (String(text).replace(URL_RE, ' ').match(/[\p{L}\p{N}]{2,}/gu) || [])
    .map((w) => w.toLowerCase())
    .filter((w) => !STOP.has(w) && !/^\d+$/.test(w) && w.length <= 18 && !/^\d/.test(w));
}

function topN(counter, n) {
  return [...counter.entries()].sort((a, b) => b[1] - a[1]).slice(0, n);
}

/**
 * @param {{channel:object, videos:object[], shorts:object[]}} profile
 */
export function deriveInsights(profile) {
  const { channel, videos = [], shorts = [] } = profile;
  const items = [...videos, ...shorts];

  // Hashtags are the strongest topic signal on most channels.
  const hashCount = new Map();
  const wordCount = new Map();
  for (const it of items) {
    const blob = `${it.title || ''}\n${it.description || ''}`;
    // cap hashtags per item so one tag-stuffed video can't flood the topics
    for (const h of extractHashtags(blob).slice(0, 4)) hashCount.set(h, (hashCount.get(h) || 0) + 1);
    // weight titles a bit more than descriptions for keywords
    for (const w of tokenize(it.title || '')) wordCount.set(w, (wordCount.get(w) || 0) + 2);
    for (const w of tokenize((it.description || '').slice(0, 400)))
      wordCount.set(w, (wordCount.get(w) || 0) + 1);
  }

  const hashtags = topN(hashCount, 14).map(([t, n]) => ({ tag: t, count: n }));
  const keywords = topN(wordCount, 16).map(([t, n]) => ({ word: t, count: n }));

  // Drop the creator's own name/handle from topics (it's not a subject theme).
  const brandTokens = `${channel.name || ''} ${channel.handle || ''}`
    .toLowerCase().split(/[^a-z0-9가-힣]+/).filter((w) => w.length >= 3);
  const notBrand = (t) => {
    const lo = String(t).toLowerCase();
    return !brandTokens.some((b) => lo === b || lo.includes(b) || b.includes(lo));
  };

  // Topic chips: prefer hashtags, pad with filtered keywords if sparse.
  const hashList = hashtags.map((h) => h.tag).filter(notBrand);
  const keyList = keywords.map((k) => k.word).filter(notBrand);
  const topics = (hashList.length >= 4 ? hashList : hashList.concat(keyList)).slice(0, 8);

  // Stats over the recent videos only (most meaningful for a homepage).
  const views = videos.map((v) => v.views).filter((n) => n != null);
  const durations = videos.map((v) => v.duration).filter((n) => n != null);
  const sum = (a) => a.reduce((x, y) => x + y, 0);
  const stats = {
    videoCount: videos.length,
    shortsCount: shorts.length,
    totalViews: views.length ? sum(views) : null,
    avgViews: views.length ? Math.round(sum(views) / views.length) : null,
    avgDuration: durations.length ? Math.round(sum(durations) / durations.length) : null,
    latestUpload: videos.map((v) => v.uploadDate).filter(Boolean).sort().pop() || null,
  };

  // Tagline: first line of the channel about, else synthesize from topics.
  const aboutFirst = (channel.description || '').split(/\r?\n/).map((s) => s.trim()).find(Boolean);
  const tagline =
    aboutFirst ||
    (topics.length ? `${topics.slice(0, 3).join(' · ')} 콘텐츠 채널` : `${channel.name} 채널`);

  return { topics, hashtags, keywords, stats, tagline };
}
