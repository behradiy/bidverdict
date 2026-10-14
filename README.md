# GovVerdict

A Chrome extension that tells small federal contractors whether to bid on a SAM.gov contract opportunity. Open a notice on SAM.gov and the side panel does the rest:

1. reads the notice's public data and its attachments (PDF and Word);
2. runs hard eligibility rules on SAM.gov data: set-aside vs. your certifications, NAICS, deadline, place of performance;
3. asks Gemini for a verdict, a fit score, a requirements checklist, evaluation factors, red flags and questions for the contracting officer;
4. forces **No-bid** whenever a rule fails, whatever the model says.

To publish, follow **[PUBLISHING.md](PUBLISHING.md)**.

GovVerdict was called BidVerdict until 14 Oct 2026. Some technical names keep the old name on purpose, because changing them would break the published extension: the folder, the Cloud Run service `bidverdict-api` and its URL, the Google Cloud project and the `bv-*` secrets.

## How it fits together

```
Chrome side panel (extension/)
  ├─ reads https://sam.gov/api/prod/opps/v2/opportunities/{id}        notice data
  ├─ reads .../v3/opportunities/{id}/resources                         attachment list
  ├─ downloads chosen files (via iae-fbo-attachments.s3.amazonaws.com)
  └─ POST /v1/analyze  ──►  Cloud Run API (server/)
                              ├─ rules.js     deterministic eligibility checks
                              ├─ analyze.js   DOCX→text, PDFs inline → Gemini (Agent Platform), JSON schema
                              ├─ store.js     Firestore: daily quotas (TTL), licences
                              ├─ billing.js   licence keys (one per subscription)
                              ├─ paddle.js    Paddle checkout + signed webhooks (optional Pro)
                              └─ pages.js     landing, privacy, terms, refunds, support, checkout, thanks
```

- **Permissions:** `sidePanel`, `storage`, and two host permissions (sam.gov plus SAM.gov's attachment bucket). There are no content scripts, no `tabs` permission and no remote code.
- **Privacy:** the profile lives in `chrome.storage.sync`. The server stores no notice content; it keeps usage counters (auto-deleted) and, for Pro, licence records.
- **Abuse limits:** 5 free analyses a day per install and 25 per IP. Cloud Run is capped at 3 instances. CORS only accepts `chrome-extension://` origins, optionally pinned to your store ID.

## Website and demo video

The landing page (`server/src/landing.js`) shows the demo video and the Chrome Web Store screenshots and copy. Its files live in `server/public/`:
- `python3 scripts/build_site_assets.py` turns `store/images/*.png` into web images in `server/public/img/`.
- `node scripts/record_demo.mjs` records `store/shots/demo.html` (the real side panel, scripted) into `server/public/media/demo.mp4`, `demo.webm` and a poster image. It needs the harness server on :8090 and runs about 20 seconds with no audio.

## Tests

- `npm --prefix server test`: 25 tests covering the rules, quotas, licences, Paddle webhooks and signatures, the CORS guard, the API, and DOCX/PDF handling with real SAM.gov files.
- `test/harness/`: runs the real side panel in a normal tab with mocked `chrome.*` and SAM.gov fixtures.
- Also checked before shipping: the unpacked extension was loaded into a real Chrome. It pulled a live SAM.gov notice, downloaded its 4 selected attachments through the S3 redirect, and got an analysis back from the API from the extension origin.
