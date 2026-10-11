# Chrome Web Store listing: copy and paste

Replace `https://YOUR-API-URL` with your Cloud Run URL before pasting.

## Package
Upload `dist/bidverdict-1.0.0.zip` (built by `scripts/package-extension.sh`).

## Store listing tab

**Name** (comes from the manifest): BidVerdict: Federal Bid/No-Bid

**Summary** (from the manifest, 122 of 132 characters):
Bid or no-bid on any SAM.gov contract opportunity in about a minute. Reads the notice and attachments and checks your fit.

**Description:**

```
BidVerdict tells small federal contractors whether an opportunity on SAM.gov is worth bidding, in about a minute.

Open any contract opportunity on SAM.gov and click the BidVerdict icon. The side panel reads the notice and its attachments (the solicitation, the statement of work and the latest amendments), checks them against your company profile, and gives you:

• A verdict: Bid, Consider, No-bid, or Respond (for sources sought and presolicitations)
• A fit score from 0 to 100, with the reasons
• Eligibility checks from SAM.gov data: set-aside (8(a), HUBZone, SDVOSB, WOSB and more), NAICS match, response deadline and place of performance
• Key facts: contract type, period of performance, incumbent, site visit, wage determination
• A checklist of what the offer must include, with the document each item came from
• How offers will be judged, red flags, and questions to send the contracting officer
• A one-click summary to paste into an email or your pipeline tracker

HOW IT WORKS
1. Set up your company profile once: NAICS codes, certifications, the states you work in, capabilities and past performance. It is stored in your Chrome profile.
2. Open a contract opportunity on SAM.gov.
3. Check which attachments to read (sensible ones are pre-selected) and click Analyze.

PRICING
Free: 5 analyses a day. No account needed.

PRIVACY
BidVerdict only runs on sam.gov. When you click Analyze, the notice, the attachments you chose and your profile are sent to our server to be analysed with Google's Gemini models. They are not stored afterwards. Full policy: https://YOUR-API-URL/privacy

BidVerdict is an independent tool and is not affiliated with or endorsed by GSA, SAM.gov or any U.S. government agency. It gives decision support, not legal or contracting advice. Always confirm requirements in the solicitation itself.
```

When you switch on Pro, add this line under PRICING (the policy requires paid features to be disclosed):
`Pro: $14 a month for up to 60 analyses a day and a deeper model. Cancel any time.`

**Category:** Productivity → Workflow & Planning
**Language:** English (United States)

**Graphics** (all in `store/`):
| Field | File |
|---|---|
| Store icon (128×128) | `store/icon128.png` |
| Screenshots (1280×800), in this order | `store/images/screenshot-1.png` … `screenshot-5.png` |
| Small promo tile (440×280) | `store/images/promo-small-440x280.png` |
| Marquee promo tile (1400×560, optional) | `store/images/promo-marquee-1400x560.png` |

**Homepage URL:** `https://YOUR-API-URL/`
**Support URL:** `https://YOUR-API-URL/support`

## Privacy tab

**Single purpose:**
```
BidVerdict helps small businesses decide whether to bid on a U.S. federal contract opportunity they are viewing on SAM.gov, by analysing that notice and its attachments against the company profile the user enters.
```

**Permission justifications:**

| Permission | Justification |
|---|---|
| sidePanel | Shows the bid/no-bid analysis in Chrome's side panel next to the SAM.gov notice the user is reading. |
| storage | Saves the user's company profile (sync storage), an anonymous install ID used for the daily free limit, and the user's recent analyses and checklist ticks (local storage). |
| Host: https://sam.gov/* | Reads the public data and attachment list of the contract opportunity the user has open, using SAM.gov's public endpoints. Only used when the user opens the panel on a notice. |
| Host: https://iae-fbo-attachments.s3.amazonaws.com/* | SAM.gov serves public solicitation attachments from this storage host. Needed to download the documents the user chooses to analyse. |

**Are you using remote code?** No, I am not using remote code.

**Data usage:** tick **Website content**, **Location** (hashed IP address for the daily limit), **Personally identifiable information** (Pro buyer email from Paddle) and **Financial and payment information** (Pro subscription status and Paddle IDs). These match the "Data we collect" table in the privacy policy.

Then tick all three certifications:
- I do not sell or transfer user data to third parties, outside of the approved use cases
- I do not use or transfer user data for purposes that are unrelated to my item's single purpose
- I do not use or transfer user data to determine creditworthiness or for lending purposes

**Privacy policy URL:** `https://YOUR-API-URL/privacy`

## Distribution tab
- Visibility: **Public**
- Regions: **United States** to start (SAM.gov is for U.S. federal contracting). You can add more later.

## Test instructions tab (for the reviewer)
```
No login or payment is needed. The free tier allows 5 analyses per day.

1. Open https://sam.gov/search/?index=opp and click any active "Solicitation" or "Combined Synopsis/Solicitation".
2. Click the BidVerdict toolbar icon. The side panel opens and shows the notice with its attachments.
3. Optional: in the Profile tab, enter NAICS 561720, tick "Small business" and click Save profile.
4. In the Analyze tab, click "Analyze notice". The result appears in 20 to 60 seconds.

On any page that is not a SAM.gov contract opportunity, the panel shows a prompt to open one.
```
