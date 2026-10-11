// Display labels. The server's rules.js holds the authoritative eligibility logic.

export const CERTS = [
  ['sb', 'Small business'],
  ['8a', '8(a)'],
  ['hubzone', 'HUBZone'],
  ['sdvosb', 'Service-disabled veteran-owned (SDVOSB)'],
  ['vosb', 'Veteran-owned (VOSB)'],
  ['wosb', 'Women-owned (WOSB)'],
  ['edwosb', 'Economically disadvantaged women-owned (EDWOSB)'],
  ['iee', 'Indian Economic Enterprise']
];

export const SET_ASIDES = {
  SBA: 'Total small business',
  SBP: 'Partial small business',
  '8A': '8(a) set-aside',
  '8AN': '8(a) sole source',
  HZC: 'HUBZone set-aside',
  HZS: 'HUBZone sole source',
  SDVOSBC: 'SDVOSB set-aside',
  SDVOSBS: 'SDVOSB sole source',
  WOSB: 'WOSB set-aside',
  WOSBSS: 'WOSB sole source',
  EDWOSB: 'EDWOSB set-aside',
  EDWOSBSS: 'EDWOSB sole source',
  VSA: 'Veteran-owned set-aside (VA)',
  VSS: 'Veteran-owned sole source (VA)',
  IEE: 'Indian Economic Enterprise',
  ISBEE: 'Indian small business',
  BICiv: 'Buy Indian',
  LAS: 'Local area set-aside'
};

export const NOTICE_TYPES = {
  o: 'Solicitation',
  k: 'Combined synopsis/solicitation',
  g: 'Sale of surplus property',
  p: 'Presolicitation',
  r: 'Sources sought',
  s: 'Special notice',
  i: 'Intent to bundle',
  a: 'Award notice',
  u: 'Justification',
  j: 'Justification'
};
