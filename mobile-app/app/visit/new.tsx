import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, Alert, TextInput, KeyboardAvoidingView, Platform, FlatList, ActivityIndicator } from 'react-native';
import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { DatePicker } from '@/components/ui/DatePicker';
import { TimePicker } from '@/components/ui/TimePicker';
import { useTranslation } from '@/hooks/useTranslation';
import { useHospitals } from '@/hooks/useHospitals';
import { useCreateVisit } from '@/hooks/useVisits';
import { Colors, Spacing, FontSizes } from '@/constants/colors';

type VisitType = {
  id: string;
  labelKey: keyof typeof VISIT_TYPE_KEYS;
  icon: string;
};

type PlaceType = {
  id: string;
  labelKey: keyof typeof PLACE_KEYS;
  icon: string;
};

const VISIT_TYPE_KEYS = {
  personalVisit: 'personalVisit',
  phoneCall: 'phoneCall',
  onlineMeeting: 'onlineMeeting',
  training: 'training',
  conference: 'conference',
  other: 'other',
  examinationProblematicCollection: 'examinationProblematicCollection',
  hospitalKitDelivery: 'hospitalKitDelivery',
  pregnancyLecture: 'pregnancyLecture',
  midwivesLecture: 'midwivesLecture',
  doctorsLecture: 'doctorsLecture',
  hospitalContractManagement: 'hospitalContractManagement',
  doctorContractManagement: 'doctorContractManagement',
  businessPartnerContractManagement: 'businessPartnerContractManagement',
} as const;

const PLACE_KEYS = {
  placeObstetrics: 'placeObstetrics',
  placePrivateOffice: 'placePrivateOffice',
  placeStateOffice: 'placeStateOffice',
  placeHospitalManagement: 'placeHospitalManagement',
  placeOther: 'placeOther',
  placePhoneVideo: 'placePhoneVideo',
} as const;

const VISIT_TYPES: VisitType[] = [
  { id: '1', labelKey: 'personalVisit', icon: 'person' },
  { id: '2', labelKey: 'phoneCall', icon: 'call' },
  { id: '3', labelKey: 'onlineMeeting', icon: 'videocam' },
  { id: '4', labelKey: 'training', icon: 'school' },
  { id: '5', labelKey: 'conference', icon: 'people' },
  { id: '6', labelKey: 'other', icon: 'ellipsis-horizontal' },
  { id: '7', labelKey: 'examinationProblematicCollection', icon: 'flask' },
  { id: '8', labelKey: 'hospitalKitDelivery', icon: 'cube' },
  { id: '9', labelKey: 'pregnancyLecture', icon: 'woman' },
  { id: '10', labelKey: 'midwivesLecture', icon: 'medkit' },
  { id: '11', labelKey: 'doctorsLecture', icon: 'medical' },
  { id: '12', labelKey: 'hospitalContractManagement', icon: 'document-text' },
  { id: '13', labelKey: 'doctorContractManagement', icon: 'clipboard' },
  { id: '14', labelKey: 'businessPartnerContractManagement', icon: 'briefcase' },
];

const PLACE_TYPES: PlaceType[] = [
  { id: '1', labelKey: 'placeObstetrics', icon: 'business' },
  { id: '2', labelKey: 'placePrivateOffice', icon: 'home' },
  { id: '3', labelKey: 'placeStateOffice', icon: 'storefront' },
  { id: '4', labelKey: 'placeHospitalManagement', icon: 'people' },
  { id: '5', labelKey: 'placeOther', icon: 'location' },
  { id: '6', labelKey: 'placePhoneVideo', icon: 'call' },
];

type RemarkDetailType = {
  id: string;
  labelKey: string;
  icon: string;
};

const REMARK_DETAIL_TYPES: RemarkDetailType[] = [
  { id: '1', labelKey: 'remarkPrice', icon: 'pricetag' },
  { id: '2', labelKey: 'remarkCompetitors', icon: 'people' },
  { id: '3', labelKey: 'remarkDoctor', icon: 'medkit' },
  { id: '4', labelKey: 'remarkResident', icon: 'school' },
  { id: '5', labelKey: 'remarkMidwife', icon: 'woman' },
  { id: '6', labelKey: 'remarkBusinessPartner', icon: 'briefcase' },
  { id: '7', labelKey: 'remarkOther', icon: 'ellipsis-horizontal' },
];

