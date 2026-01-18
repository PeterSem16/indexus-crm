import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, ActivityIndicator, Modal, TextInput } from 'react-native';
import { useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Location from 'expo-location';
import { useTranslation } from '@/hooks/useTranslation';
import { useVisit, useStartVisit, useEndVisit, useCancelVisit, useMarkVisitNotRealized } from '@/hooks/useVisits';
import { Colors, Spacing, FontSizes } from '@/constants/colors';
import { getVisitTypeName, getPlaceName } from '@/lib/visitTypes';
import { SupportedLanguage } from '@/constants/config';

export default function VisitDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { translations, language } = useTranslation();
  const { data: visit, isLoading } = useVisit(id || '');
  const startVisitMutation = useStartVisit();
  const endVisitMutation = useEndVisit();
  const cancelVisitMutation = useCancelVisit();
  const markNotRealizedMutation = useMarkVisitNotRealized();
  
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState('');

  const getLocale = () => {
    const locales: Record<string, string> = {
      sk: 'sk-SK', cs: 'cs-CZ', hu: 'hu-HU', 
      de: 'de-DE', it: 'it-IT', ro: 'ro-RO', en: 'en-US'
    };
    return locales[language] || 'en-US';
  };

  const getLocation = async (): Promise<{ latitude: number; longitude: number } | null> => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(translations.common.error, translations.common.locationPermissionRequired);
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
      Alert.alert(translations.common.error, translations.common.locationError);
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
      Alert.alert(translations.common.done, translations.visits.inProgress);
    } catch (error: any) {
      Alert.alert(translations.common.error, error.message);
    }
  };

  const handleEndVisit = async () => {
    if (!visit?.id) return;
    
    Alert.alert(
      translations.visits.endVisit,
      translations.visits.endVisitConfirm,
      [
        { text: translations.common.cancel, style: 'cancel' },
        {
          text: translations.visits.endVisit,
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
              Alert.alert(translations.common.done, translations.visits.visitCompleted);
            } catch (error: any) {
              Alert.alert(translations.common.error, error.message);
            }
          },
        },
      ]
    );
  };

  const handleCancelVisit = () => {
    if (!visit?.id) return;
    setShowCancelModal(true);
  };

  const handleConfirmCancel = async (status: 'cancelled' | 'not_realized') => {
    if (!visit?.id) return;
    
    try {
      if (status === 'cancelled') {
        await cancelVisitMutation.mutateAsync(visit.id);
        Alert.alert(translations.common.done, translations.visits.visitCancelled);
      } else {
        await markNotRealizedMutation.mutateAsync(visit.id);
        Alert.alert(translations.common.done, translations.visits.visitNotRealized);
      }
      setShowCancelModal(false);
      setCancelReason('');
    } catch (error: any) {
      Alert.alert(translations.common.error, error.message);
    }
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
      case 'completed': return translations.visits.completed;
      case 'in_progress': return translations.visits.inProgress;
      case 'cancelled': return translations.visits.cancelled;
      case 'not_realized': return translations.visits.notRealized;
      case 'scheduled': return translations.visits.scheduled;
      default: return status;
    }
  };

  const formatTime = (dateString: string | undefined) => {
    if (!dateString) return translations.common.notAvailable;
    return new Date(dateString).toLocaleTimeString(getLocale(), { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (dateString: string | undefined) => {
    if (!dateString) return translations.common.notAvailable;
    return new Date(dateString).toLocaleDateString(getLocale(), {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  };

  if (isLoading) {
    return (
      <View style={styles.container}>
        <LinearGradient
          colors={[Colors.primary, Colors.primaryDark]}
          style={styles.headerGradient}
        >
          <SafeAreaView edges={['top']}>
            <View style={styles.header}>
              <TouchableOpacity onPress={() => router.back()} style={styles.headerButton}>
                <Ionicons name="chevron-back" size={24} color={Colors.white} />
              </TouchableOpacity>
              <Text style={styles.headerTitle}>{translations.visits.visitDetails}</Text>
              <View style={styles.headerButton} />
            </View>
          </SafeAreaView>
        </LinearGradient>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      </View>
    );
  }

  if (!visit) {
    return (
      <View style={styles.container}>
        <LinearGradient
          colors={[Colors.primary, Colors.primaryDark]}
          style={styles.headerGradient}
        >
          <SafeAreaView edges={['top']}>
            <View style={styles.header}>
              <TouchableOpacity onPress={() => router.back()} style={styles.headerButton}>
                <Ionicons name="chevron-back" size={24} color={Colors.white} />
              </TouchableOpacity>
              <Text style={styles.headerTitle}>{translations.visits.visitDetails}</Text>
              <View style={styles.headerButton} />
            </View>
          </SafeAreaView>
        </LinearGradient>
        <View style={styles.errorContainer}>
          <View style={styles.errorIconContainer}>
            <Ionicons name="alert-circle-outline" size={64} color={Colors.primaryLight} />
          </View>
          <Text style={styles.errorTitle}>{translations.visits.visitNotFound}</Text>
          <TouchableOpacity style={styles.errorButton} onPress={() => router.back()}>
            <Text style={styles.errorButtonText}>{translations.visits.goBack}</Text>
          </TouchableOpacity>
        </View>
      </View>
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
    <View style={styles.container}>
      <LinearGradient
        colors={[Colors.primary, Colors.primaryDark]}
        style={styles.headerGradient}
      >
        <SafeAreaView edges={['top']}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()} style={styles.headerButton}>
              <Ionicons name="chevron-back" size={24} color={Colors.white} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>{translations.visits.visitDetails}</Text>
            <TouchableOpacity style={styles.headerButton}>
              <Ionicons name="ellipsis-vertical" size={24} color={Colors.white} />
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </LinearGradient>

      <ScrollView 
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.statusCard}>
          <View style={[styles.statusBadge, { backgroundColor: `${getStatusColor(status)}20` }]}>
            <View style={[styles.statusDot, { backgroundColor: getStatusColor(status) }]} />
            <Text style={[styles.statusText, { color: getStatusColor(status) }]}>
              {getStatusLabel(status)}
            </Text>
          </View>
        </View>

        <View style={styles.mainCard}>
          <View style={styles.hospitalHeader}>
            <View style={styles.hospitalIconContainer}>
              <Ionicons name="business" size={28} color={Colors.primary} />
            </View>
            <View style={styles.hospitalInfo}>
              <Text style={styles.hospitalName}>
                {visit.hospitalName || translations.visits.unknownHospital}
              </Text>
              <Text style={styles.visitTypeText}>
                {getVisitTypeName(visit.visitType, language as SupportedLanguage) || visit.subject || translations.navigation.visits}
              </Text>
              {(visit.place) && (
                <Text style={styles.placeText}>
                  {getPlaceName(visit.place, language as SupportedLanguage)}
                </Text>
              )}
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.detailsRow}>
            <View style={styles.detailItem}>
              <View style={styles.detailIconContainer}>
                <Ionicons name="calendar" size={18} color={Colors.primary} />
              </View>
              <View>
                <Text style={styles.detailLabel}>{translations.visits.date}</Text>
                <Text style={styles.detailValue}>
                  {formatDate(visit.scheduledStart)}
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.detailsRow}>
            <View style={styles.detailItem}>
              <View style={styles.detailIconContainer}>
                <Ionicons name="time" size={18} color={Colors.primary} />
              </View>
              <View>
                <Text style={styles.detailLabel}>{translations.visits.scheduledTime}</Text>
                <Text style={styles.detailValue}>
                  {formatTime(visit.scheduledStart)}
                </Text>
              </View>
            </View>
          </View>

          {visit.actualStart && (
            <>
              <View style={styles.divider} />
              <View style={styles.actualTimesContainer}>
                <View style={styles.actualTimeItem}>
                  <Ionicons name="play-circle" size={20} color={Colors.success} />
                  <Text style={styles.actualTimeLabel}>{translations.visits.startLocation}:</Text>
                  <Text style={styles.actualTimeValue}>
                    {formatTime(visit.actualStart)}
                  </Text>
                </View>
                {visit.actualEnd && (
                  <View style={styles.actualTimeItem}>
                    <Ionicons name="stop-circle" size={20} color={Colors.error} />
                    <Text style={styles.actualTimeLabel}>{translations.visits.endLocation}:</Text>
                    <Text style={styles.actualTimeValue}>
                      {formatTime(visit.actualEnd)}
                    </Text>
                  </View>
                )}
              </View>
            </>
          )}
        </View>

        {(visit.notes || visit.remark) && (
          <View style={styles.notesCard}>
            <View style={styles.cardHeader}>
              <Ionicons name="document-text" size={20} color={Colors.primary} />
              <Text style={styles.cardTitle}>{translations.visits.notes}</Text>
            </View>
            <Text style={styles.notesText}>{visit.notes || visit.remark}</Text>
          </View>
        )}

        <View style={styles.gpsCard}>
          <View style={styles.cardHeader}>
            <Ionicons name="location" size={20} color={Colors.primary} />
            <Text style={styles.cardTitle}>{translations.visits.gpsTracking}</Text>
          </View>
          {isInProgress ? (
            <View style={styles.gpsActive}>
              <View style={styles.gpsPulse} />
              <Text style={styles.gpsActiveText}>{translations.visits.gpsActive}</Text>
            </View>
          ) : isCompleted ? (
            <View style={styles.gpsCompleted}>
              {(visit.start_latitude || visit.startLatitude) && (
                <View style={styles.gpsRow}>
                  <Ionicons name="navigate" size={16} color={Colors.success} />
                  <Text style={styles.gpsText}>
                    {translations.visits.startLocation}: {(visit.start_latitude || visit.startLatitude)?.toFixed(4)}, {(visit.start_longitude || visit.startLongitude)?.toFixed(4)}
                  </Text>
                </View>
              )}
              {(visit.end_latitude || visit.endLatitude) && (
                <View style={styles.gpsRow}>
                  <Ionicons name="flag" size={16} color={Colors.error} />
                  <Text style={styles.gpsText}>
                    {translations.visits.endLocation}: {(visit.end_latitude || visit.endLatitude)?.toFixed(4)}, {(visit.end_longitude || visit.endLongitude)?.toFixed(4)}
                  </Text>
                </View>
              )}
            </View>
          ) : (
            <Text style={styles.gpsInactiveText}>{translations.visits.gpsWillStart}</Text>
          )}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        {(isScheduled || isInProgress) && !isInactive && (
          <View style={styles.footerButtons}>
            {isScheduled && (
              <TouchableOpacity
                style={styles.startButton}
                onPress={handleStartVisit}
                disabled={startVisitMutation.isPending || isGettingLocation}
                testID="button-start-visit"
              >
                <LinearGradient
                  colors={[Colors.success, '#2E7D32']}
                  style={styles.actionButtonGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  {(startVisitMutation.isPending || isGettingLocation) ? (
                    <ActivityIndicator color={Colors.white} />
                  ) : (
                    <>
                      <Ionicons name="play" size={20} color={Colors.white} />
                      <Text style={styles.actionButtonText}>{translations.visits.startVisit}</Text>
                    </>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            )}
            {isInProgress && (
              <TouchableOpacity
                style={styles.endButton}
                onPress={handleEndVisit}
                disabled={endVisitMutation.isPending || isGettingLocation}
                testID="button-end-visit"
              >
                <LinearGradient
                  colors={[Colors.error, '#C62828']}
                  style={styles.actionButtonGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  {(endVisitMutation.isPending || isGettingLocation) ? (
                    <ActivityIndicator color={Colors.white} />
                  ) : (
                    <>
                      <Ionicons name="stop" size={20} color={Colors.white} />
                      <Text style={styles.actionButtonText}>{translations.visits.endVisit}</Text>
                    </>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={handleCancelVisit}
              disabled={cancelVisitMutation.isPending || markNotRealizedMutation.isPending}
              testID="button-cancel-event"
            >
              <Ionicons name="close-circle-outline" size={20} color={Colors.error} />
              <Text style={styles.cancelButtonText}>{translations.visits.cancelEvent}</Text>
            </TouchableOpacity>
          </View>
        )}
        {isCompleted && (
          <View style={styles.completedBanner}>
            <Ionicons name="checkmark-circle" size={24} color={Colors.success} />
            <Text style={styles.completedText}>{translations.visits.visitCompleted}</Text>
          </View>
        )}
        {isCancelled && (
          <View style={styles.cancelledBanner}>
            <Ionicons name="close-circle" size={24} color={Colors.error} />
            <Text style={styles.cancelledText}>{translations.visits.visitCancelled}</Text>
          </View>
        )}
        {isNotRealized && (
          <View style={styles.cancelledBanner}>
            <Ionicons name="alert-circle" size={24} color={Colors.textSecondary} />
            <Text style={styles.cancelledText}>{translations.visits.visitNotRealized}</Text>
          </View>
        )}
      </View>

      <Modal
        visible={showCancelModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowCancelModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{translations.visits.cancelEvent}</Text>
              <TouchableOpacity 
                onPress={() => {
                  setShowCancelModal(false);
                  setCancelReason('');
                }}
                style={styles.modalCloseButton}
                testID="button-close-cancel-modal"
              >
                <Ionicons name="close" size={24} color={Colors.text} />
              </TouchableOpacity>
            </View>
            
            <View style={styles.modalBody}>
              <Text style={styles.cancelReasonLabel}>{translations.visits.cancelReason}</Text>
              <TextInput
                style={styles.cancelReasonInput}
                placeholder={translations.visits.enterCancelReason}
                placeholderTextColor={Colors.textSecondary}
                value={cancelReason}
                onChangeText={setCancelReason}
                multiline
                numberOfLines={3}
                testID="input-cancel-reason"
              />
              
              <View style={styles.cancelButtonsContainer}>
                <TouchableOpacity
                  style={styles.cancelOptionButton}
                  onPress={() => handleConfirmCancel('cancelled')}
                  disabled={cancelVisitMutation.isPending}
                  testID="button-confirm-cancelled"
                >
                  <LinearGradient
                    colors={[Colors.error, '#C62828']}
                    style={styles.cancelOptionGradient}
                  >
                    <Ionicons name="close-circle" size={20} color={Colors.white} />
                    <Text style={styles.cancelOptionText}>{translations.visits.cancelled}</Text>
                  </LinearGradient>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={styles.cancelOptionButton}
                  onPress={() => handleConfirmCancel('not_realized')}
                  disabled={markNotRealizedMutation.isPending}
                  testID="button-confirm-not-realized"
                >
                  <View style={styles.notRealizedButton}>
                    <Ionicons name="alert-circle" size={20} color={Colors.textSecondary} />
                    <Text style={styles.notRealizedText}>{translations.visits.notRealized}</Text>
                  </View>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  headerGradient: {
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
  },
  headerButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: FontSizes.lg,
    fontWeight: '600',
    color: Colors.white,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
  },
  errorIconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(107, 28, 59, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  errorTitle: {
    fontSize: FontSizes.lg,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: Spacing.lg,
  },
  errorButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: 12,
  },
  errorButtonText: {
    color: Colors.white,
    fontSize: FontSizes.md,
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: Spacing.lg,
    paddingBottom: Spacing.xxl,
  },
  statusCard: {
    marginBottom: Spacing.md,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: 20,
    gap: Spacing.sm,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  statusText: {
    fontSize: FontSizes.sm,
    fontWeight: '600',
  },
  mainCard: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  hospitalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  hospitalIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(107, 28, 59, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  hospitalInfo: {
    flex: 1,
  },
  hospitalName: {
    fontSize: FontSizes.lg,
    fontWeight: '700',
    color: Colors.text,
  },
  visitTypeText: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  placeText: {
    fontSize: FontSizes.xs,
    color: Colors.primary,
    marginTop: 4,
    fontStyle: 'italic',
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border,
    marginVertical: Spacing.md,
  },
  detailsRow: {
    marginBottom: Spacing.sm,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  detailIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(107, 28, 59, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  detailLabel: {
    fontSize: FontSizes.xs,
    color: Colors.textSecondary,
  },
  detailValue: {
    fontSize: FontSizes.md,
    fontWeight: '600',
    color: Colors.text,
    marginTop: 2,
  },
  actualTimesContainer: {
    gap: Spacing.sm,
  },
  actualTimeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  actualTimeLabel: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
  },
  actualTimeValue: {
    fontSize: FontSizes.sm,
    fontWeight: '600',
    color: Colors.text,
  },
  notesCard: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.md,
    gap: Spacing.sm,
  },
  cardTitle: {
    flex: 1,
    fontSize: FontSizes.md,
    fontWeight: '600',
    color: Colors.text,
  },
  notesText: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    lineHeight: 22,
  },
  voiceNotesCard: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  addVoiceButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyVoiceNotes: {
    alignItems: 'center',
    paddingVertical: Spacing.lg,
  },
  emptyText: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    marginTop: Spacing.sm,
  },
  gpsCard: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  gpsActive: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  gpsPulse: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: Colors.success,
  },
  gpsActiveText: {
    fontSize: FontSizes.sm,
    color: Colors.success,
    fontWeight: '600',
  },
  gpsCompleted: {
    gap: Spacing.sm,
  },
  gpsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  gpsText: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
  },
  gpsInactiveText: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
  },
  footer: {
    padding: Spacing.md,
    backgroundColor: Colors.white,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  footerButtons: {
    gap: Spacing.sm,
  },
  startButton: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  endButton: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  actionButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md,
    gap: Spacing.sm,
  },
  actionButtonText: {
    fontSize: FontSizes.md,
    fontWeight: '600',
    color: Colors.white,
  },
  completedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md,
    gap: Spacing.sm,
  },
  completedText: {
    fontSize: FontSizes.md,
    fontWeight: '600',
    color: Colors.success,
  },
  cancelButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.sm,
    gap: Spacing.xs,
    borderWidth: 1,
    borderColor: Colors.error,
    borderRadius: 12,
    backgroundColor: 'transparent',
  },
  cancelButtonText: {
    fontSize: FontSizes.sm,
    fontWeight: '500',
    color: Colors.error,
  },
  cancelledBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md,
    gap: Spacing.sm,
  },
  cancelledText: {
    fontSize: FontSizes.md,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    minHeight: 350,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  modalTitle: {
    fontSize: FontSizes.lg,
    fontWeight: '700',
    color: Colors.text,
  },
  modalCloseButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalBody: {
    padding: Spacing.lg,
  },
  cancelReasonLabel: {
    fontSize: FontSizes.md,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: Spacing.sm,
  },
  cancelReasonInput: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: Spacing.md,
    fontSize: FontSizes.md,
    color: Colors.text,
    minHeight: 100,
    textAlignVertical: 'top',
    marginBottom: Spacing.lg,
  },
  cancelButtonsContainer: {
    gap: Spacing.md,
  },
  cancelOptionButton: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  cancelOptionGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md,
    gap: Spacing.sm,
  },
  cancelOptionText: {
    fontSize: FontSizes.md,
    fontWeight: '600',
    color: Colors.white,
  },
  notRealizedButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md,
    gap: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
  },
  notRealizedText: {
    fontSize: FontSizes.md,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
});
