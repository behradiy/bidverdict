# Publishing GovVerdict tonight

Everything in this folder is built and tested. What's left needs your accounts and payment details, so you do these steps. Plan on about 1.5 hours of hands-on time, then the Chrome Web Store review, which you don't control (see step 7).

```
bidverdict/
  extension/   the Chrome extension (Manifest V3, side panel)
  server/      the API for Cloud Run (Express + Gemini + Firestore + Paddle)
  scripts/     deploy.sh, package-extension.sh, smoke_test.py, make_icons.py
  store/       listing text, icon, 5 screenshots, promo tiles
  test/        SAM.gov fixtures and a browser harness for the side panel
```

---

## 1. Make a separate Google Cloud project (10 min)

Your gcloud login can reach several **work** projects. Keep GovVerdict out of them: give it its own project and, ideally, its own gcloud configuration.

```bash
gcloud config configurations create bidverdict
```
```bash
gcloud auth login
```
```bash
gcloud billing accounts list
```

Pick your **personal** billing account ID from that list (format `01ABCD-23EF45-6789AB`). A new account gets the $300 free-trial credit, and that credit covers Gemini when it's called through Agent Platform, as this server does.

## 2. Deploy the API (10–15 min)

From the `bidverdict` folder, replace the values and run:

```bash
CREATE_PROJECT=1 BILLING_ACCOUNT=01ABCD-23EF45-6789AB BUDGET_USD=50 PROJECT_ID=bidverdict-yourname SUPPORT_EMAIL=you@yourdomain.com OPERATOR_NAME="Your Name" ./scripts/deploy.sh
```

It creates the project, links billing, enables the APIs, and creates Firestore with an auto-expiry rule for usage counters. It also creates a locked-down service account and an IP-hash salt in Secret Manager, deploys to Cloud Run (max 3 instances), and adds a $50 budget alert. At the end it prints your **API URL**.

Then set a hard spend cap. Budgets only send emails; spend caps actually pause services. In the console, go to **Billing → Budgets & alerts → Create budget → Spend cap**. Cover the Gemini API, Agent Platform and Cloud Run in the GovVerdict project, at about $25 a month to start.

Check that it works end to end. This makes one real Gemini call on a live SAM.gov notice:

```bash
python3 scripts/smoke_test.py https://YOUR-API-URL
```

Open `https://YOUR-API-URL/privacy` and read it. That page is the privacy policy the store links to.

## 3. Build the extension and try it in your own Chrome (10 min)

```bash
./scripts/package-extension.sh https://YOUR-API-URL
```

This writes `dist/extension/` (your API URL baked in) and `dist/govverdict-1.1.0.zip`.

