import { View, Text, StyleSheet, TouchableOpacity, Modal } from 'react-native';
import { useState, useEffect } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, FontSizes } from '@/constants/colors';
import { useTranslation } from '@/hooks/useTranslation';

interface TimePickerProps {
  value: string;
  onChange: (time: string) => void;
  label?: string;
}

export function TimePicker({ value, onChange, label }: TimePickerProps) {
  const [showPicker, setShowPicker] = useState(false);
  const { translations } = useTranslation();
  
  const parseTime = (timeStr: string) => {
    const parts = timeStr.split(':').map(Number);
    return {
      hours: isNaN(parts[0]) ? 9 : parts[0],
      minutes: isNaN(parts[1]) ? 0 : parts[1],
    };
  };
  
  const { hours, minutes } = parseTime(value);
  const [tempHours, setTempHours] = useState(hours);
  const [tempMinutes, setTempMinutes] = useState(minutes);
  
  useEffect(() => {
    const { hours: h, minutes: m } = parseTime(value);
    setTempHours(h);
    setTempMinutes(m);
  }, [value]);

  const formatTime = (h: number, m: number) => {
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
  };

  const handleOpen = () => {
    const { hours: h, minutes: m } = parseTime(value);
    setTempHours(h);
    setTempMinutes(m);
    setShowPicker(true);
  };

  const handleConfirm = () => {
    onChange(formatTime(tempHours, tempMinutes));
    setShowPicker(false);
  };

  const adjustHours = (delta: number) => {
    let newHours = tempHours + delta;
    if (newHours > 23) newHours = 0;
    if (newHours < 0) newHours = 23;
    setTempHours(newHours);
  };

  const adjustMinutes = (delta: number) => {
    let newMinutes = tempMinutes + delta;
    if (newMinutes >= 60) {
      newMinutes = 0;
      adjustHours(1);
    } else if (newMinutes < 0) {
      newMinutes = 55;
      adjustHours(-1);
    }
    setTempMinutes(newMinutes);
  };

  const setNow = () => {
    const now = new Date();
    setTempHours(now.getHours());
    setTempMinutes(Math.floor(now.getMinutes() / 5) * 5);
  };

  return (
    <>
      {label && <Text style={styles.label}>{label}</Text>}
      <TouchableOpacity
        style={styles.inputContainer}
        onPress={handleOpen}
        testID="button-open-time-picker"
      >
        <Ionicons name="time" size={20} color={Colors.primary} />
        <Text style={styles.timeText}>{value}</Text>
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
              <Text style={styles.modalTitle}>{translations.common.selectTime}</Text>
              <TouchableOpacity onPress={() => setShowPicker(false)}>
                <Ionicons name="close" size={24} color={Colors.text} />
              </TouchableOpacity>
            </View>

            <View style={styles.timeDisplay}>
              <Text style={styles.timeDisplayText}>
                {formatTime(tempHours, tempMinutes)}
              </Text>
            </View>

            <View style={styles.pickerRow}>
              <View style={styles.pickerColumn}>
                <Text style={styles.pickerLabel}>{translations.common.hour}</Text>
                <View style={styles.spinnerContainer}>
                  <TouchableOpacity
                    style={styles.spinnerButton}
                    onPress={() => adjustHours(1)}
                  >
                    <Ionicons name="chevron-up" size={24} color={Colors.primary} />
                  </TouchableOpacity>
                  <Text style={styles.spinnerValue}>
                    {tempHours.toString().padStart(2, '0')}
                  </Text>
                  <TouchableOpacity
                    style={styles.spinnerButton}
                    onPress={() => adjustHours(-1)}
                  >
                    <Ionicons name="chevron-down" size={24} color={Colors.primary} />
                  </TouchableOpacity>
                </View>
              </View>

              <Text style={styles.timeSeparator}>:</Text>

              <View style={styles.pickerColumn}>
                <Text style={styles.pickerLabel}>{translations.common.minute}</Text>
                <View style={styles.spinnerContainer}>
                  <TouchableOpacity
                    style={styles.spinnerButton}
                    onPress={() => adjustMinutes(5)}
                  >
                    <Ionicons name="chevron-up" size={24} color={Colors.primary} />
                  </TouchableOpacity>
                  <Text style={styles.spinnerValue}>
                    {tempMinutes.toString().padStart(2, '0')}
                  </Text>
                  <TouchableOpacity
                    style={styles.spinnerButton}
                    onPress={() => adjustMinutes(-5)}
                  >
                    <Ionicons name="chevron-down" size={24} color={Colors.primary} />
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            <TouchableOpacity style={styles.nowButton} onPress={setNow}>
              <Ionicons name="time-outline" size={18} color={Colors.primary} />
              <Text style={styles.nowButtonText}>{translations.common.now}</Text>
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
  timeText: {
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
    maxWidth: 300,
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
  timeDisplay: {
    alignItems: 'center',
    padding: Spacing.lg,
    backgroundColor: Colors.primary,
  },
  timeDisplayText: {
    fontSize: 48,
    fontWeight: 'bold',
    color: Colors.white,
  },
  pickerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.lg,
    gap: Spacing.md,
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
    fontSize: 32,
    fontWeight: '600',
    color: Colors.text,
    paddingVertical: Spacing.sm,
    minWidth: 60,
    textAlign: 'center',
  },
  timeSeparator: {
    fontSize: 32,
    fontWeight: '600',
    color: Colors.text,
    marginTop: 24,
  },
  nowButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.md,
    gap: Spacing.xs,
  },
  nowButtonText: {
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
