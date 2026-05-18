import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Image, Share } from 'react-native';
import { useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useTranslation } from '@/hooks/useTranslation';
import { Colors, Spacing, FontSizes } from '@/constants/colors';
import { getItem } from '@/lib/secureStorage';
import { TOKEN_KEY, API_BASE_URL } from '@/constants/config';

type PeriodType = 'this_month' | 'last_month' | 'last_3_months';

interface ReportStats {
  period: string;
  dateRange: { from: string; to: string };
  visits: { total: number; completed: number; cancelled: number; scheduled: number };
  hospitals: { unique: number; topHospitals: { name: string; count: number }[] };
  workedHours: { totalHours: number; days: number };
  callTime: { totalMinutes: number; totalCalls: number; inbound: number; outbound: number };
}

function buildDonutSvg(percentage: number, color: string, bgColor: string, size: number, stroke: number): string {
  const r = (size - stroke) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const pct = Math.max(0, Math.min(100, percentage));

  const polarToCart = (deg: number) => ({
    x: cx + r * Math.cos(((deg - 90) * Math.PI) / 180),
    y: cy + r * Math.sin(((deg - 90) * Math.PI) / 180),
  });

  const bgStart = polarToCart(0);
  const bgEnd = polarToCart(359.99);
  const bgPath = `M ${bgStart.x.toFixed(2)} ${bgStart.y.toFixed(2)} A ${r} ${r} 0 1 1 ${bgEnd.x.toFixed(2)} ${bgEnd.y.toFixed(2)}`;

  let fgPath = '';
  if (pct >= 99.9) {
    const mid = polarToCart(180);
    fgPath = `M ${bgStart.x.toFixed(2)} ${bgStart.y.toFixed(2)} A ${r} ${r} 0 1 1 ${mid.x.toFixed(2)} ${mid.y.toFixed(2)} A ${r} ${r} 0 1 1 ${bgStart.x.toFixed(2)} ${bgStart.y.toFixed(2)}`;
  } else if (pct > 0) {
    const angle = (pct / 100) * 360;
    const start = polarToCart(0);
    const end = polarToCart(angle);
    const large = angle > 180 ? 1 : 0;
    fgPath = `M ${start.x.toFixed(2)} ${start.y.toFixed(2)} A ${r} ${r} 0 ${large} 1 ${end.x.toFixed(2)} ${end.y.toFixed(2)}`;
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    <path d="${bgPath}" stroke="${bgColor}" stroke-width="${stroke}" fill="none" stroke-linecap="round"/>
    ${fgPath ? `<path d="${fgPath}" stroke="${color}" stroke-width="${stroke}" fill="none" stroke-linecap="round"/>` : ''}
  </svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

const DONUT_SIZE = 130;
const DONUT_STROKE = 14;

function DonutCard({
  label, value, unit, subLabel, percentage, color, icon,
}: {
  label: string; value: string | number; unit?: string; subLabel: string;
  percentage: number; color: string; icon: keyof typeof Ionicons.glyphMap;
}) {
  const uri = buildDonutSvg(percentage, color, '#E8EBF0', DONUT_SIZE, DONUT_STROKE);
  return (
    <View style={styles.donutCard}>
      <View style={styles.donutWrapper}>
        <Image source={{ uri }} style={{ width: DONUT_SIZE, height: DONUT_SIZE }} />
        <View style={styles.donutCenter}>
          <Ionicons name={icon} size={16} color={color} />
          <Text style={[styles.donutValue, { color }]}>{value}</Text>
          {unit ? <Text style={styles.donutUnit}>{unit}</Text> : null}
        </View>
      </View>
      <Text style={styles.donutLabel}>{label}</Text>
      <Text style={styles.donutSub}>{subLabel}</Text>
    </View>
  );
}

function SegmentBar({ segments }: { segments: { color: string; value: number; label: string }[] }) {
  const total = segments.reduce((s, seg) => s + seg.value, 0);
  if (total === 0) return null;
  return (
    <View style={styles.segmentContainer}>
      <View style={styles.segmentBar}>
        {segments.filter(s => s.value > 0).map((seg, i) => (
          <View key={i} style={[styles.segmentFill, { flex: seg.value / total, backgroundColor: seg.color, borderRadius: i === 0 ? 4 : 0 }]} />
        ))}
      </View>
      <View style={styles.segmentLegend}>
        {segments.filter(s => s.value > 0).map((seg, i) => (
          <View key={i} style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: seg.color }]} />
            <Text style={styles.legendText}>{seg.label}: {seg.value}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

export default function ReportsScreen() {
  const { translations } = useTranslation();
  const [period, setPeriod] = useState<PeriodType>('this_month');
  const [downloading, setDownloading] = useState<string | null>(null);

  const t = translations.reports;

  const { data: stats, isLoading, error, refetch } = useQuery<ReportStats>({
    queryKey: ['/api/mobile/reports/stats', period],
    queryFn: () => api.get<ReportStats>(`/api/mobile/reports/stats?period=${period}`),
    retry: 1,
  });

  const periods: { key: PeriodType; label: string }[] = [
    { key: 'this_month', label: t?.thisMonth || 'This month' },
    { key: 'last_month', label: t?.lastMonth || 'Last month' },
    { key: 'last_3_months', label: t?.last3Months || 'Last 3 months' },
  ];

  const handleDownload = async (reportType: 'monthly_summary' | 'hospital_activity' | 'visit_hours' | 'call_history') => {
    setDownloading(reportType);
    try {
      const token = await getItem(TOKEN_KEY);
      const endpoint = reportType === 'call_history'
        ? `${API_BASE_URL}/api/mobile/call-history/export?period=${period}`
        : `${API_BASE_URL}/api/mobile/reports/${reportType}?period=${period}`;

      const response = await fetch(endpoint, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error(`Server ${response.status}`);
      const text = await response.text();
      await Share.share({
        message: text,
        title: `${reportType}_${period}`,
      });
    } catch (err: any) {
      console.error('Download error:', err);
    } finally {
      setDownloading(null);
    }
  };

  const visitsPct = stats ? (stats.visits.total > 0 ? (stats.visits.completed / stats.visits.total) * 100 : 0) : 0;
  const hospPct = stats ? Math.min((stats.hospitals.unique / 30) * 100, 100) : 0;
  const hoursPct = stats ? Math.min((stats.workedHours.totalHours / 160) * 100, 100) : 0;
  const callPct = stats ? Math.min((stats.callTime.totalMinutes / 300) * 100, 100) : 0;

  const formatHours = (h: number) => h >= 1 ? `${Math.floor(h)}h ${Math.round((h % 1) * 60)}m` : `${Math.round(h * 60)}m`;
  const formatMins = (m: number) => m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`;

  const downloadItems = [
    { key: 'monthly_summary' as const, label: t?.visitSummaryReport || 'Visit summary', icon: 'calendar-outline' as const },
    { key: 'hospital_activity' as const, label: t?.hospitalActivityReport || 'Hospital activity', icon: 'business-outline' as const },
    { key: 'visit_hours' as const, label: t?.workHoursReport || 'Working hours', icon: 'time-outline' as const },
    { key: 'call_history' as const, label: t?.callHistoryReport || 'Call history', icon: 'call-outline' as const },
  ];

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={[Colors.primary, Colors.primaryDark, '#2A0515']}
        style={styles.headerGradient}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
      >
        <SafeAreaView edges={['top']}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>{t?.title || 'Reports'}</Text>
            <View style={styles.periodRow}>
              {periods.map(p => (
                <TouchableOpacity
                  key={p.key}
                  style={[styles.periodTab, period === p.key && styles.periodTabActive]}
                  onPress={() => setPeriod(p.key)}
                  testID={`button-period-${p.key}`}
                >
                  <Text style={[styles.periodTabText, period === p.key && styles.periodTabTextActive]}>
                    {p.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            {stats && (
              <Text style={styles.dateRange}>{stats.dateRange.from} – {stats.dateRange.to}</Text>
            )}
          </View>
        </SafeAreaView>
      </LinearGradient>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {isLoading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color={Colors.primary} />
            <Text style={styles.loadingText}>{t?.loadingStats || 'Loading...'}</Text>
          </View>
        ) : error ? (
          <View style={styles.loadingBox}>
            <Ionicons name="alert-circle-outline" size={40} color={Colors.error} />
            <Text style={styles.loadingText}>{translations.common.error}: {(error as any)?.message || ''}</Text>
            <TouchableOpacity style={styles.retryBtn} onPress={() => refetch()}>
              <Text style={styles.retryBtnText}>{translations.common.retry}</Text>
            </TouchableOpacity>
          </View>
        ) : stats ? (
          <>
            <View style={styles.donutGrid}>
              <DonutCard
                label={t?.visitsLabel || 'Visits'}
                value={stats.visits.total}
                subLabel={`${stats.visits.completed} ${t?.completedOf || ''}`}
                percentage={visitsPct}
                color="#6B1C3B"
                icon="calendar"
              />
              <DonutCard
                label={t?.hospitalsLabel || 'Hospitals'}
                value={stats.hospitals.unique}
                subLabel={t?.uniqueLabel || 'unique'}
                percentage={hospPct}
                color="#0EA5E9"
                icon="business"
              />
              <DonutCard
                label={t?.workHoursLabel || 'Work hours'}
                value={formatHours(stats.workedHours.totalHours)}
                subLabel={`${stats.workedHours.days} ${t?.daysLabel || 'days'}`}
                percentage={hoursPct}
                color="#10B981"
                icon="time"
              />
              <DonutCard
                label={t?.callTimeLabel || 'Call time'}
                value={formatMins(stats.callTime.totalMinutes)}
                subLabel={`${stats.callTime.totalCalls} ${t?.callsLabel || 'calls'}`}
                percentage={callPct}
                color="#F59E0B"
                icon="call"
              />
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{t?.visitBreakdown || 'Visit Breakdown'}</Text>
              <SegmentBar segments={[
                { color: '#10B981', value: stats.visits.completed, label: t?.completedVisits || 'Completed' },
                { color: '#F59E0B', value: stats.visits.scheduled, label: t?.plannedVisits || 'Planned' },
                { color: '#EF4444', value: stats.visits.cancelled, label: t?.cancelledVisits || 'Cancelled' },
              ]} />
            </View>

            {stats.hospitals.topHospitals.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>{t?.topHospitals || 'Top Hospitals'}</Text>
                {stats.hospitals.topHospitals.map((h, i) => (
                  <View key={i} style={styles.topHospRow}>
                    <View style={[styles.topHospRank, { backgroundColor: i === 0 ? Colors.primary : Colors.background }]}>
                      <Text style={[styles.topHospRankText, { color: i === 0 ? Colors.white : Colors.textSecondary }]}>
                        {i + 1}
                      </Text>
                    </View>
                    <Text style={styles.topHospName} numberOfLines={1}>{h.name}</Text>
                    <View style={styles.topHospBar}>
                      <View style={[styles.topHospFill, {
                        width: `${(h.count / stats.hospitals.topHospitals[0].count) * 100}%`,
                      }]} />
                    </View>
                    <Text style={styles.topHospCount}>{h.count}</Text>
                  </View>
                ))}
              </View>
            )}

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{t?.downloadCsv || 'Download CSV'}</Text>
              <View style={styles.downloadGrid}>
                {downloadItems.map(r => (
                  <TouchableOpacity
                    key={r.key}
                    style={styles.downloadBtn}
                    onPress={() => handleDownload(r.key)}
                    disabled={downloading !== null}
                    testID={`button-download-${r.key}`}
                  >
                    {downloading === r.key ? (
                      <ActivityIndicator size="small" color={Colors.primary} />
                    ) : (
                      <Ionicons name={r.icon} size={22} color={Colors.primary} />
                    )}
                    <Text style={styles.downloadBtnText}>{r.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </>
        ) : null}
        <View style={styles.spacer} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F4F6FA' },
  headerGradient: { paddingBottom: Spacing.lg },
  header: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.sm },
  headerTitle: { fontSize: FontSizes.xxl, fontWeight: '700', color: Colors.white, marginBottom: Spacing.sm },
  periodRow: { flexDirection: 'row', gap: 8, marginBottom: Spacing.sm },
  periodTab: {
    flex: 1, paddingVertical: 8, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center',
  },
  periodTabActive: { backgroundColor: 'rgba(255,255,255,0.95)' },
  periodTabText: { fontSize: FontSizes.sm, color: 'rgba(255,255,255,0.85)', fontWeight: '600' },
  periodTabTextActive: { color: Colors.primary },
  dateRange: { fontSize: FontSizes.xs, color: 'rgba(255,255,255,0.65)', textAlign: 'center', marginBottom: 4 },
  content: { flex: 1 },
  loadingBox: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60, gap: Spacing.md },
  loadingText: { fontSize: FontSizes.md, color: Colors.textSecondary },
  donutGrid: {
    flexDirection: 'row', flexWrap: 'wrap', padding: Spacing.md, gap: 12,
  },
  donutCard: {
    width: '47%', backgroundColor: Colors.white, borderRadius: 16,
    padding: Spacing.md, alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07, shadowRadius: 6, elevation: 3,
  },
  donutWrapper: { position: 'relative', width: DONUT_SIZE, height: DONUT_SIZE, marginBottom: 8 },
  donutCenter: {
    position: 'absolute',
    top: DONUT_STROKE + 4, left: DONUT_STROKE + 4,
    width: DONUT_SIZE - (DONUT_STROKE + 4) * 2,
    height: DONUT_SIZE - (DONUT_STROKE + 4) * 2,
    justifyContent: 'center', alignItems: 'center',
  },
  donutValue: { fontSize: 18, fontWeight: '800', lineHeight: 22 },
  donutUnit: { fontSize: 10, color: Colors.textSecondary, fontWeight: '500' },
  donutLabel: { fontSize: FontSizes.sm, fontWeight: '700', color: Colors.text, textAlign: 'center' },
  donutSub: { fontSize: FontSizes.xs, color: Colors.textSecondary, textAlign: 'center', marginTop: 2 },
  section: {
    backgroundColor: Colors.white, marginHorizontal: Spacing.md, marginBottom: Spacing.md,
    borderRadius: 16, padding: Spacing.md,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 2,
  },
  sectionTitle: { fontSize: FontSizes.md, fontWeight: '700', color: Colors.text, marginBottom: Spacing.sm },
  segmentContainer: { gap: 8 },
  segmentBar: { height: 12, borderRadius: 6, overflow: 'hidden', flexDirection: 'row', backgroundColor: '#F0F0F0' },
  segmentFill: { height: '100%' },
  segmentLegend: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { fontSize: FontSizes.xs, color: Colors.text },
  topHospRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  topHospRank: { width: 26, height: 26, borderRadius: 13, justifyContent: 'center', alignItems: 'center' },
  topHospRankText: { fontSize: FontSizes.xs, fontWeight: '700' },
  topHospName: { flex: 1, fontSize: FontSizes.sm, color: Colors.text },
  topHospBar: { width: 60, height: 6, borderRadius: 3, backgroundColor: '#E8EBF0', overflow: 'hidden' },
  topHospFill: { height: '100%', borderRadius: 3, backgroundColor: Colors.primary },
  topHospCount: { width: 24, fontSize: FontSizes.sm, fontWeight: '700', color: Colors.primary, textAlign: 'right' },
  downloadGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  downloadBtn: {
    width: '47%', backgroundColor: '#F4F6FA', borderRadius: 12, paddingVertical: 14,
    alignItems: 'center', gap: 8, borderWidth: 1, borderColor: '#E0E5EF',
  },
  downloadBtnText: { fontSize: FontSizes.xs, fontWeight: '600', color: Colors.text, textAlign: 'center' },
  spacer: { height: 100 },
  retryBtn: { marginTop: 12, backgroundColor: Colors.primary, paddingVertical: 10, paddingHorizontal: 28, borderRadius: 10 },
  retryBtnText: { color: Colors.white, fontSize: FontSizes.md, fontWeight: '700' },
});
