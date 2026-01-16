import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useState } from 'react';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { useTranslation } from '@/hooks/useTranslation';
import { Colors, Spacing, FontSizes } from '@/constants/colors';

const VISIT_TYPES = [
  { id: 'delivery', label: 'Delivery', icon: 'cube' },
  { id: 'contract', label: 'Contract', icon: 'document-text' },
  { id: 'followup', label: 'Follow-up', icon: 'refresh' },
  { id: 'training', label: 'Training', icon: 'school' },
  { id: 'other', label: 'Other', icon: 'ellipsis-horizontal' },
];

export default function NewVisitScreen() {
  const router = useRouter();
  const { translations } = useTranslation();
  
  const [selectedHospital, setSelectedHospital] = useState<string>('');
  const [selectedType, setSelectedType] = useState<string>('');
  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduledTime, setScheduledTime] = useState('');
  const [notes, setNotes] = useState('');

  const handleSave = () => {
    router.back();
  };

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
          <TouchableOpacity style={styles.selectorButton}>
            <Ionicons name="business" size={20} color={Colors.textSecondary} />
            <Text style={styles.selectorText}>
              {selectedHospital || 'Select hospital'}
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
            placeholder="Date"
            value={scheduledDate}
            onChangeText={setScheduledDate}
            containerStyle={styles.dateInput}
            testID="input-date"
          />
          <Input
            placeholder="Time"
            value={scheduledTime}
            onChangeText={setScheduledTime}
            containerStyle={styles.timeInput}
            testID="input-time"
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
          style={styles.saveButton}
          testID="button-save-visit"
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
  },
  typeLabelSelected: {
    color: Colors.white,
  },
  dateTimeRow: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  dateInput: {
    flex: 2,
    marginBottom: 0,
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
});
