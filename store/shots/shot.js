// Fills shot.html from ?n=1..5 so each screenshot is one URL.
const SHOTS = {
  1: {h: 'Bid or no-bid, in about a minute.', p: 'Open any contract opportunity on SAM.gov. GovVerdict reads the notice and its attachments and checks them against your company.',
      li: ['A clear verdict with a fit score', 'Set-aside, NAICS, deadline and location checked against SAM.gov data', 'Reasons you can act on'],
      src: 'notice=sample&profile=filled&api=mock&auto=1&reset=1'},
  2: {h: 'Know exactly what the offer needs.', p: 'A compliance checklist pulled from the solicitation, the statement of work and the latest amendments.',
      li: ['Forms, page limits, references, pricing sheets', 'How offers will be judged', 'Questions to send the contracting officer'],
      src: 'notice=sample&profile=filled&api=mock&auto=1&reset=1&scroll=What%20the%20offer%20needs'},
  3: {h: 'Stop chasing contracts you can’t win.', p: 'Hard eligibility rules run before the AI does, so a set-aside you don’t qualify for is a no-bid every time.',
      li: ['8(a), HUBZone, SDVOSB, WOSB and more', 'Sole-source and closed notices flagged', 'Deadlines counted in the agency’s time zone'],
      src: 'notice=sdvosb&profile=filled&api=mock&auto=1&reset=1'},
  4: {h: 'Reads the attachments, not just the summary.', p: 'Picks the newest version of each document and the latest amendments. You can change the selection.',
      li: ['PDF and Word documents', 'Old versions and superseded amendments skipped', 'Paste in anything else, like Q&A answers'],
      src: 'notice=sample&profile=filled&api=mock&reset=1'},
  5: {h: 'Set up your company once.', p: 'NAICS codes, certifications, service area and past performance. Stored in your Chrome profile, not on our servers.',
      li: ['Every analysis is checked against your profile', 'Free: 5 analyses a day', 'No account needed'],
      src: 'notice=none&profile=filled&api=mock&reset=1&view=profile'}
};
const s = SHOTS[new URLSearchParams(location.search).get('n') || '1'];
document.getElementById('h').textContent = s.h;
document.getElementById('p').textContent = s.p;
for (const t of s.li) { const li = document.createElement('li'); li.textContent = t; document.getElementById('ul').append(li); }
document.getElementById('f').src = `/test/harness/index.html?${s.src}`;