export default function NewVisitScreen() {
  const router = useRouter();
  const { translations } = useTranslation();
  const { data: hospitals = [], isLoading: hospitalsLoading } = useHospitals();
  const createVisit = useCreateVisit();
  
  const [selectedHospitalId, setSelectedHospitalId] = useState<string>('');
  const [selectedType, setSelectedType] = useState<string>('1');
  const [selectedPlace, setSelectedPlace] = useState<string>('1');
  const [selectedRemarkDetail, setSelectedRemarkDetail] = useState<string>('');
  const [scheduledDate, setScheduledDate] = useState(new Date());
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('10:00');
  const [notes, setNotes] = useState('');
  const [showHospitalPicker, setShowHospitalPicker] = useState(false);
  const [showPlacePicker, setShowPlacePicker] = useState(false);
  const [showRemarkDetailPicker, setShowRemarkDetailPicker] = useState(false);
  const [hospitalSearch, setHospitalSearch] = useState('');

  const selectedHospital = hospitals.find(h => String(h.id) === selectedHospitalId);
  const selectedPlaceObj = PLACE_TYPES.find(p => p.id === selectedPlace);
  const selectedRemarkDetailObj = REMARK_DETAIL_TYPES.find(r => r.id === selectedRemarkDetail);

  const filteredHospitals = useMemo(() => {
    if (!hospitals || hospitals.length === 0) return [];
    if (!hospitalSearch.trim()) return hospitals;
    const query = hospitalSearch.toLowerCase().trim();
    return hospitals.filter(h => {
      const name = h.name || '';
      const city = h.city || '';
      const street = h.streetNumber || '';
      return (
        name.toLowerCase().includes(query) ||
        city.toLowerCase().includes(query) ||
        street.toLowerCase().includes(query)
      );
    });
  }, [hospitals, hospitalSearch]);

  const handleSelectHospital = (hospitalId: string) => {
    setSelectedHospitalId(hospitalId);
    setShowHospitalPicker(false);
    setHospitalSearch('');
  };

  const handleSave = async () => {
    if (!selectedType) {
      Alert.alert(translations.common.error, translations.visits.visitType);
      return;
    }

    try {
      const dateStr = scheduledDate.toISOString().split('T')[0];
      const startDateTime = new Date(`${dateStr}T${startTime}:00`);
      const endDateTime = new Date(`${dateStr}T${endTime}:00`);

      const selectedTypeObj = VISIT_TYPES.find(t => t.id === selectedType);
      const visitTypeLabel = selectedTypeObj ? translations.visits[selectedTypeObj.labelKey] : '';

      const selectedPlaceLabel = selectedPlaceObj ? translations.visits[selectedPlaceObj.labelKey] : '';
      
      await createVisit.mutateAsync({
        hospitalId: selectedHospitalId || undefined,
        subject: visitTypeLabel,
        startTime: startDateTime.toISOString(),
        endTime: endDateTime.toISOString(),
        remark: notes || undefined,
        isAllDay: false,
        visitType: selectedType,
        place: selectedPlace,
        remarkDetail: selectedRemarkDetail || undefined,
      });

      Alert.alert(translations.common.done, translations.visits.newVisit, [
        { text: translations.common.ok, onPress: () => router.back() }
      ]);
    } catch (error: any) {
      Alert.alert(translations.common.error, error.message);
    }
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={[Colors.primary, Colors.primaryDark]}
        style={styles.headerGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <SafeAreaView edges={['top']}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()} style={styles.headerButton}>
              <Ionicons name="close" size={24} color={Colors.white} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>{translations.visits.newVisit}</Text>
            <View style={styles.headerButton} />
          </View>
        </SafeAreaView>
      </LinearGradient>

      <KeyboardAvoidingView 
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView 
          style={styles.content}
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.sectionTitle}>{translations.visits.hospital}</Text>
          <TouchableOpacity 
            style={styles.selectorCard}
            onPress={() => setShowHospitalPicker(true)}
            testID="button-select-hospital"
          >
            <View style={styles.selectorIconContainer}>
              <Ionicons name="business" size={20} color={Colors.primary} />
            </View>
            <View style={styles.selectorContent}>
              <Text style={[
                styles.selectorText,
                selectedHospital && styles.selectorTextSelected
              ]}>
                {hospitalsLoading 
                  ? translations.visits.loadingHospitals
                  : selectedHospital 
                    ? selectedHospital.name 
                    : translations.visits.selectHospital}
              </Text>
              {selectedHospital?.city && (
                <Text style={styles.selectorSubtext}>{selectedHospital.city}</Text>
              )}
            </View>
            <Ionicons name="chevron-forward" size={20} color={Colors.textSecondary} />
          </TouchableOpacity>

          <Text style={styles.sectionTitle}>{translations.visits.visitType}</Text>
          <View style={styles.typeGrid}>
            {VISIT_TYPES.map((type) => (
              <TouchableOpacity
                key={type.id}
                style={[
                  styles.typeCard,
                  selectedType === type.id && styles.typeCardSelected,
                ]}
                onPress={() => setSelectedType(type.id)}
                testID={`button-type-${type.id}`}
              >
                {selectedType === type.id ? (
                  <LinearGradient
                    colors={[Colors.primary, Colors.primaryDark]}
                    style={styles.typeCardGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                  >
                    <Ionicons name={type.icon as any} size={24} color={Colors.white} />
                    <Text style={styles.typeLabelSelected}>
                      {translations.visits[type.labelKey]}
                    </Text>
                  </LinearGradient>
                ) : (
                  <>
                    <Ionicons name={type.icon as any} size={24} color={Colors.primary} />
                    <Text style={styles.typeLabel}>
                      {translations.visits[type.labelKey]}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.sectionTitle}>{translations.visits.place}</Text>
          <TouchableOpacity 
            style={styles.selectorCard}
            onPress={() => setShowPlacePicker(true)}
            activeOpacity={0.7}
            testID="button-select-place"
          >
            <View style={styles.selectorIconContainer}>
              <Ionicons 
                name={selectedPlaceObj?.icon as any || 'location'} 
                size={20} 
                color={Colors.primary} 
              />
            </View>
            <View style={styles.selectorContent}>
              <Text style={[
                styles.selectorText,
                selectedPlaceObj && styles.selectorTextSelected
              ]}>
                {selectedPlaceObj 
                  ? translations.visits[selectedPlaceObj.labelKey]
                  : translations.visits.selectPlace
                }
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={Colors.textSecondary} />
          </TouchableOpacity>

          <Text style={styles.sectionTitle}>{translations.visits.scheduledTime}</Text>
          <View style={styles.dateTimeContainer}>
            <DatePicker
              value={scheduledDate}
              onChange={setScheduledDate}
              label={translations.visits.date}
            />
          </View>
          <View style={styles.timeRow}>
            <View style={styles.timeInputContainer}>
              <TimePicker
                value={startTime}
                onChange={setStartTime}
                label={translations.visits.startTime}
              />
            </View>
            <View style={styles.timeInputContainer}>
              <TimePicker
                value={endTime}
                onChange={setEndTime}
                label={translations.visits.endTime}
              />
            </View>
          </View>

          <Text style={styles.sectionTitle}>{translations.visits.remarkDetail || 'Remark Detail'}</Text>
          <TouchableOpacity 
            style={styles.selectorCard}
            onPress={() => setShowRemarkDetailPicker(true)}
            activeOpacity={0.7}
            testID="button-select-remark-detail"
          >
            <View style={styles.selectorIconContainer}>
              <Ionicons 
                name={selectedRemarkDetailObj?.icon as any || 'chatbubble-ellipses'} 
                size={20} 
                color={Colors.primary} 
              />
            </View>
            <View style={styles.selectorContent}>
              <Text style={[
                styles.selectorText,
                selectedRemarkDetailObj && styles.selectorTextSelected
              ]}>
                {selectedRemarkDetailObj 
                  ? (translations.visits as any)[selectedRemarkDetailObj.labelKey]
                  : translations.visits.selectRemarkDetail || 'Select remark detail'
                }
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={Colors.textSecondary} />
          </TouchableOpacity>

          <Text style={styles.sectionTitle}>{translations.visits.notes}</Text>
          <View style={styles.notesContainer}>
            <TextInput
              style={styles.notesInput}
              placeholder={translations.visits.addNotes}
              placeholderTextColor={Colors.textSecondary}
              value={notes}
              onChangeText={setNotes}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              testID="input-notes"
            />
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity 
            style={styles.cancelButton} 
            onPress={() => router.back()}
          >
            <Text style={styles.cancelButtonText}>{translations.common.cancel}</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.saveButton}
            onPress={handleSave}
            disabled={createVisit.isPending}
            testID="button-save-visit"
          >
            <LinearGradient
              colors={[Colors.primary, Colors.primaryDark]}
              style={styles.saveButtonGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              {createVisit.isPending ? (
                <Text style={styles.saveButtonText}>{translations.common.loading}</Text>
              ) : (
                <>
                  <Ionicons name="checkmark" size={20} color={Colors.white} />
                  <Text style={styles.saveButtonText}>{translations.common.save}</Text>
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      <Modal
        visible={showHospitalPicker}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowHospitalPicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{translations.visits.selectHospital}</Text>
              <TouchableOpacity 
                onPress={() => {
                  setShowHospitalPicker(false);
                  setHospitalSearch('');
                }}
                style={styles.modalCloseButton}
                testID="button-close-hospital-picker"
              >
                <Ionicons name="close" size={24} color={Colors.text} />
              </TouchableOpacity>
            </View>
            
            <View style={styles.searchContainer}>
              <Ionicons name="search" size={20} color={Colors.textSecondary} />
              <TextInput
                style={styles.searchInput}
                placeholder={translations.common.search}
                placeholderTextColor={Colors.textSecondary}
                value={hospitalSearch}
                onChangeText={setHospitalSearch}
                autoFocus
              />
              {hospitalSearch.length > 0 && (
                <TouchableOpacity onPress={() => setHospitalSearch('')}>
                  <Ionicons name="close-circle" size={20} color={Colors.textSecondary} />
                </TouchableOpacity>
              )}
            </View>

            <View style={styles.hospitalListContainer}>
              {hospitalsLoading ? (
                <View style={styles.loadingState}>
                  <ActivityIndicator size="large" color={Colors.primary} />
                  <Text style={styles.loadingText}>{translations.visits.loadingHospitals}</Text>
                </View>
              ) : filteredHospitals.length === 0 ? (
                <View style={styles.emptyState}>
                  <Ionicons name="business-outline" size={48} color={Colors.textSecondary} />
                  <Text style={styles.emptyText}>
                    {hospitalSearch.trim() 
                      ? translations.common.noResults 
                      : translations.visits.noHospitalsAvailable}
                  </Text>
                </View>
              ) : (
                <FlatList
                  data={filteredHospitals}
                  keyExtractor={(item) => String(item.id)}
                  contentContainerStyle={styles.hospitalListContent}
                  showsVerticalScrollIndicator={true}
                  keyboardShouldPersistTaps="handled"
                  renderItem={({ item: hospital }) => {
                    const hospitalId = String(hospital.id);
                    const isSelected = selectedHospitalId === hospitalId;
                    
                    return (
                      <TouchableOpacity
                        style={[
                          styles.hospitalItem,
                          isSelected && styles.hospitalItemSelected
                        ]}
                        onPress={() => handleSelectHospital(hospitalId)}
                        activeOpacity={0.7}
                        testID={`hospital-item-${hospitalId}`}
                      >
                        <View style={[
                          styles.hospitalIconContainer,
                          isSelected && styles.hospitalIconContainerSelected
                        ]}>
                          <Ionicons 
                            name="business" 
                            size={20} 
                            color={isSelected ? Colors.white : Colors.primary} 
                          />
                        </View>
                        <View style={styles.hospitalItemText}>
                          <Text style={[
                            styles.hospitalName,
                            isSelected && styles.hospitalNameSelected
                          ]}>
                            {hospital.name || '---'}
                          </Text>
                          {hospital.city && (
                            <Text style={styles.hospitalCity}>{hospital.city}</Text>
                          )}
                        </View>
                        {isSelected && (
                          <View style={styles.checkmarkContainer}>
                            <Ionicons name="checkmark-circle" size={24} color={Colors.primary} />
                          </View>
                        )}
                      </TouchableOpacity>
                    );
                  }}
                />
              )}
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showPlacePicker}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowPlacePicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{translations.visits.selectPlace}</Text>
              <TouchableOpacity 
                onPress={() => setShowPlacePicker(false)}
                style={styles.modalCloseButton}
                testID="button-close-place-picker"
              >
                <Ionicons name="close" size={24} color={Colors.text} />
              </TouchableOpacity>
            </View>
            
            <ScrollView style={styles.hospitalListContainer} contentContainerStyle={styles.hospitalListContent}>
              {PLACE_TYPES.map((place) => (
                <TouchableOpacity
                  key={place.id}
                  style={[
                    styles.hospitalItem,
                    selectedPlace === place.id && styles.hospitalItemSelected
                  ]}
                  onPress={() => {
                    setSelectedPlace(place.id);
                    setShowPlacePicker(false);
                  }}
                  testID={`button-select-place-${place.id}`}
                >
                  <View style={[
                    styles.hospitalIconContainer,
                    selectedPlace === place.id && styles.hospitalIconContainerSelected
                  ]}>
                    <Ionicons 
                      name={place.icon as any} 
                      size={24} 
                      color={selectedPlace === place.id ? Colors.white : Colors.primary} 
                    />
                  </View>
                  <View style={styles.hospitalItemText}>
                    <Text style={[
                      styles.hospitalName,
                      selectedPlace === place.id && styles.hospitalNameSelected
                    ]}>
                      {translations.visits[place.labelKey]}
                    </Text>
                  </View>
                  {selectedPlace === place.id && (
                    <Ionicons name="checkmark-circle" size={24} color={Colors.primary} />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showRemarkDetailPicker}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowRemarkDetailPicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{translations.visits.selectRemarkDetail || 'Select Remark Detail'}</Text>
              <TouchableOpacity 
                onPress={() => setShowRemarkDetailPicker(false)}
                style={styles.modalCloseButton}
                testID="button-close-remark-detail-picker"
              >
                <Ionicons name="close" size={24} color={Colors.text} />
              </TouchableOpacity>
            </View>
            
            <ScrollView style={styles.hospitalListContainer} contentContainerStyle={styles.hospitalListContent}>
              {REMARK_DETAIL_TYPES.map((remarkDetail) => (
                <TouchableOpacity
                  key={remarkDetail.id}
                  style={[
                    styles.hospitalItem,
                    selectedRemarkDetail === remarkDetail.id && styles.hospitalItemSelected
                  ]}
                  onPress={() => {
                    setSelectedRemarkDetail(remarkDetail.id);
                    setShowRemarkDetailPicker(false);
                  }}
                  testID={`button-select-remark-detail-${remarkDetail.id}`}
                >
                  <View style={[
                    styles.hospitalIconContainer,
                    selectedRemarkDetail === remarkDetail.id && styles.hospitalIconContainerSelected
                  ]}>
                    <Ionicons 
                      name={remarkDetail.icon as any} 
                      size={24} 
                      color={selectedRemarkDetail === remarkDetail.id ? Colors.white : Colors.primary} 
                    />
                  </View>
                  <View style={styles.hospitalItemText}>
                    <Text style={[
                      styles.hospitalName,
                      selectedRemarkDetail === remarkDetail.id && styles.hospitalNameSelected
                    ]}>
                      {(translations.visits as any)[remarkDetail.labelKey] || remarkDetail.labelKey}
                    </Text>
                  </View>
                  {selectedRemarkDetail === remarkDetail.id && (
                    <Ionicons name="checkmark-circle" size={24} color={Colors.primary} />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
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
  keyboardView: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: Spacing.lg,
    paddingBottom: Spacing.xxl,
  },
  sectionTitle: {
    fontSize: FontSizes.md,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: Spacing.sm,
    marginTop: Spacing.md,
  },
  selectorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: Spacing.md,
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  selectorIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(107, 28, 59, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  selectorContent: {
    flex: 1,
  },
  selectorText: {
    fontSize: FontSizes.md,
    color: Colors.textSecondary,
  },
  selectorTextSelected: {
    color: Colors.text,
    fontWeight: '600',
  },
  selectorSubtext: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  typeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  typeCard: {
    width: '31%',
    aspectRatio: 1,
    backgroundColor: Colors.white,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  typeCardSelected: {
    borderColor: Colors.primary,
    borderWidth: 0,
  },
  typeCardGradient: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  typeLabel: {
    fontSize: FontSizes.xs,
    color: Colors.text,
    marginTop: Spacing.xs,
    textAlign: 'center',
    paddingHorizontal: Spacing.xs,
  },
  typeLabelSelected: {
    fontSize: FontSizes.xs,
    color: Colors.white,
    marginTop: Spacing.xs,
    textAlign: 'center',
    paddingHorizontal: Spacing.xs,
  },
  dateTimeContainer: {
    marginBottom: Spacing.sm,
  },
  timeRow: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  timeInputContainer: {
    flex: 1,
  },
  timeLabel: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    marginBottom: Spacing.xs,
  },
  timeInput: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: Spacing.sm,
  },
  timeInputText: {
    flex: 1,
    fontSize: FontSizes.md,
    color: Colors.text,
  },
  notesContainer: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  notesInput: {
    padding: Spacing.md,
    fontSize: FontSizes.md,
    color: Colors.text,
    minHeight: 100,
  },
  footer: {
    flexDirection: 'row',
    padding: Spacing.md,
    backgroundColor: Colors.white,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    gap: Spacing.md,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: Spacing.md,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: FontSizes.md,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  saveButton: {
    flex: 2,
    borderRadius: 12,
    overflow: 'hidden',
  },
  saveButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md,
    gap: Spacing.sm,
  },
  saveButtonText: {
    fontSize: FontSizes.md,
    fontWeight: '600',
    color: Colors.white,
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
    maxHeight: '80%',
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
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    marginHorizontal: Spacing.lg,
    marginVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    borderRadius: 12,
    gap: Spacing.sm,
  },
  searchInput: {
    flex: 1,
    paddingVertical: Spacing.md,
    fontSize: FontSizes.md,
    color: Colors.text,
  },
  hospitalListContainer: {
    flex: 1,
    minHeight: 200,
  },
  hospitalListContent: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.lg,
  },
  hospitalItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    backgroundColor: Colors.surface,
    borderRadius: 12,
  },
  hospitalItemSelected: {
    backgroundColor: 'rgba(107, 28, 59, 0.1)',
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  hospitalIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(107, 28, 59, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  hospitalIconContainerSelected: {
    backgroundColor: Colors.primary,
  },
  hospitalItemText: {
    flex: 1,
  },
  hospitalName: {
    fontSize: FontSizes.md,
    fontWeight: '500',
    color: Colors.text,
  },
  hospitalNameSelected: {
    fontWeight: '600',
    color: Colors.primary,
  },
  hospitalCity: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  checkmarkContainer: {
    marginLeft: Spacing.sm,
  },
  loadingState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.xxl,
  },
  loadingText: {
    fontSize: FontSizes.md,
    color: Colors.textSecondary,
    marginTop: Spacing.md,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.xxl,
  },
  emptyText: {
    fontSize: FontSizes.md,
    color: Colors.textSecondary,
    marginTop: Spacing.md,
  },
});