1. Open `chrome://extensions`, turn on **Developer mode**, click **Load unpacked**, and choose `bidverdict/dist/extension`.
2. Pin GovVerdict, open any active solicitation on [sam.gov](https://sam.gov/search/?index=opp), and click the icon.
3. Fill in the **Profile** tab with real NAICS codes and certifications, then **Analyze** two or three notices. Read the verdicts critically. This is the product.

## 4. Chrome Web Store developer account (10 min)

1. Use a Google account you're happy to own this publicly (a personal one, not a work one), and turn on **2-Step Verification** for it.
2. Go to the [Developer Dashboard](https://chrome.google.com/webstore/devconsole), accept the agreement and pay the one-time **$5** registration fee.
3. Fill in the account page: publisher name, contact email (verify it), and the **trader / non-trader** declaration. If you'll charge for Pro, you're a trader. That shows your verified address and phone to EU users, which is one more reason to start with U.S.-only distribution.

New publishers can have at most two published items. That's fine here.

## 5. Create the listing (20–30 min)

In the dashboard, click **Add new item** and upload `dist/govverdict-1.1.0.zip`. Then fill in each tab, copying from **`store/listing.md`**:

- **Store listing:** description, category (Productivity → Workflow & Planning), language, the icon, 5 screenshots and the small promo tile, plus homepage and support URLs. All files are in `store/`.
- **Privacy:** single purpose, one justification per permission, "No remote code", data usage ("Website content"), the three certifications, and the privacy policy URL.
- **Distribution:** Public, United States.
- **Test instructions:** paste the reviewer steps. No login is needed, so the reviewer can test with the free tier.

Copy the **item ID** from the dashboard URL (32 letters). You'll need it in step 8.

## 6. Submit (2 min)

Click **Submit for review** and leave **"Publish automatically after review"** ticked. If you'd rather choose the moment, untick it; you then have 30 days after approval to publish.

Keep the API running while it's in review. Reviewers reject extensions whose server is down (“Yellow Magnesium”).

## 7. Review: the part tonight can't control

Google says reviews take "a few days, up to a few weeks". In April 2026 they warned of a backlog, and developers reported 28–30-day waits. These help:
- Narrow permissions. This extension asks only for `sidePanel`, `storage` and two specific hosts: no `<all_urls>`, no `tabs`, no `scripting`.
- No remote code, a privacy policy with the Limited Use statement, and a free path the reviewer can test.

If it's rejected, the email names a code (for example "Purple Potassium" means excess permissions). Fix that one thing, bump `version` in `extension/manifest.json`, re-package, and resubmit.

## 8. After approval (5 min)

Lock the API to your published extension and put the install link on the landing page. Re-run deploy with two extra variables (it skips setup that's already done):

```bash
YES=1 PROJECT_ID=bidverdict-yourname SUPPORT_EMAIL=you@yourdomain.com OPERATOR_NAME="Your Name" ALLOWED_EXTENSION_IDS=yourstoreitemid CHROME_STORE_URL=https://chromewebstore.google.com/detail/yourstoreitemid ./scripts/deploy.sh
```

To keep testing your unpacked copy as well, add its ID from `chrome://extensions` to the list (comma-separated).

`deploy.sh` sets every server setting on each run, so always repeat the variables you set before: the extension IDs, the store URL and, once you add Pro, the Paddle settings and `OPERATOR_NAME`. A variable you leave out is switched off.

---

## Optional: switch on Pro ($14/month) with Paddle

Paddle is the merchant of record: it sells Pro to the customer, collects payment, handles sales tax and VAT, and pays you out. Stripe isn't available in Oman; Paddle onboards sellers from most countries, but confirm Oman during signup. Fee: 5% + $0.50 per payment (about $1.20 on $14).

The extension doesn't change. Once the server has Paddle settings, the Upgrade button appears in the Account tab and opens `https://YOUR-API-URL/checkout`.

**Before you apply.** Paddle reviews your website. It must show the product, the price, terms, a refund policy and a privacy policy, all with your legal name. The server already serves `/`, `/terms`, `/refunds` and `/privacy`. Set your legal name on them by redeploying with `OPERATOR_NAME="Your Legal Name"`.

**1. Build it in the sandbox first** at [sandbox-vendors.paddle.com](https://sandbox-vendors.paddle.com):
1. **Catalog → Products:** create *GovVerdict Pro* with a price of $14, billed monthly. Copy the price ID (`pri_…`).
2. **Developer tools → Authentication:** create an API key (`pdl_sdbx_apikey_…`) and a client-side token (`test_…`).
3. **Developer tools → Notifications → New destination:**
   - URL: `https://YOUR-API-URL/paddle/webhook`
   - Events: `transaction.completed`, `subscription.updated`, `subscription.canceled`, `subscription.paused`, `subscription.past_due`

   Copy the secret key.
4. **Checkout → Checkout settings:** set the default payment link to `https://YOUR-API-URL/checkout`.
5. **Checkout → Customer portal:** copy the portal link.
6. Store the two secrets, then redeploy with the public settings:
   ```bash
   printf '%s' 'pdl_sdbx_apikey_...' | gcloud --project=bidverdict-yourname secrets create bv-paddle-api-key --data-file=-
   ```
   ```bash
   printf '%s' 'pdl_ntfset_...' | gcloud --project=bidverdict-yourname secrets create bv-paddle-webhook-secret --data-file=-
   ```
   ```bash
   YES=1 PROJECT_ID=bidverdict-yourname SUPPORT_EMAIL=you@yourdomain.com OPERATOR_NAME="Your Legal Name" PADDLE_ENV=sandbox PADDLE_CLIENT_TOKEN=test_... PADDLE_PRICE_ID=pri_... PADDLE_PORTAL_URL=https://customer-portal.paddle.com/cpl_... PRO_PRICE_LABEL='$14 a month' ./scripts/deploy.sh
   ```
7. **Test it.** In the extension's Account tab click **Upgrade to Pro** and pay with Paddle's test card `4242 4242 4242 4242` (any future date, CVC `100`). You should land on the thank-you page with a licence key, and the Account tab shows Pro after **Refresh**. Then cancel in the sandbox and check it drops back to Free.

**2. Go live.** Sign up at [vendors.paddle.com](https://vendors.paddle.com) and complete seller verification. Add your API domain under **Checkout → Website approval** and wait for approval. Repeat steps 1–6 in the live account, then:
- use `secrets versions add` instead of `secrets create` to replace the two secrets;
- redeploy with `PADDLE_ENV=production` and the live token, price ID and portal link.

Finally, add the Pro line from `store/listing.md` to your store description.

**Operating it.** When you refund someone in Paddle, cancel their subscription at the same time; that's what the refund policy promises, and the cancellation is what switches Pro off. Licence and payment records stay in Firestore until someone asks you to delete them.

## What it costs to run

| Item | Cost |
|---|---|
| Chrome Web Store registration | $5 once |
| Cloud Run, Firestore, Secret Manager | $0 at launch volumes (free tiers) |
| Gemini 3.5 Flash-Lite (free tier users) | about $0.01–0.03 per analysis |
| Gemini 3.8 Flash (Pro users) | about $0.03–0.10 per analysis; Google doubles 3.8 Flash prices on 1 Jan 2027 |
| Worst case per free user | 5 analyses a day, also capped at 25 per IP address a day |

Model names are environment variables (`MODEL_FREE`, `MODEL_PRO`). If Google retires one, redeploy with the new name; no extension update is needed.

## Local development

```bash
npm --prefix server install
```
```bash
npm --prefix server test
```
```bash
npm --prefix server run dev
```

`run dev` starts a mock-AI API on :8787. In another terminal, serve the folder and open the harness:

```bash
python3 -m http.server 8090 --bind 127.0.0.1
```

Then open http://localhost:8090/test/harness/index.html?notice=linen&profile=filled to run the real side-panel code against SAM.gov fixtures. Add `&api=mock` to skip the API, or use `notice=sample` or `notice=sdvosb` for other scenarios.
