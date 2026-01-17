import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, FlatList, Alert } from 'react-native';
import { useState } from 'react';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { useTranslation } from '@/hooks/useTranslation';
import { useHospitals } from '@/hooks/useHospitals';
import { useCreateVisit } from '@/hooks/useVisits';
import { Colors, Spacing, FontSizes } from '@/constants/colors';

const VISIT_TYPES = [
  { id: '1', label: 'Personal Visit', icon: 'person' },
  { id: '2', label: 'Phone Call', icon: 'call' },
  { id: '3', label: 'Online Meeting', icon: 'videocam' },
  { id: '4', label: 'Training', icon: 'school' },
  { id: '5', label: 'Conference', icon: 'people' },
  { id: '6', label: 'Other', icon: 'ellipsis-horizontal' },
];

export default function NewVisitScreen() {
  const router = useRouter();
  const { translations } = useTranslation();
  const { data: hospitals = [], isLoading: hospitalsLoading, error: hospitalsError } = useHospitals();
  const createVisit = useCreateVisit();
  
  console.log('[NewVisitScreen] hospitals:', hospitals.length, 'loading:', hospitalsLoading, 'error:', hospitalsError);
  
  const [selectedHospitalId, setSelectedHospitalId] = useState<string>('');
  const [selectedType, setSelectedType] = useState<string>('1');
  const [scheduledDate, setScheduledDate] = useState(new Date().toISOString().split('T')[0]);
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('10:00');
  const [notes, setNotes] = useState('');
  const [showHospitalPicker, setShowHospitalPicker] = useState(false);

  const selectedHospital = hospitals.find(h => h.id === selectedHospitalId);

  const handleSave = async () => {
    if (!selectedType) {
      Alert.alert('Error', 'Please select a visit type');
      return;
    }

    try {
      const startDateTime = new Date(`${scheduledDate}T${startTime}:00`);
      const endDateTime = new Date(`${scheduledDate}T${endTime}:00`);

      await createVisit.mutateAsync({
        hospitalId: selectedHospitalId || undefined,
        subject: selectedType,
        startTime: startDateTime.toISOString(),
        endTime: endDateTime.toISOString(),
        remark: notes || undefined,
        isAllDay: false,
      });

      Alert.alert('Success', 'Visit created successfully', [
        { text: 'OK', onPress: () => router.back() }
      ]);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to create visit');
    }
  };

  const renderHospitalItem = ({ item }: { item: { id: string; name: string; city?: string } }) => (
    <TouchableOpacity
      style={styles.hospitalItem}
      onPress={() => {
        setSelectedHospitalId(item.id);
        setShowHospitalPicker(false);
      }}
      testID={`hospital-item-${item.id}`}
    >
      <Ionicons name="business" size={20} color={Colors.primary} />
      <View style={styles.hospitalItemText}>
        <Text style={styles.hospitalName}>{item.name}</Text>
        {item.city && <Text style={styles.hospitalCity}>{item.city}</Text>}
      </View>
      {selectedHospitalId === item.id && (
        <Ionicons name="checkmark" size={20} color={Colors.primary} />
      )}
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="close" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>{translations.visits.newVisit}</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content}>
        <Text style={styles.sectionTitle}>{translations.visits.hospital}</Text>
        <Card style={styles.hospitalSelector}>
          <TouchableOpacity 
            style={styles.selectorButton}
            onPress={() => setShowHospitalPicker(true)}
            testID="button-select-hospital"
          >
            <Ionicons name="business" size={20} color={Colors.textSecondary} />
            <Text style={[
              styles.selectorText,
              selectedHospital && styles.selectorTextSelected
            ]}>
              {hospitalsLoading 
                ? 'Loading hospitals...' 
                : selectedHospital 
                  ? selectedHospital.name 
                  : 'Select hospital'}
            </Text>
            <Ionicons name="chevron-down" size={20} color={Colors.textSecondary} />
          </TouchableOpacity>
        </Card>

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
              <Ionicons 
                name={type.icon as any} 
                size={24} 
                color={selectedType === type.id ? Colors.white : Colors.primary} 
              />
              <Text 
                style={[
                  styles.typeLabel,
                  selectedType === type.id && styles.typeLabelSelected,
                ]}
              >
                {type.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.sectionTitle}>{translations.visits.scheduledTime}</Text>
        <View style={styles.dateTimeRow}>
          <Input
            placeholder="Date (YYYY-MM-DD)"
            value={scheduledDate}
            onChangeText={setScheduledDate}
            containerStyle={styles.dateInput}
            testID="input-date"
          />
        </View>
        <View style={styles.dateTimeRow}>
          <Input
            placeholder="Start (HH:MM)"
            value={startTime}
            onChangeText={setStartTime}
            containerStyle={styles.timeInput}
            testID="input-start-time"
          />
          <Input
            placeholder="End (HH:MM)"
            value={endTime}
            onChangeText={setEndTime}
            containerStyle={styles.timeInput}
            testID="input-end-time"
          />
        </View>

        <Text style={styles.sectionTitle}>{translations.visits.notes}</Text>
        <Input
          placeholder="Add notes about this visit..."
          value={notes}
          onChangeText={setNotes}
          multiline
          numberOfLines={4}
          style={styles.notesInput}
          testID="input-notes"
        />
      </ScrollView>

      <View style={styles.footer}>
        <Button
          title={translations.common.cancel}
          onPress={() => router.back()}
          variant="outline"
          style={styles.cancelButton}
        />
        <Button
          title={translations.common.save}
          onPress={handleSave}
          loading={createVisit.isPending}
          style={styles.saveButton}
          testID="button-save-visit"
        />
      </View>

      <Modal
        visible={showHospitalPicker}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowHospitalPicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Hospital</Text>
              <TouchableOpacity 
                onPress={() => setShowHospitalPicker(false)}
                testID="button-close-hospital-picker"
              >
                <Ionicons name="close" size={24} color={Colors.text} />
              </TouchableOpacity>
            </View>
            {hospitals.length === 0 && !hospitalsLoading ? (
              <View style={styles.emptyState}>
                <Ionicons name="business-outline" size={48} color={Colors.textSecondary} />
                <Text style={styles.emptyText}>No hospitals available</Text>
              </View>
            ) : (
              <FlatList
                data={hospitals}
                renderItem={renderHospitalItem}
                keyExtractor={(item) => item.id}
                style={styles.hospitalList}
              />
            )}
          </View>
        </View>
      </Modal>
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
  placeholder: {
    width: 32,
  },
  content: {
    flex: 1,
    padding: Spacing.md,
  },
  sectionTitle: {
    fontSize: FontSizes.md,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: Spacing.sm,
    marginTop: Spacing.md,
  },
  hospitalSelector: {
    padding: 0,
  },
  selectorButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
  },
  selectorText: {
    flex: 1,
    fontSize: FontSizes.md,
    color: Colors.textSecondary,
    marginLeft: Spacing.md,
  },
  selectorTextSelected: {
    color: Colors.text,
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
  },
  typeCardSelected: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  typeLabel: {
    fontSize: FontSizes.sm,
    color: Colors.text,
    marginTop: Spacing.sm,
    textAlign: 'center',
  },
  typeLabelSelected: {
    color: Colors.white,
  },
  dateTimeRow: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  dateInput: {
    flex: 1,
    marginBottom: Spacing.sm,
  },
  timeInput: {
    flex: 1,
    marginBottom: 0,
  },
  notesInput: {
    height: 100,
    textAlignVertical: 'top',
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
  },
  saveButton: {
    flex: 2,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '70%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  modalTitle: {
    fontSize: FontSizes.lg,
    fontWeight: '600',
    color: Colors.text,
  },
  hospitalList: {
    flex: 1,
  },
  hospitalItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  hospitalItemText: {
    flex: 1,
    marginLeft: Spacing.md,
  },
  hospitalName: {
    fontSize: FontSizes.md,
    fontWeight: '500',
    color: Colors.text,
  },
  hospitalCity: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
  },
  emptyText: {
    fontSize: FontSizes.md,
    color: Colors.textSecondary,
    marginTop: Spacing.md,
  },
});
