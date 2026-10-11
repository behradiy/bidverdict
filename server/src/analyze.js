import {GoogleGenAI, Type} from '@google/genai';
import mammoth from 'mammoth';

const SYSTEM = `You are an experienced federal capture manager. A small business is looking at one U.S. federal contract opportunity from SAM.gov and needs a fast, honest bid/no-bid call.

You receive: the notice's structured data and description, its attachments, the company's profile, and deterministic CHECKS computed from SAM.gov data. The CHECKS are authoritative.

Rules:
- Use only facts found in the notice or attachments. If something isn't stated, write "Not stated". Never invent dates, dollar values, incumbents or requirements.
- If CHECKS.hardStop is present, the verdict MUST be "No-bid" and the score at most 15.
- Verdicts: "Bid" = eligible, strong fit, enough time. "Consider" = eligible but with real gaps or risks to resolve. "No-bid" = ineligible, missing a mandatory qualification, or a poor fit. "Respond" = sources sought, presolicitation or special notice, where the right move is a capability statement rather than a proposal.
- score is the fit from 0 to 100, reflecting the profile against scope, NAICS, set-aside, location, size, clearance and past performance.
- requirements: concrete things the offer must include or the bidder must hold (forms such as SF 1449, SAM registration, licences, insurance, bonding, clearances, past performance references, page limits, pricing sheets, submission method). Put the document name in "source".
- Later amendments override earlier documents. Use the latest dates.
- Plain English. Each list item 25 words or fewer. At most 8 items per list.`;

const SCHEMA = {
  type: Type.OBJECT,
  properties: {
    verdict: {type: Type.STRING, enum: ['Bid', 'Consider', 'No-bid', 'Respond']},
    score: {type: Type.INTEGER},
    verdictReason: {type: Type.STRING, description: 'One sentence explaining the verdict.'},
    summary: {type: Type.STRING, description: 'Two sentences: what the government is buying, for whom, where.'},
    matches: {type: Type.ARRAY, items: {type: Type.STRING}, description: 'Where the company fits.'},
    gaps: {type: Type.ARRAY, items: {type: Type.STRING}, description: 'Where the company falls short or must verify.'},
    keyFacts: {
      type: Type.ARRAY,
      description: 'Contract type, period of performance, estimated value, incumbent, questions due date, site visit, wage determination, submission method, evaluation basis. Use "Not stated" when absent.',
      items: {type: Type.OBJECT, properties: {label: {type: Type.STRING}, value: {type: Type.STRING}}, required: ['label', 'value']}
    },
    requirements: {
      type: Type.ARRAY,
      items: {type: Type.OBJECT, properties: {item: {type: Type.STRING}, source: {type: Type.STRING}}, required: ['item', 'source']}
    },
    evaluation: {type: Type.ARRAY, items: {type: Type.STRING}, description: 'Evaluation factors, most important first.'},
    redFlags: {type: Type.ARRAY, items: {type: Type.STRING}},
    questions: {type: Type.ARRAY, items: {type: Type.STRING}, description: 'Questions worth sending to the contracting officer before the Q&A deadline.'},
    documentsRead: {type: Type.ARRAY, items: {type: Type.STRING}}
  },
  required: ['verdict', 'score', 'verdictReason', 'summary', 'matches', 'gaps', 'keyFacts', 'requirements', 'evaluation', 'redFlags', 'questions', 'documentsRead']
};

const MAX_DOC_CHARS = 150000;

let client = null;
function getClient() {
  if (client) return client;
  if (process.env.GEMINI_API_KEY) client = new GoogleGenAI({apiKey: process.env.GEMINI_API_KEY});
  else client = new GoogleGenAI({vertexai: true, project: process.env.GOOGLE_CLOUD_PROJECT, location: process.env.GOOGLE_CLOUD_LOCATION || 'global'});
  return client;
}

// files: [{name, mime, data: Buffer}] -> Gemini parts + list of what was read / skipped
export async function filesToParts(files) {
  const parts = [], read = [], skipped = [];
  let textBudget = MAX_DOC_CHARS;
  for (const f of files) {
    try {
      if (f.mime === 'application/pdf') {
        parts.push({text: `\n=== ATTACHMENT: ${f.name} (PDF) ===`});
        parts.push({inlineData: {mimeType: 'application/pdf', data: f.data.toString('base64')}});
        read.push(f.name);
      } else if (f.mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || f.mime === 'text/plain') {
        const text = f.mime === 'text/plain' ? f.data.toString('utf8') : (await mammoth.extractRawText({buffer: f.data})).value;
        const clipped = text.replace(/\n{3,}/g, '\n\n').slice(0, Math.max(0, textBudget));
        if (!clipped.trim()) { skipped.push({name: f.name, why: textBudget <= 0 ? 'text budget used up' : 'no readable text'}); continue; }
        textBudget -= clipped.length;
        parts.push({text: `\n=== ATTACHMENT: ${f.name} ===\n${clipped}`});
        read.push(f.name);
      } else {
        skipped.push({name: f.name, why: 'unsupported file type'});
      }
    } catch (e) {
      skipped.push({name: f.name, why: 'could not be read'});
    }
  }
  return {parts, read, skipped};
}

