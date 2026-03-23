export const CHART_COLORS = {
  primary: '#6B1C3B',
  primaryLight: '#8B3A5B',
  primaryLighter: '#AB587B',
  primaryLightest: '#CB769B',
  primaryPale: '#EB94BB',
  primaryPalest: '#F5D0DE',
  
  secondary: '#4A2030',
  secondaryLight: '#7A3050',
  
  accent: '#9B2C5B',
  accentLight: '#BB4C7B',
  
  neutral: '#8B7355',
  neutralLight: '#AB9375',
  neutralLighter: '#CBB395',
  neutralLightest: '#EBD3B5',
};

export const PASTEL_CHART_COLORS = [
  '#F9A8D4',
  '#93C5FD',
  '#86EFAC',
  '#FCD34D',
  '#C4B5FD',
  '#FCA5A5',
  '#67E8F9',
  '#FDBA74',
  '#A5B4FC',
  '#6EE7B7',
];

export const CHART_PALETTE = [
  '#F9A8D4',
  '#93C5FD',
  '#86EFAC',
  '#FCD34D',
  '#C4B5FD',
  '#FCA5A5',
  '#67E8F9',
  '#FDBA74',
];

export const CHART_PALETTE_EXTENDED = [
  '#F9A8D4',
  '#93C5FD',
  '#86EFAC',
  '#FCD34D',
  '#C4B5FD',
  '#FCA5A5',
  '#67E8F9',
  '#FDBA74',
  '#A5B4FC',
  '#6EE7B7',
];

export const STATUS_COLORS = {
  completed: '#86EFAC',
  success: '#86EFAC',
  active: '#93C5FD',
  inProgress: '#FCD34D',
  pending: '#FDBA74',
  scheduled: '#C4B5FD',
  cancelled: '#FCA5A5',
  failed: '#FCA5A5',
  noAnswer: '#F9A8D4',
  notInterested: '#67E8F9',
};

export const ACTIVITY_COLORS = {
  calls: '#F9A8D4',
  voice: '#F9A8D4',
  emails: '#93C5FD',
  sms: '#86EFAC',
  sessions: '#FCD34D',
};

export const COUNTRY_CHART_COLORS: Record<string, string> = {
  SK: '#F9A8D4',
  CZ: '#93C5FD',
  HU: '#86EFAC',
  RO: '#FCD34D',
  IT: '#C4B5FD',
  DE: '#67E8F9',
  US: '#FDBA74',
  AT: '#A5B4FC',
  PL: '#6EE7B7',
};

export function getChartColor(index: number): string {
  return CHART_PALETTE[index % CHART_PALETTE.length];
}

export function getExtendedChartColor(index: number): string {
  return CHART_PALETTE_EXTENDED[index % CHART_PALETTE_EXTENDED.length];
}

export function getCountryChartColor(countryCode: string): string {
  return COUNTRY_CHART_COLORS[countryCode] || PASTEL_CHART_COLORS[0];
}
