# Site Audit Dashboard

Modern website scanner with:
- sitemap-first crawling + same-origin deep crawl,
- Lighthouse + Core Web Vitals scoring,
- accessibility scanning,
- aggregate site scores and per-page breakdowns,
- live progress updates,
- downloadable JSON/Markdown reports.

## What You Get

- UI to submit a homepage or parent URL.
- Live progress while pages are discovered and scanned.
- Subdirectory-style tree view of crawled pages.
- Customer-friendly score cards (`0-100` + grade).
- Separate concise issue lists:
  - Lighthouse/Core Web Vitals
  - Accessibility findings
- Download links for JSON and Markdown reports.

## Scoring Model

### Lighthouse (overall + category aggregates)

Per-page overall Lighthouse score:

```text
(performance + accessibility + seo + bestPractices) / 4
```

Site aggregates:
- category means for `performance`, `accessibility`, `seo`, `bestPractices`
- overall mean from per-page overall values

Grades:
- `A`: 90-100
- `B`: 80-89
- `C`: 70-79
- `D`: 60-69
- `F`: <60

### Accessibility (dual view)

- Lighthouse Accessibility aggregate (mean category score)
- Pa11y Issue Index:
  - starts at `100`
  - severity penalties: `error=5`, `warning=2`, `notice=1`
  - normalized by scanned page count
  - clamped to `0-100`

## Crawl Defaults

- `maxPages = 50`
- `maxDepth = 2`
- `pauseMs = 1000`

Crawl strategy:
1. discover sitemaps from `robots.txt`
2. include `/sitemap.xml` fallback
3. seed crawl with sitemap URLs
4. continue same-origin link crawl within limits

## Project Layout

- `src/cli.js`: command-line scan mode
- `src/auditService.js`: core scan orchestration
- `src/server/`: API server, job store, SSE, aggregation, tree model
- `src/providers/`: scanner provider resolver (`local` / `mcp`)
- `web/`: React + Vite frontend
- `reports/`: generated scan reports
- `test/`: automated tests
- `test-results/latest.tap`: published TAP test output

## Requirements

- Node.js 18+
- Global CLI tools in `PATH`:
  - `lighthouse`
  - `pa11y`

Install scanner CLIs:

```bash
npm install -g lighthouse pa11y
```

Install project dependencies:

```bash
npm install
npm --prefix web install
```

## Run

### 1) API server

```bash
npm run start:api
```

API base: `http://localhost:3000`

### 2) Frontend UI

```bash
npm run web:dev
```

UI base: `http://localhost:5173`

### 3) CLI mode (still supported)

```bash
npm run start:cli -- https://example.com --max-pages 50 --max-depth 2 --pause-ms 1000
```

## API Endpoints

- `POST /api/scans`
- `GET /api/scans/:scanId`
- `GET /api/scans/:scanId/events` (SSE)
- `GET /api/scans/:scanId/report.json`
- `GET /api/scans/:scanId/report.md`

`POST /api/scans` body:

```json
{
  "url": "https://example.com",
  "maxPages": 50,
  "maxDepth": 2,
  "pauseMs": 1000
}
```

## Scanner Provider

- Default provider: `local`
- Optional provider: `mcp`

Environment variable:

```bash
SCANNER_PROVIDER=local
```

For `SCANNER_PROVIDER=mcp`, these env vars are required:
- `MCP_ENDPOINT`
- `MCP_LIGHTHOUSE_TOOL`
- `MCP_ACCESSIBILITY_TOOL`

## Logging

The app now emits structured logs for:
- `DEBUG`
- `INFO`
- `ERROR`
- `FATAL`

Control verbosity with `LOG_LEVEL`:

```bash
LOG_LEVEL=DEBUG npm run start:api
```

## Tests

Run tests:

```bash
npm test
```

Publish TAP artifact:

```bash
npm run test:ci
```

The artifact is written to:
- `test-results/latest.tap`

## Notes

- If a page scan fails, the run continues and records the failure in findings.
- Job state is in-memory (single-user local workflow).
