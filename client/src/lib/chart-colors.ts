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

export const CHART_PALETTE = [
  '#6B1C3B',
  '#8B3A5B',
  '#AB587B',
  '#CB769B',
  '#EB94BB',
  '#F5D0DE',
  '#4A2030',
  '#9B2C5B',
];

export const CHART_PALETTE_EXTENDED = [
  '#6B1C3B',
  '#8B3A5B',
  '#AB587B',
  '#CB769B',
  '#EB94BB',
  '#F5D0DE',
  '#4A2030',
  '#7A3050',
  '#9B2C5B',
  '#BB4C7B',
];

export const STATUS_COLORS = {
  completed: '#6B1C3B',
  success: '#6B1C3B',
  active: '#8B3A5B',
  inProgress: '#AB587B',
  pending: '#CB769B',
  scheduled: '#EB94BB',
  cancelled: '#4A2030',
  failed: '#7A3050',
  noAnswer: '#9B2C5B',
  notInterested: '#BB4C7B',
};

export const ACTIVITY_COLORS = {
  calls: '#6B1C3B',
  voice: '#6B1C3B',
  emails: '#8B3A5B',
  sms: '#AB587B',
  sessions: '#CB769B',
};

export const COUNTRY_CHART_COLORS: Record<string, string> = {
  SK: '#6B1C3B',
  CZ: '#8B3A5B',
  HU: '#AB587B',
  RO: '#CB769B',
  IT: '#EB94BB',
  DE: '#4A2030',
  US: '#9B2C5B',
};

export function getChartColor(index: number): string {
  return CHART_PALETTE[index % CHART_PALETTE.length];
}

export function getExtendedChartColor(index: number): string {
  return CHART_PALETTE_EXTENDED[index % CHART_PALETTE_EXTENDED.length];
}

export function getCountryChartColor(countryCode: string): string {
  return COUNTRY_CHART_COLORS[countryCode] || CHART_COLORS.primary;
}
