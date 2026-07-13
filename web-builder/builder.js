/* Builder wizard: input → analyze → recommend → generate → deploy. */
(function () {
  'use strict';
  var wiz = document.getElementById('wiz');
  var state = { url: '', keys: {}, analysis: null, blueprints: {}, chosenKey: null, modules: [] };

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function won(n) { return n == null ? '—' : '₩' + Number(n).toLocaleString('ko-KR'); }
  function count(n) { n = Number(n); if (n >= 10000) return (n / 10000).toFixed(1).replace(/\.0$/, '') + '만'; if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + '천'; return String(n || 0); }
  function api(path, body) {
    return fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      .then(function (r) { return r.json(); });
  }

  // ── input wiring ──────────────────────────────────────────
  document.getElementById('toggleEmbeds').addEventListener('click', function () {
    var e = document.getElementById('embedsBox'); e.hidden = !e.hidden;
  });
  document.querySelectorAll('[data-sample]').forEach(function (a) {
    a.addEventListener('click', function (e) { e.preventDefault(); document.getElementById('url').value = a.dataset.sample; });
  });
  document.getElementById('form').addEventListener('submit', function (e) {
    e.preventDefault();
    var url = document.getElementById('url').value.trim();
    if (!url) { document.getElementById('url').focus(); return; }
    state.url = url;
    state.keys = {};            // runmoa keys are collected (required) at the 제작 step
    state.embeds = val('embeds');
    startAnalyze();
  });
  function val(id) { var el = document.getElementById(id); return el ? el.value.trim() : ''; }

  // ── analyzing ─────────────────────────────────────────────
  function startAnalyze() {
    var labels = ['채널 정보 가져오는 중', '최근 영상·쇼츠 분석', '콘텐츠 신호 추출', '최적 솔루션 계산'];
    wiz.innerHTML = '<section class="step"><div class="analyzing"><div class="spin"></div>' +
      '<h2>채널을 분석하고 있어요</h2><ul class="steps-list" id="slist">' +
      labels.map(function (l, i) { return '<li data-i="' + i + '"><span class="dot">' + (i + 1) + '</span>' + esc(l) + '</li>'; }).join('') +
      '</ul></section>';
    var i = 0;
    var lis = wiz.querySelectorAll('#slist li');
    function tick() {
      if (i > 0) lis[i - 1].classList.replace('active', 'done'), lis[i - 1].querySelector('.dot').textContent = '✓';
      if (i < lis.length) { lis[i].classList.add('active'); i++; }
    }
    tick();
    var timer = setInterval(tick, 2600);

    // fresh:true — analyzing is an explicit user action: never serve a stale
    // cached analysis from a previous run on this host.
    api('/api/analyze', { url: state.url, fresh: true }).then(function (res) {
      clearInterval(timer);
      if (res.error) return renderError(res.error);
      // mark all done briefly
      lis.forEach(function (li) { li.classList.add('done'); li.classList.remove('active'); li.querySelector('.dot').textContent = '✓'; });
      state.analysis = res;
      state.blueprints = {};
      state.blueprints[res.recommendation.key] = res.recommendation;
      (res.alternatives || []).forEach(function (a) { state.blueprints[a.key] = a; });
      state.chosenKey = res.recommendation.key;
      state.modules = (res.recommendation.modules || []).slice();
      setTimeout(renderRecommend, 450);
    }).catch(function (e) { clearInterval(timer); renderError(e.message); });
  }

  // ── recommend ─────────────────────────────────────────────
  function renderRecommend() {
    var a = state.analysis;
    var bp = state.blueprints[state.chosenKey];
    var mm = a.modulesMeta;
    wiz.innerHTML =
      '<section class="step">' +
        head(a) +
        reportSection(a.report, bp, a) +
        recoCard(bp, state.chosenKey === a.recommendation.key) +
        '<div class="section-title">포함 모듈 <span style="font-weight:500;color:var(--ink-3)">· 클릭해서 켜고 끌 수 있어요</span></div>' +
        '<div class="mods" id="mods">' + Object.keys(mm).map(function (k) { return modCard(mm[k], state.modules.indexOf(k) >= 0); }).join('') + '</div>' +
        altSection(a) +
        connectBlock() +
        '<div class="actions-bar">' +
          '<button class="btn btn--brand btn--lg" id="genBtn">이 솔루션으로 제작 + 런모아 배포 →</button>' +
          '<button class="btn btn--ghost btn--lg" id="backBtn">다시 분석</button>' +
        '</div>' +
      '</section>';
    wiz.querySelectorAll('#mods .mod').forEach(function (el) {
      el.addEventListener('click', function () {
        var k = el.dataset.k, idx = state.modules.indexOf(k);
        if (idx >= 0) state.modules.splice(idx, 1); else state.modules.push(k);
        el.classList.toggle('on');
      });
    });
    wiz.querySelectorAll('.alt').forEach(function (el) {
      el.addEventListener('click', function () {
        state.chosenKey = el.dataset.k;
        state.modules = (state.blueprints[state.chosenKey].modules || []).slice();
        renderRecommend();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
    });
    document.getElementById('genBtn').addEventListener('click', startGenerate);
    document.getElementById('backBtn').addEventListener('click', function () { location.reload(); });
  }

  // ── detailed report (4 sections) ──────────────────────────
  function reportSection(rp, bp, a) {
    if (!rp) return '';
    return '<div class="report">' +
      repCard('1', '채널 기본 분석', repBasics(rp.basics)) +
      repCard('2', '콘텐츠 패턴 분석', repContent(rp.content)) +
      repCard('3', '수익화 가능성 분석', repMonet(rp.monetization)) +
      repCard('4', '런모아 연결 포인트', repRunmoa(rp.runmoa, bp, a)) +
    '</div>';
  }
  function repCard(n, title, inner) {
    return '<details class="rep" open><summary><span class="rep__n">' + n + '</span>' + esc(title) + '<span class="rep__chev">⌄</span></summary>' +
      '<div class="rep__body">' + inner + '</div></details>';
  }
  function repRow(label, val) {
    return val ? '<div class="rep__row"><div class="rep__k">' + esc(label) + '</div><div class="rep__v">' + esc(val) + '</div></div>' : '';
  }
  function repChips(label, arr) {
    if (!arr || !arr.length) return '';
    return '<div class="rep__row"><div class="rep__k">' + esc(label) + '</div><div class="rep__v rep__v--chips">' +
      arr.map(function (t) { return '<span class="rchip">' + esc(t) + '</span>'; }).join('') + '</div></div>';
  }
  function repBasics(b) {
    return repRow('콘셉트', b.concept) + repRow('타깃 시청자', b.target) + repRow('해결하는 문제', b.problem) +
      repRow('전문가 이미지', b.expertImage) + repRow('핵심 메시지', b.coreMessage) +
      repChips('반복 키워드', b.keywords) + repChips('해시태그', (b.hashtags || []).map(function (t) { return '#' + t; }));
  }
  function repContent(c) {
    var vids = (c.topVideos || []).length
      ? '<div class="rep__row"><div class="rep__k">조회수 상위 영상</div><div class="rep__v"><ul class="rvids">' +
        c.topVideos.map(function (v) {
          return '<li><span class="rvids__t">' + esc(v.title) + '</span><span class="rvids__m">' + count(v.views) + '회' +
            (v.likes != null ? ' · ♥ ' + count(v.likes) : '') + (v.comments != null ? ' · 💬 ' + count(v.comments) : '') + '</span></li>';
        }).join('') + '</ul></div></div>'
      : '';
    return repRow('조회수 패턴', c.highViewPattern) + vids +
      repChips('제목 표현 스타일', c.titleExpressions) + repRow('썸네일 메시지', c.thumbnailStyle) +
      repChips('반복 주제', c.repeatedThemes) + repRow('시청자 반응', c.reactionPoint) +
      repRow('댓글 니즈', c.commentNeeds) + (c.cadence ? '<p class="rep__note">' + esc(c.cadence) + '</p>' : '');
  }
  function repMonet(m) {
    var cur = '<div class="rep__sub">현재 추정 수익 구조</div><ul class="rmon">' +
      (m.current || []).map(function (x) {
        return '<li><span class="mbadge' + (x.status === 'detected' ? ' mbadge--on' : '') + '">' + (x.status === 'detected' ? '감지' : '추정') + '</span>' + esc(x.method) + '</li>';
      }).join('') + '</ul>';
    var opp = '<div class="rep__sub">놓치고 있는 기회</div><div class="opps">' +
      (m.untapped || []).map(function (o) {
        return '<div class="opp"><div class="opp__t">' + esc(o.title) + '</div><div class="opp__w">' + esc(o.why) + '</div></div>';
      }).join('') + '</div>';
    return cur + opp + (m.note ? '<p class="rep__note">' + esc(m.note) + '</p>' : '');
  }
  function repRunmoa(r, bp, a) {
    // section 4 reflects the CURRENTLY SELECTED solution (not just the auto-pick):
    // model box + 추가 수익 구조 follow the chosen blueprint's title/pitch/modules.
    var isReco = !a || (bp && a.recommendation && bp.key === a.recommendation.key);
    var model = bp ? { name: bp.title, why: bp.pitch } : r.bestModel;
    var modLabel = isReco ? '이 채널에 가장 맞는 모델' : '선택한 솔루션';
    var best = model ? '<div class="bestmodel"><div class="bestmodel__l">' + (bp && bp.emoji ? bp.emoji + ' ' : '') + modLabel + (isReco ? '' : ' <span class="bestmodel__tag">선택됨</span>') + '</div>' +
      '<div class="bestmodel__n">' + esc(model.name) + '</div><div class="bestmodel__w">' + esc(model.why) + '</div></div>' : '';
    var psol = '<div class="rep__sub">겪는 문제 → 런모아 해결</div><div class="psol">' +
      (r.solutions || []).map(function (s) {
        return '<div class="psol__row"><div class="psol__p">' + esc(s.problem) + '</div><div class="psol__a">→</div><div class="psol__s">' + esc(s.solution) + '</div></div>';
      }).join('') + '</div>';
    var conv = r.conversion ? '<div class="rep__sub">구독자 → 고객 전환 동선</div><p class="rep__v">' + esc(r.conversion) + '</p>' : '';
    var revLabels = (bp && bp.modules && a && a.modulesMeta) ? bp.modules.map(function (k) { return (a.modulesMeta[k] && a.modulesMeta[k].label) || k; }) : r.extraRevenue;
    var extra = repChips('추가 수익 구조', revLabels);
    var pitch = (r.pitchPoints || []).length ? '<div class="rep__sub">제안 포인트</div><ul class="pitch">' +
      r.pitchPoints.map(function (p) { return '<li>' + esc(p) + '</li>'; }).join('') + '</ul>' : '';
    return best + psol + conv + extra + pitch;
  }

  function head(a) {
    return '<div class="result__head">' +
      '<img class="result__av" src="' + esc(a.brand.logo || '') + '" alt="">' +
      '<div style="flex:1"><div class="result__name">' + esc(a.brand.name) + '</div>' +
        '<div class="result__meta">구독자 ' + count(a.brand.subscribers) + '명 · 영상 ' + a.counts.videos + ' · 쇼츠 ' + a.counts.shorts + ' · 추정 유형 <b>' + esc(a.archetypeLabel) + '</b></div>' +
        '<div class="result__chips">' + (a.brand.topics || []).filter(function (t) { return ['playlist', 'music', 'video', 'videos', 'channel', 'audio', 'live'].indexOf(String(t).toLowerCase()) < 0; }).slice(0, 6).map(function (t) { return '<span class="tchip">#' + esc(t) + '</span>'; }).join('') + '</div>' +
        foundChannels(a) +
      '</div></div>';
  }
  function foundChannels(a) {
    var d = a.discovered || {};
    var list = (d.socials || []).slice();
    if (d.blog) list.push({ platform: d.blog.platform, label: d.blog.label || '블로그', url: d.blog.url });
    if (!list.length) return '';
    return '<div class="found"><span class="found__l">🔗 자동 발견 채널</span>' +
      list.map(function (s) { return '<a class="found__c found__c--' + esc(s.platform) + '" href="' + esc(s.url) + '" target="_blank" rel="noopener">' + esc(s.label) + '</a>'; }).join('') +
      '</div>';
  }
  function recoCard(bp, isReco) {
    return '<div class="reco">' +
      '<div class="reco__tag">' + (isReco ? '⚡ 추천 솔루션' : '선택한 솔루션') + '</div>' +
      '<div class="reco__title">' + (bp.emoji || '') + ' ' + esc(bp.title) + '</div>' +
      '<div class="reco__pitch">' + esc(bp.pitch) + '</div>' +
      (bp.reasons && bp.reasons.length ? '<div class="reco__why"><h4>분석 근거</h4><ul>' +
        bp.reasons.map(function (r) { return '<li>' + esc(r) + '</li>'; }).join('') + '</ul></div>' : '') +
    '</div>';
  }
  function modCard(m, on) {
    return '<div class="mod' + (on ? ' on' : '') + '" data-k="' + m.key + '">' +
      '<div class="mod__ico">' + m.icon + '</div><div class="mod__name">' + esc(m.label) + '</div>' +
      '<div class="mod__api">runmoa · ' + esc(m.runmoa) + '</div>' +
      '<div class="mod__desc">' + esc(m.desc) + '</div></div>';
  }
  function connectBlock() {
    var k = state.keys || {};
    return '<div class="connect" id="connect">' +
      '<div class="connect__hd"><span class="connect__t">런모아 사이트 연동</span><span class="req">필수</span></div>' +
      '<p class="connect__d">제작 시 강의·상품을 이 런모아 사이트에 실제 등록하고, 스토어가 라이브 데이터를 불러옵니다. 키 3개 모두 입력해야 제작됩니다.</p>' +
      '<div class="keys__grid">' +
        '<label>사이트 링크<input id="g_host" placeholder="https://내사이트.runmoa.com" value="' + esc(k.siteHost || '') + '"></label>' +
        '<label>스토어프론트 키<input id="g_sf" placeholder="moa_pub_..." value="' + esc(k.storefrontKey || '') + '"></label>' +
        '<label>서버 비공개 키<input id="g_sv" placeholder="moa_... (서버 키)" value="' + esc(k.serverKey || '') + '"></label>' +
      '</div>' +
      '<p class="keys__note">🔒 키는 로컬 서버로만 전송됩니다. 브라우저에는 스토어프론트(pub) 키만 저장되고, 서버 키는 저장되지 않습니다.</p>' +
    '</div>';
  }
  var ARCHE_LABEL = { educator: '교육·강의', insight: '인사이트·분석', commerce: '리뷰·커머스', relax: '힐링·음악', coach: '코칭·피트니스', finance: '재테크·투자', creator: '종합' };
  function altWhy(key, a) {
    if (key === 'creator') return '범용 올인원 — 콘텐츠 폭이 넓은 채널에 두루 적합';
    var sc = (a.signals && a.signals.scores && a.signals.scores[key]) || 0;
    var label = ARCHE_LABEL[key] || '';
    if (sc > 0) return '채널 신호 점수 <b>' + sc + '</b> · ‘' + label + '’ 시그널 감지';
    return '‘' + label + '’ 방향으로도 전환 가능';
  }
  function altSection(a) {
    // switchable = AI recommendation + alternatives, minus the current pick → round-trip
    var all = [a.recommendation].concat(a.alternatives || []);
    var seen = {}; all = all.filter(function (x) { if (!x || seen[x.key]) return false; seen[x.key] = 1; return true; });
    var others = all.filter(function (x) { return x.key !== state.chosenKey; });
    if (!others.length) return '';
    return '<div class="section-title">다른 솔루션도 가능해요 <span style="font-weight:500;color:var(--ink-3)">· 클릭하면 그 구성으로 바뀝니다</span></div><div class="alts">' +
      others.map(function (x) {
        var isReco = x.key === a.recommendation.key;
        return '<div class="alt' + (isReco ? ' alt--reco' : '') + '" data-k="' + x.key + '">' +
          '<div class="alt__top"><span class="alt__emoji">' + (x.emoji || '') + '</span>' + (isReco ? '<span class="alt__badge">⚡ AI 추천</span>' : '') + '</div>' +
          '<div class="alt__title">' + esc(x.title) + '</div><div class="alt__pitch">' + esc(x.pitch) + '</div>' +
          '<div class="alt__why">' + altWhy(x.key, a) + '</div></div>';
      }).join('') + '</div>';
  }

  // ── generate (+ deploy) ───────────────────────────────────
  function startGenerate() {
    if (!state.modules.length) { alert('최소 1개 모듈을 선택하세요'); return; }
    var host = val('g_host'), sf = val('g_sf'), sv = val('g_sv');
    [['g_host', host], ['g_sf', sf], ['g_sv', sv]].forEach(function (p) {
      var el = document.getElementById(p[0]); if (el) el.classList.toggle('err', !p[1]);
    });
    if (!host || !sf || !sv) {
      var miss = document.getElementById(!host ? 'g_host' : !sf ? 'g_sf' : 'g_sv');
      if (miss) miss.focus();
      var c = document.getElementById('connect'); if (c) c.scrollIntoView({ behavior: 'smooth', block: 'center' });
      alert('런모아 사이트 링크 · 스토어프론트 키 · 서버 비공개 키는 모두 필수입니다.');
      return;
    }
    state.keys = { siteHost: host, storefrontKey: sf, serverKey: sv };
    var stop = genProgress();   // staged "지금 무엇을 하는지" indicator
    // NOTE: no fresh here — reuse the analysis/copy the 분석 step just cached,
    // so 분석→제작 stay consistent within one builder session.
    api('/api/generate', Object.assign({ url: state.url, blueprintKey: state.chosenKey, modules: state.modules, embeds: state.embeds }, state.keys))
      .then(function (res) {
        stop();
        if (res.error) return renderError(res.error);
        renderGenerated(res);   // shows store, then auto-deploys to runmoa
      }).catch(function (e) { stop(); renderError(e.message); });
  }

  // staged progress while /api/generate runs (AI copy + AI thumbnails take time).
  // server work isn't streamed, so stages advance on a timer to show activity.
  function genProgress() {
    var steps = ['분석 데이터 불러오는 중', 'AI가 채널 맞춤 카피 작성', 'AI 썸네일 이미지 생성 (강의·상품)', '스토어 디자인 구성', '런모아 등록 준비'];
    wiz.innerHTML = '<section class="step"><div class="analyzing"><div class="spin"></div>' +
      '<h2>스토어를 제작하고 있어요</h2><p style="color:var(--ink-3);margin:6px 0 20px">AI 카피와 썸네일 이미지를 만드는 중 — 30초~1분 정도 걸려요</p>' +
      '<ul class="steps-list" id="glist">' +
      steps.map(function (l, i) { return '<li data-i="' + i + '"><span class="dot">' + (i + 1) + '</span>' + esc(l) + '</li>'; }).join('') +
      '</ul></section>';
    var lis = wiz.querySelectorAll('#glist li'), i = 0;
    function tick() {
      if (i > 0 && lis[i - 1]) { lis[i - 1].classList.remove('active'); lis[i - 1].classList.add('done'); lis[i - 1].querySelector('.dot').textContent = '✓'; }
      if (i < lis.length) { lis[i].classList.add('active'); i++; }
    }
    tick();
    var timer = setInterval(tick, 9000);
    return function () { clearInterval(timer); lis.forEach(function (li) { li.classList.add('done'); li.classList.remove('active'); li.querySelector('.dot').textContent = '✓'; }); };
  }

  function renderGenerated(res) {
    var c = res.counts;
    wiz.innerHTML =
      '<section class="step"><div class="gen">' +
        '<div class="gen__ico">✓</div><h2>' + esc((res.blueprint && res.blueprint.title) || '스토어') + ' 제작 완료</h2>' +
        '<p>채널에 맞춘 스토어가 준비됐고, 런모아 사이트에 배포를 시작합니다.</p>' +
        '<div class="gen__stats">' +
          stat(c.courses, '강의') + stat(c.products, '상품') + stat(c.membership, '멤버십') + stat(c.coaching, '코칭/클래스') +
        '</div>' +
        (res.publicUrl
          ? '<div class="pub"><div class="pub__l">🌐 공개 영구 URL (누구나 접속)</div>' +
            '<a class="pub__url" href="' + esc(res.publicUrl) + '" target="_blank" rel="noopener">' + esc(res.publicUrl) + '</a>' +
            '<div class="pub__hint">GitHub Pages · 첫 배포는 1분 내 활성화 · 재제작하면 자동 갱신</div></div>'
          : (res.publish ? '<div class="pub pub--warn">공개 배포 건너뜀 (gh 인증/네트워크 확인). 로컬 미리보기는 정상.</div>' : '')) +
        '<div class="gen__cta">' +
          (res.publicUrl ? '<a class="btn btn--brand btn--lg" href="' + esc(res.publicUrl) + '" target="_blank" rel="noopener">공개 사이트 열기 ↗</a>' : '') +
          '<a class="btn btn--ghost btn--lg" href="/store/" target="_blank" rel="noopener">로컬 미리보기 ↗</a>' +
        '</div>' +
      '</div>' +
      '<iframe class="preview-frame" src="/store/" title="생성된 스토어 미리보기"></iframe>' +
      '<div id="deployArea"></div>' +
      '</section>';
    startDeploy();   // keys are required → deploy to runmoa automatically
  }
  function stat(n, l) { return '<div class="gen__stat"><div class="n">' + (n || 0) + '</div><div class="l">' + l + '</div></div>'; }

  function renderDeployForm() {
    var area = document.getElementById('deployArea');
    area.innerHTML =
      '<div class="deploy-box"><h3>runmoa 배포</h3><p class="muted">서버 키로 강의·상품·코칭을 실제 등록합니다. 키는 API 검증 후 사용되며 저장되지 않습니다.</p>' +
      '<div class="keys__grid">' +
        '<label>사이트 링크<input id="d_host" placeholder="https://내사이트.runmoa.com" value="' + esc(state.keys.siteHost || '') + '"></label>' +
        '<label>스토어프론트 키<input id="d_sf" placeholder="moa_pub_..." value="' + esc(state.keys.storefrontKey || '') + '"></label>' +
        '<label>서버 비공개 키<input id="d_sv" placeholder="서버 키" value="' + esc(state.keys.serverKey || '') + '"></label>' +
      '</div>' +
      '<div style="margin-top:16px"><button class="btn btn--brand" id="deployBtn2">API 검증 후 배포 →</button></div>' +
      '<div class="dep-result" id="depResult"></div></div>';
    document.getElementById('deployBtn2').addEventListener('click', function () {
      state.keys = { siteHost: val('d_host'), storefrontKey: val('d_sf'), serverKey: val('d_sv') };
      if (!state.keys.siteHost || !state.keys.serverKey) { alert('사이트 호스트와 서버 키는 필수입니다'); return; }
      startDeploy();
    });
  }

  // ── deploy ────────────────────────────────────────────────
  function startDeploy() {
    var area = document.getElementById('deployArea') || (function () { var d = document.createElement('div'); d.id = 'deployArea'; wiz.querySelector('.step').appendChild(d); return d; })();
    area.innerHTML = '<div class="deploy-box"><h3>배포 중…</h3><p class="muted">runmoa API 검증 후 콘텐츠를 등록하고 있어요.</p></div>';
    api('/api/deploy', Object.assign({ url: state.url, blueprintKey: state.chosenKey, modules: state.modules, status: 'publish' }, state.keys))
      .then(function (res) {
        if (res.error) { area.innerHTML = depBox('<div class="dep-line err">⚠ ' + esc(res.error) + '</div>'); return; }
        if (!res.ok) { area.innerHTML = depBox('<div class="dep-line err">⚠ ' + esc(res.step === 'auth' ? 'API 키 검증 실패: ' : '') + esc(res.error) + '</div>'); return; }
        var lines = '<div class="dep-line ok">✓ API 키 검증 완료 · ' + esc(res.siteHost) + '</div>';
        (res.created || []).forEach(function (c) { lines += '<div class="dep-line ok">✓ [' + kindKo(c.kind) + '] #' + esc(c.id) + ' ' + esc(c.title) + '</div>'; });
        (res.updated || []).forEach(function (c) { lines += '<div class="dep-line ok">↻ [' + kindKo(c.kind) + '] #' + esc(c.id) + ' ' + esc(c.title) + ' · 업데이트</div>'; });
        (res.failed || []).forEach(function (f) { lines += '<div class="dep-line err">✕ [' + kindKo(f.kind) + '] ' + esc(f.title) + ' — ' + esc(f.error) + '</div>'; });
        (res.skipped || []).forEach(function (s) { lines += '<div class="dep-line skip">• ' + esc(s) + '</div>'; });
        area.innerHTML = depBox('<h3 style="margin-bottom:14px">배포 완료 · 신규 ' + (res.created || []).length + ' · 업데이트 ' + (res.updated || []).length + '</h3>' + lines);
      }).catch(function (e) { area.innerHTML = depBox('<div class="dep-line err">⚠ ' + esc(e.message) + '</div>'); });
  }
  function depBox(inner) { return '<div class="deploy-box">' + inner + '</div>'; }
  function kindKo(k) { return { course: '강의', product: '상품', coaching: '코칭' }[k] || k; }

  function renderError(msg) {
    wiz.innerHTML = '<section class="step"><div class="err-box">⚠ 분석 실패: ' + esc(msg) +
      '<br><br><button class="btn btn--ghost" onclick="location.reload()">다시 시도</button></div></section>';
  }
})();
