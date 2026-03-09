import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as SecureStore from 'expo-secure-store';
import { useTranslation } from '@/hooks/useTranslation';
import { Colors, Spacing, FontSizes } from '@/constants/colors';
import { API_BASE_URL, TOKEN_KEY } from '@/constants/config';

type ReportType = 'monthly_summary' | 'hospital_activity' | 'visit_hours' | 'call_history';
type PeriodType = 'this_month' | 'last_month' | 'last_3_months';

interface ReportCardProps {
  title: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
  reportType: ReportType;
  onDownload: (type: ReportType, period: PeriodType) => void;
  isLoading: boolean;
}

function ReportCard({ title, description, icon, reportType, onDownload, isLoading }: ReportCardProps) {
  const { translations } = useTranslation();
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodType>('this_month');

  const periods: { key: PeriodType; label: string }[] = [
    { key: 'this_month', label: translations.reports.thisMonth },
    { key: 'last_month', label: translations.reports.lastMonth },
    { key: 'last_3_months', label: translations.reports.last3Months },
  ];

  return (
    <View style={styles.reportCard}>
      <View style={styles.reportHeader}>
        <View style={styles.iconContainer}>
          <Ionicons name={icon} size={24} color={Colors.primary} />
        </View>
        <View style={styles.reportInfo}>
          <Text style={styles.reportTitle}>{title}</Text>
          <Text style={styles.reportDescription}>{description}</Text>
        </View>
      </View>

      <View style={styles.periodSelector}>
        {periods.map((period) => (
          <TouchableOpacity
            key={period.key}
            style={[
              styles.periodButton,
              selectedPeriod === period.key && styles.periodButtonActive,
            ]}
            onPress={() => setSelectedPeriod(period.key)}
          >
            <Text
              style={[
                styles.periodButtonText,
                selectedPeriod === period.key && styles.periodButtonTextActive,
              ]}
            >
              {period.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity
        style={styles.downloadButton}
        onPress={() => onDownload(reportType, selectedPeriod)}
        disabled={isLoading}
      >
        {isLoading ? (
          <ActivityIndicator size="small" color={Colors.white} />
        ) : (
          <>
            <Ionicons name="download-outline" size={20} color={Colors.white} />
            <Text style={styles.downloadButtonText}>{translations.reports.download}</Text>
          </>
        )}
      </TouchableOpacity>
    </View>
  );
}

export default function ReportsScreen() {
  const { translations } = useTranslation();
  const [loadingReport, setLoadingReport] = useState<ReportType | null>(null);

  const handleDownload = async (reportType: ReportType, period: PeriodType) => {
    setLoadingReport(reportType);

    try {
      const token = await SecureStore.getItemAsync(TOKEN_KEY);
      if (!token) {
        Alert.alert(translations.common.error, translations.reports.downloadError);
        setLoadingReport(null);
        return;
      }

      const endpoint = reportType === 'call_history'
        ? `/api/mobile/call-history/export?period=${period}`
        : `/api/mobile/reports/${reportType}?period=${period}`;

      const filename = `${reportType}_${period}_${Date.now()}.csv`;
      const fileUri = `${FileSystem.documentDirectory}${filename}`;

      const downloadResult = await FileSystem.downloadAsync(
        `${API_BASE_URL}${endpoint}`,
        fileUri,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (downloadResult.status !== 200) {
        throw new Error(`Server returned ${downloadResult.status}`);
      }

      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(downloadResult.uri, {
          mimeType: 'text/csv',
          dialogTitle: translations.reports.shareReport,
        });
      } else {
        Alert.alert(translations.reports.downloadSuccess);
      }
    } catch (error) {
      console.error('Download error:', error);
      Alert.alert(translations.common.error, translations.reports.downloadError);
    } finally {
      setLoadingReport(null);
    }
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={[Colors.primary, Colors.primaryDark, '#2A0515']}
        style={styles.headerGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <SafeAreaView edges={['top']}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>{translations.reports.title}</Text>
            <Text style={styles.headerSubtitle}>{translations.reports.subtitle}</Text>
          </View>
        </SafeAreaView>
      </LinearGradient>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <ReportCard
          title={translations.reports.monthlyVisitSummary}
          description={translations.reports.monthlyVisitSummaryDesc}
          icon="calendar-outline"
          reportType="monthly_summary"
          onDownload={handleDownload}
          isLoading={loadingReport === 'monthly_summary'}
        />

        <ReportCard
          title={translations.reports.hospitalActivity}
          description={translations.reports.hospitalActivityDesc}
          icon="business-outline"
          reportType="hospital_activity"
          onDownload={handleDownload}
          isLoading={loadingReport === 'hospital_activity'}
        />

        <ReportCard
          title={translations.reports.visitHours}
          description={translations.reports.visitHoursDesc}
          icon="time-outline"
          reportType="visit_hours"
          onDownload={handleDownload}
          isLoading={loadingReport === 'visit_hours'}
        />

        <ReportCard
          title={translations.reports.callHistory || "Call History"}
          description={translations.reports.callHistoryDesc || "Export your call history with details including duration, direction, and contact information."}
          icon="call-outline"
          reportType="call_history"
          onDownload={handleDownload}
          isLoading={loadingReport === 'call_history'}
        />

        <View style={styles.spacer} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  headerGradient: {
    paddingBottom: Spacing.lg,
  },
  header: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
  },
  headerTitle: {
    fontSize: FontSizes.xxl,
    fontWeight: '700',
    color: Colors.white,
    marginBottom: Spacing.xs,
  },
  headerSubtitle: {
    fontSize: FontSizes.md,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  content: {
    flex: 1,
    padding: Spacing.lg,
  },
  reportCard: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  reportHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: Spacing.md,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: `${Colors.primary}15`,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  reportInfo: {
    flex: 1,
  },
  reportTitle: {
    fontSize: FontSizes.lg,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 4,
  },
  reportDescription: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  periodSelector: {
    flexDirection: 'row',
    marginBottom: Spacing.md,
    gap: 8,
  },
  periodButton: {
    flex: 1,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    borderRadius: 8,
    backgroundColor: Colors.background,
    alignItems: 'center',
  },
  periodButtonActive: {
    backgroundColor: Colors.primary,
  },
  periodButtonText: {
    fontSize: FontSizes.xs,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  periodButtonTextActive: {
    color: Colors.white,
  },
  downloadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    paddingVertical: Spacing.md,
    borderRadius: 10,
    gap: 8,
  },
  downloadButtonText: {
    fontSize: FontSizes.md,
    fontWeight: '600',
    color: Colors.white,
  },
  spacer: {
    height: 100,
  },
});
