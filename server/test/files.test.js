import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {filesToParts, finalise} from '../src/analyze.js';

const fx = name => readFileSync(new URL(`../../test/fixtures/${name}`, import.meta.url));

test('real SAM.gov DOCX becomes text, PDF stays inline, junk is skipped', async () => {
  const {parts, read, skipped} = await filesToParts([
    {name: '36C26227Q0011_5.docx', mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', data: fx('solicitation-v5.docx')},
    {name: 'Amendment 0004.pdf', mime: 'application/pdf', data: fx('amendment-0004.pdf')},
    {name: 'broken.docx', mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', data: Buffer.from('not a zip')}
  ]);
  assert.deepEqual(read, ['36C26227Q0011_5.docx', 'Amendment 0004.pdf']);
  assert.equal(skipped[0].name, 'broken.docx');
  const docText = parts.find(p => p.text && p.text.includes('36C26227Q0011_5.docx')).text;
  assert.ok(docText.length > 500, 'docx text extracted');
  assert.ok(parts.some(p => p.inlineData && p.inlineData.mimeType === 'application/pdf'));
});

test('finalise clamps lists, scores and early-notice verdicts', () => {
  const raw = {verdict: 'Bid', score: 140, verdictReason: 'x', summary: 's', matches: Array(20).fill('m'), gaps: [], keyFacts: [{label: 'a', value: 'b'}, {}], requirements: [{item: 'i', source: 's'}], evaluation: [], redFlags: [], questions: []};
  const r = finalise(raw, {noticeType: {early: true}, hardStop: null}, ['doc']);
  assert.equal(r.verdict, 'Respond');
  assert.equal(r.score, 100);
  assert.equal(r.matches.length, 8);
  assert.equal(r.keyFacts.length, 1);
});
