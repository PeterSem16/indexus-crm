import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { useState, useEffect } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useTranslation } from '@/hooks/useTranslation';
import { useVisit, useStartVisit, useEndVisit } from '@/hooks/useVisits';
import { Colors, Spacing, FontSizes } from '@/constants/colors';

export default function VisitDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { translations } = useTranslation();
  const { data: visit, isLoading, refetch } = useVisit(id || '');
  const startVisitMutation = useStartVisit();
  const endVisitMutation = useEndVisit();
  
  const [isGettingLocation, setIsGettingLocation] = useState(false);

  const getLocation = async (): Promise<{ latitude: number; longitude: number } | null> => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Location permission is required');
        return null;
      }
      
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      
      return {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      };
    } catch (error) {
      Alert.alert('Error', 'Failed to get location');
      return null;
    }
  };

  const handleStartVisit = async () => {
    if (!visit?.id) return;
    
    setIsGettingLocation(true);
    const location = await getLocation();
    setIsGettingLocation(false);
    
    if (!location) return;
    
    try {
      await startVisitMutation.mutateAsync({
        id: visit.id,
        latitude: location.latitude,
        longitude: location.longitude,
      });
      refetch();
      Alert.alert('Success', 'Visit started');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to start visit');
    }
  };

  const handleEndVisit = async () => {
    if (!visit?.id) return;
    
    Alert.alert(
      'End Visit',
      'Are you sure you want to end this visit?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'End Visit',
          style: 'destructive',
          onPress: async () => {
            setIsGettingLocation(true);
            const location = await getLocation();
            setIsGettingLocation(false);
            
            if (!location) return;
            
            try {
              await endVisitMutation.mutateAsync({
                id: visit.id,
                latitude: location.latitude,
                longitude: location.longitude,
              });
              refetch();
              Alert.alert('Success', 'Visit completed');
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Failed to end visit');
            }
          },
        },
      ]
    );
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return Colors.success;
      case 'in_progress': return Colors.warning;
      case 'cancelled': return Colors.error;
      case 'not_realized': return Colors.textSecondary;
      default: return Colors.info;
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'completed': return 'Completed';
      case 'in_progress': return 'In Progress';
      case 'cancelled': return 'Cancelled';
      case 'not_realized': return 'Not Realized';
      case 'scheduled': return 'Scheduled';
      default: return status;
    }
  };

  const formatTime = (dateString: string | undefined) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (dateString: string | undefined) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('sk-SK', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (!visit) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="chevron-back" size={24} color={Colors.text} />
          </TouchableOpacity>
          <Text style={styles.title}>Visit Details</Text>
          <View style={styles.menuButton} />
        </View>
        <View style={styles.loadingContainer}>
          <Ionicons name="alert-circle-outline" size={64} color={Colors.textSecondary} />
          <Text style={styles.errorText}>Visit not found</Text>
          <Button title="Go Back" onPress={() => router.back()} style={styles.errorButton} />
        </View>
      </SafeAreaView>
    );
  }

  const status = visit.status || 'scheduled';
  const isInProgress = status === 'in_progress';
  const isCompleted = status === 'completed';
  const isScheduled = status === 'scheduled';
  const isCancelled = status === 'cancelled';
  const isNotRealized = status === 'not_realized';
  const isInactive = isCancelled || isNotRealized;

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
          <View style={styles.statusBadge}>
            <View style={[styles.statusDot, { backgroundColor: getStatusColor(status) }]} />
            <Text style={[styles.statusText, { color: getStatusColor(status) }]}>
              {getStatusLabel(status)}
            </Text>
          </View>

          <View style={styles.hospitalHeader}>
            <View style={styles.hospitalIcon}>
              <Ionicons name="business" size={32} color={Colors.primary} />
            </View>
            <View style={styles.hospitalInfo}>
              <Text style={styles.hospitalName}>
                {visit.hospital_name || visit.hospitalName || 'Unknown Hospital'}
              </Text>
              <Text style={styles.hospitalAddress}>
                {visit.subject || visit.visit_type || visit.visitType || 'Visit'}
              </Text>
            </View>
          </View>

          <View style={styles.detailsGrid}>
            <View style={styles.detailItem}>
              <Ionicons name="calendar" size={20} color={Colors.textSecondary} />
              <Text style={styles.detailLabel}>Date</Text>
              <Text style={styles.detailValue}>
                {formatDate(visit.scheduled_start || visit.scheduledStart || visit.startTime)}
              </Text>
            </View>
            <View style={styles.detailItem}>
              <Ionicons name="time" size={20} color={Colors.textSecondary} />
              <Text style={styles.detailLabel}>{translations.visits.scheduledTime}</Text>
              <Text style={styles.detailValue}>
                {formatTime(visit.scheduled_start || visit.scheduledStart || visit.startTime)}
              </Text>
            </View>
          </View>

          {(visit.actual_start || visit.actualStart) && (
            <View style={styles.actualTimes}>
              <View style={styles.actualTimeItem}>
                <Ionicons name="play-circle" size={18} color={Colors.success} />
                <Text style={styles.actualTimeLabel}>Started:</Text>
                <Text style={styles.actualTimeValue}>
                  {formatTime(visit.actual_start || visit.actualStart)}
                </Text>
              </View>
              {(visit.actual_end || visit.actualEnd) && (
                <View style={styles.actualTimeItem}>
                  <Ionicons name="stop-circle" size={18} color={Colors.error} />
                  <Text style={styles.actualTimeLabel}>Ended:</Text>
                  <Text style={styles.actualTimeValue}>
                    {formatTime(visit.actual_end || visit.actualEnd)}
                  </Text>
                </View>
              )}
            </View>
          )}
        </Card>

        {(visit.notes || visit.remark) && (
          <Card style={styles.notesCard}>
            <Text style={styles.notesTitle}>{translations.visits.notes}</Text>
            <Text style={styles.notesText}>{visit.notes || visit.remark}</Text>
          </Card>
        )}

        <Card style={styles.voiceNotesCard}>
          <View style={styles.voiceNotesHeader}>
            <Text style={styles.voiceNotesTitle}>{translations.visits.voiceNote}</Text>
            {isInProgress && (
              <TouchableOpacity style={styles.addVoiceButton} testID="button-add-voice-note">
                <Ionicons name="mic" size={20} color={Colors.white} />
              </TouchableOpacity>
            )}
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
          {isInProgress ? (
            <View style={styles.gpsActive}>
              <View style={styles.gpsPulse} />
              <Text style={styles.gpsActiveText}>GPS tracking active</Text>
            </View>
          ) : isCompleted ? (
            <View>
              {(visit.start_latitude || visit.startLatitude) && (
                <Text style={styles.gpsText}>
                  Start: {visit.start_latitude || visit.startLatitude}, {visit.start_longitude || visit.startLongitude}
                </Text>
              )}
              {(visit.end_latitude || visit.endLatitude) && (
                <Text style={styles.gpsText}>
                  End: {visit.end_latitude || visit.endLatitude}, {visit.end_longitude || visit.endLongitude}
                </Text>
              )}
            </View>
          ) : (
            <Text style={styles.gpsText}>GPS tracking will start when you begin the visit</Text>
          )}
        </Card>
      </ScrollView>

      <View style={styles.footer}>
        {isScheduled && !isInactive && (
          <Button
            title={isGettingLocation ? 'Getting Location...' : translations.visits.startVisit}
            onPress={handleStartVisit}
            loading={startVisitMutation.isPending || isGettingLocation}
            testID="button-start-visit"
          />
        )}
        {isInProgress && !isInactive && (
          <Button
            title={isGettingLocation ? 'Getting Location...' : translations.visits.endVisit}
            onPress={handleEndVisit}
            loading={endVisitMutation.isPending || isGettingLocation}
            variant="destructive"
            testID="button-end-visit"
          />
        )}
        {isCompleted && (
          <View style={styles.completedBanner}>
            <Ionicons name="checkmark-circle" size={24} color={Colors.success} />
            <Text style={styles.completedText}>Visit Completed</Text>
          </View>
        )}
        {isCancelled && (
          <View style={styles.cancelledBanner}>
            <Ionicons name="close-circle" size={24} color={Colors.error} />
            <Text style={styles.cancelledText}>Visit Cancelled</Text>
          </View>
        )}
        {isNotRealized && (
          <View style={styles.cancelledBanner}>
            <Ionicons name="alert-circle" size={24} color={Colors.textSecondary} />
            <Text style={styles.cancelledText}>Visit Not Realized</Text>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    fontSize: FontSizes.lg,
    color: Colors.textSecondary,
    marginTop: Spacing.md,
  },
  errorButton: {
    marginTop: Spacing.lg,
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
    width: 32,
  },
  content: {
    flex: 1,
    padding: Spacing.md,
  },
  mainCard: {
    marginBottom: Spacing.md,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: Spacing.sm,
  },
  statusText: {
    fontSize: FontSizes.sm,
    fontWeight: '600',
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
    justifyContent: 'space-around',
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
    textAlign: 'center',
  },
  actualTimes: {
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  actualTimeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  actualTimeLabel: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    marginLeft: Spacing.sm,
  },
  actualTimeValue: {
    fontSize: FontSizes.sm,
    fontWeight: '600',
    color: Colors.text,
    marginLeft: Spacing.xs,
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
  gpsActive: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  gpsPulse: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: Colors.success,
    marginRight: Spacing.sm,
  },
  gpsActiveText: {
    fontSize: FontSizes.sm,
    color: Colors.success,
    fontWeight: '600',
  },
  footer: {
    padding: Spacing.md,
    backgroundColor: Colors.white,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  completedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.md,
  },
  completedText: {
    fontSize: FontSizes.md,
    fontWeight: '600',
    color: Colors.success,
    marginLeft: Spacing.sm,
  },
  cancelledBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.md,
  },
  cancelledText: {
    fontSize: FontSizes.md,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginLeft: Spacing.sm,
  },
});
