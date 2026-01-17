import { View, Text, StyleSheet, TouchableOpacity, Modal, ScrollView } from 'react-native';
import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, FontSizes } from '@/constants/colors';
import { useTranslation } from '@/hooks/useTranslation';
import { useSettingsStore } from '@/stores/settingsStore';

interface DatePickerProps {
  value: Date;
  onChange: (date: Date) => void;
  label?: string;
}

export function DatePicker({ value, onChange, label }: DatePickerProps) {
  const [showPicker, setShowPicker] = useState(false);
  const [tempDate, setTempDate] = useState(value);
  const { translations } = useTranslation();
  const { language } = useSettingsStore();

  const getLocaleCode = () => {
    const localeMap: Record<string, string> = {
      sk: 'sk-SK',
      cs: 'cs-CZ',
      hu: 'hu-HU',
      de: 'de-DE',
      it: 'it-IT',
      ro: 'ro-RO',
      en: 'en-US',
    };
    return localeMap[language] || 'en-US';
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString(getLocaleCode(), {
      day: 'numeric',
      month: 'numeric',
      year: 'numeric',
    });
  };

  const getMonthName = (date: Date) => {
    return date.toLocaleDateString(getLocaleCode(), { month: 'short' });
  };

  const getWeekdayName = (date: Date) => {
    return date.toLocaleDateString(getLocaleCode(), { weekday: 'long' });
  };

  const handleConfirm = () => {
    onChange(tempDate);
    setShowPicker(false);
  };

  const adjustDay = (delta: number) => {
    const newDate = new Date(tempDate);
    newDate.setDate(newDate.getDate() + delta);
    setTempDate(newDate);
  };

  const adjustMonth = (delta: number) => {
    const newDate = new Date(tempDate);
    newDate.setMonth(newDate.getMonth() + delta);
    setTempDate(newDate);
  };

  const adjustYear = (delta: number) => {
    const newDate = new Date(tempDate);
    newDate.setFullYear(newDate.getFullYear() + delta);
    setTempDate(newDate);
  };

  const setToday = () => {
    setTempDate(new Date());
  };

  return (
    <>
      {label && <Text style={styles.label}>{label}</Text>}
      <TouchableOpacity
        style={styles.inputContainer}
        onPress={() => {
          setTempDate(value);
          setShowPicker(true);
        }}
        testID="button-open-date-picker"
      >
        <Ionicons name="calendar" size={20} color={Colors.primary} />
        <Text style={styles.dateText}>{formatDate(value)}</Text>
        <Ionicons name="chevron-down" size={20} color={Colors.textSecondary} />
      </TouchableOpacity>

      <Modal
        visible={showPicker}
        transparent
        animationType="fade"
        onRequestClose={() => setShowPicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{translations.common.selectDate}</Text>
              <TouchableOpacity onPress={() => setShowPicker(false)}>
                <Ionicons name="close" size={24} color={Colors.text} />
              </TouchableOpacity>
            </View>

            <View style={styles.dateDisplay}>
              <Text style={styles.dateDisplayText}>{formatDate(tempDate)}</Text>
              <Text style={styles.dayName}>
                {getWeekdayName(tempDate)}
              </Text>
            </View>

            <View style={styles.pickerRow}>
              <View style={styles.pickerColumn}>
                <Text style={styles.pickerLabel}>{translations.common.day}</Text>
                <View style={styles.spinnerContainer}>
                  <TouchableOpacity
                    style={styles.spinnerButton}
                    onPress={() => adjustDay(1)}
                  >
                    <Ionicons name="chevron-up" size={24} color={Colors.primary} />
                  </TouchableOpacity>
                  <Text style={styles.spinnerValue}>{tempDate.getDate()}</Text>
                  <TouchableOpacity
                    style={styles.spinnerButton}
                    onPress={() => adjustDay(-1)}
                  >
                    <Ionicons name="chevron-down" size={24} color={Colors.primary} />
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.pickerColumn}>
                <Text style={styles.pickerLabel}>{translations.common.month}</Text>
                <View style={styles.spinnerContainer}>
                  <TouchableOpacity
                    style={styles.spinnerButton}
                    onPress={() => adjustMonth(1)}
                  >
                    <Ionicons name="chevron-up" size={24} color={Colors.primary} />
                  </TouchableOpacity>
                  <Text style={styles.spinnerValue}>{getMonthName(tempDate)}</Text>
                  <TouchableOpacity
                    style={styles.spinnerButton}
                    onPress={() => adjustMonth(-1)}
                  >
                    <Ionicons name="chevron-down" size={24} color={Colors.primary} />
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.pickerColumn}>
                <Text style={styles.pickerLabel}>{translations.common.year}</Text>
                <View style={styles.spinnerContainer}>
                  <TouchableOpacity
                    style={styles.spinnerButton}
                    onPress={() => adjustYear(1)}
                  >
                    <Ionicons name="chevron-up" size={24} color={Colors.primary} />
                  </TouchableOpacity>
                  <Text style={styles.spinnerValue}>{tempDate.getFullYear()}</Text>
                  <TouchableOpacity
                    style={styles.spinnerButton}
                    onPress={() => adjustYear(-1)}
                  >
                    <Ionicons name="chevron-down" size={24} color={Colors.primary} />
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            <TouchableOpacity style={styles.todayButton} onPress={setToday}>
              <Ionicons name="today" size={18} color={Colors.primary} />
              <Text style={styles.todayButtonText}>{translations.common.today}</Text>
            </TouchableOpacity>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setShowPicker(false)}
              >
                <Text style={styles.cancelButtonText}>{translations.common.cancel}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.confirmButton}
                onPress={handleConfirm}
              >
                <Text style={styles.confirmButtonText}>{translations.common.confirm}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  label: {
    fontSize: FontSizes.sm,
    fontWeight: '500',
    color: Colors.text,
    marginBottom: Spacing.xs,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  dateText: {
    flex: 1,
    fontSize: FontSizes.md,
    color: Colors.text,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.lg,
  },
  modalContent: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    width: '100%',
    maxWidth: 340,
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
  dateDisplay: {
    alignItems: 'center',
    padding: Spacing.lg,
    backgroundColor: Colors.primary,
  },
  dateDisplayText: {
    fontSize: FontSizes.xxl,
    fontWeight: 'bold',
    color: Colors.white,
  },
  dayName: {
    fontSize: FontSizes.md,
    color: Colors.white,
    opacity: 0.8,
    marginTop: Spacing.xs,
  },
  pickerRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    padding: Spacing.lg,
  },
  pickerColumn: {
    alignItems: 'center',
  },
  pickerLabel: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    marginBottom: Spacing.sm,
  },
  spinnerContainer: {
    alignItems: 'center',
  },
  spinnerButton: {
    padding: Spacing.sm,
  },
  spinnerValue: {
    fontSize: FontSizes.xl,
    fontWeight: '600',
    color: Colors.text,
    paddingVertical: Spacing.sm,
    minWidth: 60,
    textAlign: 'center',
  },
  todayButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.md,
    gap: Spacing.xs,
  },
  todayButtonText: {
    fontSize: FontSizes.md,
    color: Colors.primary,
    fontWeight: '500',
  },
  modalFooter: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  cancelButton: {
    flex: 1,
    padding: Spacing.md,
    alignItems: 'center',
    borderRightWidth: 1,
    borderRightColor: Colors.border,
  },
  cancelButtonText: {
    fontSize: FontSizes.md,
    color: Colors.textSecondary,
  },
  confirmButton: {
    flex: 1,
    padding: Spacing.md,
    alignItems: 'center',
  },
  confirmButtonText: {
    fontSize: FontSizes.md,
    color: Colors.primary,
    fontWeight: '600',
  },
});
