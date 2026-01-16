import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useTranslation } from '@/hooks/useTranslation';
import { Colors, Spacing, FontSizes } from '@/constants/colors';

export default function VisitDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { translations } = useTranslation();

  const visit = {
    id,
    hospital: 'FN Bratislava',
    address: 'Antolská 11, Bratislava',
    type: 'Delivery',
    scheduledTime: '09:00',
    status: 'scheduled',
    contactPerson: 'Dr. Novak',
    notes: 'Pickup stem cell samples from ward 3B',
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Visit Details</Text>
        <TouchableOpacity style={styles.menuButton}>
          <Ionicons name="ellipsis-vertical" size={24} color={Colors.text} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        <Card style={styles.mainCard}>
          <View style={styles.hospitalHeader}>
            <View style={styles.hospitalIcon}>
              <Ionicons name="business" size={32} color={Colors.primary} />
            </View>
            <View style={styles.hospitalInfo}>
              <Text style={styles.hospitalName}>{visit.hospital}</Text>
              <Text style={styles.hospitalAddress}>{visit.address}</Text>
            </View>
          </View>

          <View style={styles.detailsGrid}>
            <View style={styles.detailItem}>
              <Ionicons name="time" size={20} color={Colors.textSecondary} />
              <Text style={styles.detailLabel}>{translations.visits.scheduledTime}</Text>
              <Text style={styles.detailValue}>{visit.scheduledTime}</Text>
            </View>
            <View style={styles.detailItem}>
              <Ionicons name="clipboard" size={20} color={Colors.textSecondary} />
              <Text style={styles.detailLabel}>{translations.visits.visitType}</Text>
              <Text style={styles.detailValue}>{visit.type}</Text>
            </View>
            <View style={styles.detailItem}>
              <Ionicons name="person" size={20} color={Colors.textSecondary} />
              <Text style={styles.detailLabel}>Contact</Text>
              <Text style={styles.detailValue}>{visit.contactPerson}</Text>
            </View>
          </View>
        </Card>

        <Card style={styles.notesCard}>
          <Text style={styles.notesTitle}>{translations.visits.notes}</Text>
          <Text style={styles.notesText}>{visit.notes}</Text>
        </Card>

        <Card style={styles.voiceNotesCard}>
          <View style={styles.voiceNotesHeader}>
            <Text style={styles.voiceNotesTitle}>{translations.visits.voiceNote}</Text>
            <TouchableOpacity style={styles.addVoiceButton} testID="button-add-voice-note">
              <Ionicons name="mic" size={20} color={Colors.white} />
            </TouchableOpacity>
          </View>
          <View style={styles.emptyVoiceNotes}>
            <Ionicons name="mic-off" size={32} color={Colors.textSecondary} />
            <Text style={styles.emptyVoiceText}>No voice notes yet</Text>
          </View>
        </Card>

        <Card style={styles.gpsCard}>
          <View style={styles.gpsHeader}>
            <Ionicons name="location" size={20} color={Colors.primary} />
            <Text style={styles.gpsTitle}>GPS Tracking</Text>
          </View>
          <Text style={styles.gpsText}>GPS tracking will start when you begin the visit</Text>
        </Card>
      </ScrollView>

      <View style={styles.footer}>
        <Button
          title={translations.visits.startVisit}
          onPress={() => {}}
          testID="button-start-visit"
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.md,
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backButton: {
    padding: Spacing.xs,
  },
  title: {
    fontSize: FontSizes.lg,
    fontWeight: '600',
    color: Colors.text,
  },
  menuButton: {
    padding: Spacing.xs,
  },
  content: {
    flex: 1,
    padding: Spacing.md,
  },
  mainCard: {
    marginBottom: Spacing.md,
  },
  hospitalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  hospitalIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  hospitalInfo: {
    flex: 1,
  },
  hospitalName: {
    fontSize: FontSizes.lg,
    fontWeight: '600',
    color: Colors.text,
  },
  hospitalAddress: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    marginTop: Spacing.xs,
  },
  detailsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  detailItem: {
    alignItems: 'center',
    flex: 1,
  },
  detailLabel: {
    fontSize: FontSizes.xs,
    color: Colors.textSecondary,
    marginTop: Spacing.xs,
  },
  detailValue: {
    fontSize: FontSizes.sm,
    fontWeight: '600',
    color: Colors.text,
    marginTop: Spacing.xs,
  },
  notesCard: {
    marginBottom: Spacing.md,
  },
  notesTitle: {
    fontSize: FontSizes.md,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: Spacing.sm,
  },
  notesText: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  voiceNotesCard: {
    marginBottom: Spacing.md,
  },
  voiceNotesHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  voiceNotesTitle: {
    fontSize: FontSizes.md,
    fontWeight: '600',
    color: Colors.text,
  },
  addVoiceButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyVoiceNotes: {
    alignItems: 'center',
    paddingVertical: Spacing.lg,
  },
  emptyVoiceText: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    marginTop: Spacing.sm,
  },
  gpsCard: {
    marginBottom: Spacing.md,
  },
  gpsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  gpsTitle: {
    fontSize: FontSizes.md,
    fontWeight: '600',
    color: Colors.text,
    marginLeft: Spacing.sm,
  },
  gpsText: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
  },
  footer: {
    padding: Spacing.md,
    backgroundColor: Colors.white,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
});
