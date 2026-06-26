# Creator Solution Builder (`create-api-home`)

**유튜브 링크 + runmoa API 키**를 넣으면, 채널을 자동 분석해 **그 채널에 맞는 최적의 수익화 솔루션**을
추천하고, 강의·상품·멤버십·코칭을 갖춘 스토어를 생성해 [runmoa](https://api-docs.runmoa.ai/)에 배포하는 플랫폼.

> 고정 템플릿이 아니다. 채널마다 다른 솔루션을 만든다 —
> 교육 채널 → 강의 스토어, 인사이트 채널 → 멤버십, 리뷰 채널 → 커머스 샵, ASMR → 구독, 코칭 → 예약.

```
[ 유튜브 링크 + runmoa 키 ]
        │
        ▼  /api/analyze   (yt-dlp 분석 + 추천엔진)
  채널 유형 분류 → 최적 솔루션 + 근거 + 모듈
        │
        ▼  /api/generate  (블루프린트 → 카탈로그)
  채널 맞춤 스토어 생성 (강의/상품/멤버십/코칭)
        │
        ▼  /api/deploy    (runmoa API 검증 + 등록)
  runmoa에 콘텐츠·상품 실제 등록
```

## 추천 엔진 (핵심)

채널의 제목·설명·소개글·쇼츠 비중·영상 길이·구독자 규모를 분석해 **6개 아키타입**으로 분류하고,
각 아키타입에 맞는 **모듈 조합(블루프린트)**을 추천한다. (문서-빈도 기반 점수로 1개 영상의 해시태그 스팸에 휘둘리지 않음.)

| 아키타입 | 최적 솔루션 | 모듈 |
|---|---|---|
| 교육·강의 | 온라인 클래스 스토어 | 강의 · 디지털 · 커뮤니티 |
| 인사이트·분석 | 프리미엄 인사이트 멤버십 | 멤버십 · 강의 · 디지털 |
| 리뷰·커머스 | 크리에이터 커머스 샵 | 굿즈 · 디지털 · 강의 |
| 힐링·음악 | 프리미엄 구독 | 멤버십 · 디지털 |
| 코칭·피트니스 | 코칭 & 클래스 예약 | 코칭 · 강의 · 디지털 |
| 재테크·투자 | 고가 강의 + 커뮤니티 | 강의 · 멤버십 · 커뮤니티 |

각 모듈은 실제 runmoa 기능으로 매핑된다:

| 모듈 | runmoa API |
|---|---|
| 강의 | `POST /contents` (vod, base_price/sale_price) |
| 코칭·클래스 | `POST /contents` (offline, location/schedule) |
| 디지털·굿즈 | `POST /products` (variants/options/shipping) |
| 멤버십 | `membership · subscription` + `connected_membership_ids` |
| 커뮤니티 | `boards · posts` |
| 결제 | `POST /orders` → `POST /payments/initialize` |

## 요구사항

- Node.js ≥ 18 (글로벌 `fetch`, npm 의존성 0개)
- [`yt-dlp`](https://github.com/yt-dlp/yt-dlp) — API 키 없이 채널 분석 (`brew install yt-dlp`)

## 실행

```sh
npm start                         # → http://localhost:8090  (빌더 플랫폼)
```

1. 유튜브 링크 입력 (예: `@jangproai`) → **분석 시작**
2. 추천 솔루션 + 분석 근거 확인 → 모듈 켜고 끄기 / 다른 솔루션 선택
3. **스토어 생성** → 미리보기 (`/store/`)
4. (선택) runmoa 키 입력 → **API 검증 후 배포**

키 없이도 1~3단계(분석·추천·생성·미리보기)는 완전히 동작한다. 배포(4단계)만 키가 필요하다.

### API (직접 호출도 가능)

```sh
curl -X POST localhost:8090/api/analyze  -d '{"url":"@jangproai"}'
curl -X POST localhost:8090/api/generate -d '{"url":"@jangproai","blueprintKey":"insight"}'
curl -X POST localhost:8090/api/deploy   -d '{"url":"@jangproai","siteHost":"...","serverKey":"...","storefrontKey":"..."}'
```

`/api/deploy`는 먼저 `GET /content-categories`로 **키를 실제 검증**한 뒤(실패 시 401 그대로 반환)
강의·코칭·상품을 등록한다.

### CLI (서버 없이)

```sh
node bin/create-api-home.js @jangproai --dry-run --show-payloads   # 분석 + 페이로드
node bin/create-api-home.js @jangproai --live --with-products      # 실제 등록 (.env 키)
```

## 생성된 스토어 (`/store/`)

블루프린트에 따라 **모듈별로 화면이 달라진다**: 홈 · 강의 · 스토어 · 멤버십 · 클래스 · 크리에이터 수익.
장바구니 → 결제 → 주문완료 → 수익 대시보드까지 동작(데모 결제 localStorage). `web/index.html` 더블클릭으로도 열림.

## 프로젝트 구조

```
server.js                플랫폼 백엔드 (analyze / generate / deploy + 정적 서빙)
src/
  youtube.js   yt-dlp 분석 → ChannelProfile
  analyze.js   토픽/태그라인/통계
  recommend.js 추천 엔진 — 아키타입 분류 + 블루프린트 (핵심)
  catalog.js   블루프린트 → 강의·상품·멤버십·코칭 카탈로그
  mapper.js    강의/코칭/상품 → runmoa 페이로드
  runmoa.js    API 클라이언트 (storefront 읽기 + server 쓰기)
  ingest.js    CLI 파이프라인
web-builder/   빌더 위저드 UI (입력 → 추천 → 생성 → 배포)
web/           생성된 스토어 (모듈 인지 SPA)
```

## 검증 상태

- ✅ 분석 → 추천(아키타입 분류) → 생성 → 모듈별 스토어 렌더 — `@jangproai`로 동작 확인
  (인사이트 채널 → 🧠 프리미엄 인사이트 멤버십 추천, 멤버십 페이지 생성)
- ✅ `/api/deploy`가 runmoa API를 **실제 호출** — 잘못된 키는 `401`로 정확히 거부됨 (라이브 검증)
- ⚠️ 실제 콘텐츠 등록·실 결제 — 유효한 runmoa 키 입력 시 완료 (페이로드는 문서 스키마 준수)