function clampList(a, n = 8) {
  return (Array.isArray(a) ? a : []).filter(Boolean).slice(0, n);
}

export function finalise(raw, checks, read) {
  const r = {...raw};
  r.verdict = ['Bid', 'Consider', 'No-bid', 'Respond'].includes(r.verdict) ? r.verdict : 'Consider';
  r.score = Math.max(0, Math.min(100, Math.round(Number(r.score) || 0)));
  if (checks.noticeType && checks.noticeType.early && r.verdict === 'Bid') r.verdict = 'Respond';
  if (checks.hardStop) {
    r.verdict = 'No-bid';
    r.score = Math.min(r.score, 15);
    r.verdictReason = checks.hardStop.reason;
  }
  for (const k of ['matches', 'gaps', 'evaluation', 'redFlags', 'questions']) r[k] = clampList(r[k]);
  r.keyFacts = clampList(r.keyFacts, 10).filter(f => f && f.label);
  r.requirements = clampList(r.requirements, 12).filter(x => x && x.item);
  r.documentsRead = read;
  return r;
}

export async function analyze({notice, profile, checks, files = [], pasted = '', model}) {
  const {parts: docParts, read, skipped} = await filesToParts(files);
  const context = {
    today: new Date().toISOString().slice(0, 10),
    CHECKS: checks,
    PROFILE: profile,
    NOTICE: notice
  };
  const parts = [{text: 'CONTEXT (JSON):\n' + JSON.stringify(context)}, ...docParts];
  if (pasted) parts.push({text: '\n=== TEXT PASTED BY THE USER ===\n' + pasted.slice(0, 60000)});
  parts.push({text: '\nReturn the bid/no-bid analysis as JSON.'});

  if (process.env.MOCK_AI === '1') {
    return {result: finalise(mockResult(notice, checks), checks, read.length ? read : ['(description only)']), skipped, usage: {mock: true}};
  }

  const res = await getClient().models.generateContent({
    model,
    contents: [{role: 'user', parts}],
    config: {systemInstruction: SYSTEM, responseMimeType: 'application/json', responseSchema: SCHEMA, temperature: 0.2, maxOutputTokens: 6000}
  });
  let raw;
  try { raw = JSON.parse(res.text); } catch { throw new Error('Model returned malformed JSON'); }
  const u = res.usageMetadata || {};
  return {result: finalise(raw, checks, read.length ? read : ['(description only)']), skipped, usage: {in: u.promptTokenCount, out: u.candidatesTokenCount}};
}

function mockResult(notice, checks) {
  return {
    verdict: 'Consider',
    score: 68,
    verdictReason: 'You match the NAICS code and set-aside, but the 4-hour turnaround needs a local processing plant.',
    summary: `The agency is buying ${notice.title || 'services'} under a ${checks.noticeType.label.toLowerCase()}. Work is performed at the listed facility.`,
    matches: ['Exact NAICS match (812320)', 'Total small business set-aside and you are a small business', 'Arizona is in your service area'],
    gaps: ['No past performance with a VA medical center listed', 'Requires a 96-hour contingency linen inventory'],
    keyFacts: [
      {label: 'Contract type', value: 'Firm-fixed-price, requirements'},
      {label: 'Period of performance', value: 'Base year plus four option years'},
      {label: 'Estimated value', value: 'Not stated'},
      {label: 'Questions due', value: 'Not stated'}
    ],
    requirements: [
      {item: 'Signed SF 1449 and all amendment acknowledgements', source: 'Amendment 0004'},
      {item: 'Active SAM registration under NAICS 812320', source: 'Solicitation'},
      {item: 'Completed price schedule for every line item', source: 'Solicitation'}
    ],
    evaluation: ['Technical capability', 'Past performance', 'Price'],
    redFlags: ['Deadline was extended once; watch for further amendments'],
    questions: ['Is there an incumbent, and what is the current monthly poundage?'],
    documentsRead: []
  };
}
