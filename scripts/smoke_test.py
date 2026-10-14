"""Checks a deployed GovVerdict API end to end, including a real Gemini call.

Usage:
  python3 scripts/smoke_test.py https://bidverdict-api-xxxx.a.run.app [NOTICE_ID] [EXTENSION_ID]

NOTICE_ID defaults to the newest active SAM.gov notice. EXTENSION_ID is only needed
after you set ALLOWED_EXTENSION_IDS. Uses one free analysis on a throwaway install ID.
"""
import json
import sys
import time
import urllib.request
import uuid

API = sys.argv[1].rstrip("/")
NOTICE = sys.argv[2] if len(sys.argv) > 2 else None
EXT = sys.argv[3] if len(sys.argv) > 3 else "abcdefghijklmnopabcdefghijklmnop"
ORIGIN = f"chrome-extension://{EXT}"
UA = {"User-Agent": "govverdict-smoke-test"}


def get(url, headers=None):
    req = urllib.request.Request(url, headers={**UA, **(headers or {})})
    with urllib.request.urlopen(req, timeout=60) as r:
        return r.status, r.read()


def post(url, body, headers=None):
    req = urllib.request.Request(url, data=json.dumps(body).encode(), method="POST",
                                 headers={**UA, "content-type": "application/json", **(headers or {})})
    try:
        with urllib.request.urlopen(req, timeout=200) as r:
            return r.status, json.loads(r.read())
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read() or b"{}")


def step(name, ok, detail=""):
    print(f"{'PASS' if ok else 'FAIL'}  {name}  {detail}")
    if not ok:
        sys.exit(1)


s, b = get(f"{API}/health")
h = json.loads(b)
step("health", s == 200 and h.get("ok"), f"store={h.get('store')} mock={h.get('mock')}")
step("mock mode off", h.get("mock") is False)
s, b = get(f"{API}/privacy")
step("privacy page", s == 200 and b"Limited Use" in b)
install = str(uuid.uuid4())
s, b = get(f"{API}/v1/me?installId={install}", {"Origin": ORIGIN})
step("account endpoint", s == 200, b.decode()[:120])

if not NOTICE:
    _, b = get("https://sam.gov/api/prod/sgs/v1/search/?index=opp&page=0&mode=search&sort=-modifiedDate&size=10&is_active=true")
    results = json.loads(b)["_embedded"]["results"]
    NOTICE = next(r["_id"] for r in results if (r.get("type") or {}).get("value") in ("Solicitation", "Combined Synopsis/Solicitation"))
_, b = get(f"https://sam.gov/api/prod/opps/v2/opportunities/{NOTICE}")
j = json.loads(b)
d = j.get("data2", {})
sol = d.get("solicitation") or {}
pop = d.get("placeOfPerformance") or {}
notice = {
    "id": NOTICE, "url": f"https://sam.gov/opp/{NOTICE}/view", "title": d.get("title"),
    "solicitationNumber": d.get("solicitationNumber"), "type": d.get("type"), "setAside": sol.get("setAside"),
    "deadline": (sol.get("deadlines") or {}).get("response"), "deadlineTz": (sol.get("deadlines") or {}).get("responseTz"),
    "naics": [c for n in d.get("naics") or [] for c in (n.get("code") or [])],
    "place": {"state": (pop.get("state") or {}).get("code"), "city": (pop.get("city") or {}).get("name")},
    "description": ((j.get("description") or [{}])[0] or {}).get("body", "")[:20000],
}
print(f"      notice: {notice['title']} ({NOTICE})")
t = time.time()
s, r = post(f"{API}/v1/analyze", {"installId": install, "notice": notice, "profile": {"naics": notice["naics"][:1], "certs": ["sb"], "states": ["ALL"]}, "files": []}, {"Origin": ORIGIN})
step("live analysis", s == 200 and r.get("result", {}).get("verdict") in ("Bid", "Consider", "No-bid", "Respond"),
     f"{time.time() - t:.1f}s model={r.get('model')} verdict={r.get('result', {}).get('verdict')} {r.get('message', '')}")
print("\n" + r["result"]["summary"])
