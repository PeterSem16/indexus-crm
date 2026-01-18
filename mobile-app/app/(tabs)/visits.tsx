import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useState, useMemo } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Link } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '@/components/ui/Card';
import { useTranslation } from '@/hooks/useTranslation';
import { useVisits } from '@/hooks/useVisits';
import { Colors, Spacing, FontSizes } from '@/constants/colors';

type ViewMode = 'calendar' | 'list';

const WEEKDAYS = ['Po', 'Ut', 'St', 'Št', 'Pi', 'So', 'Ne'];
const MONTHS = [
  'Január', 'Február', 'Marec', 'Apríl', 'Máj', 'Jún',
  'Júl', 'August', 'September', 'Október', 'November', 'December'
];

export default function VisitsScreen() {
  const [viewMode, setViewMode] = useState<ViewMode>('calendar');
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const { translations } = useTranslation();
  const { data: visits = [], isLoading, refetch } = useVisits();

  const handleMonthChange = (direction: 'prev' | 'next') => {
    const newMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + (direction === 'next' ? 1 : -1));
    setCurrentMonth(newMonth);
    setSelectedDate(new Date(newMonth.getFullYear(), newMonth.getMonth(), 1));
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('sk-SK', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  };

  const getVisitsForDate = (date: Date) => {
    return visits.filter((v: any) => {
      const dateStr = v.scheduledStart;
      if (!dateStr) return false;
      const visitDate = new Date(dateStr);
      if (isNaN(visitDate.getTime())) return false;
      return visitDate.toDateString() === date.toDateString();
    });
  };

  const selectedDateVisits = useMemo(() => getVisitsForDate(selectedDate), [selectedDate, visits]);

  const getCalendarDays = () => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    
    let startOffset = firstDay.getDay() - 1;
    if (startOffset < 0) startOffset = 6;
    
    const days: (number | null)[] = [];
    for (let i = 0; i < startOffset; i++) {
      days.push(null);
    }
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(i);
    }
    
    return days;
  };

  const hasVisitsOnDay = (day: number) => {
    const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
    return getVisitsForDate(date).length > 0;
  };

  const isToday = (day: number) => {
    const today = new Date();
    return (
      day === today.getDate() &&
      currentMonth.getMonth() === today.getMonth() &&
      currentMonth.getFullYear() === today.getFullYear()
    );
  };

  const isSelected = (day: number) => {
    return (
      day === selectedDate.getDate() &&
      currentMonth.getMonth() === selectedDate.getMonth() &&
      currentMonth.getFullYear() === selectedDate.getFullYear()
    );
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return Colors.success;
      case 'in_progress': return Colors.warning;
      case 'cancelled': return Colors.error;
      default: return Colors.info;
    }
  };

  const renderCalendar = () => (
    <View style={styles.calendarContainer}>
      <View style={styles.calendarHeader}>
        <TouchableOpacity 
          onPress={() => handleMonthChange('prev')}
          style={styles.calendarNavButton}
        >
          <Ionicons name="chevron-back" size={24} color={Colors.primary} />
        </TouchableOpacity>
        <Text style={styles.calendarMonth}>
          {MONTHS[currentMonth.getMonth()]} {currentMonth.getFullYear()}
        </Text>
        <TouchableOpacity 
          onPress={() => handleMonthChange('next')}
          style={styles.calendarNavButton}
        >
          <Ionicons name="chevron-forward" size={24} color={Colors.primary} />
        </TouchableOpacity>
      </View>

      <View style={styles.weekdaysRow}>
        {WEEKDAYS.map((day) => (
          <Text key={day} style={styles.weekdayText}>{day}</Text>
        ))}
      </View>

      <View style={styles.daysGrid}>
        {getCalendarDays().map((day, index) => (
          <TouchableOpacity
            key={index}
            style={[
              styles.dayCell,
              day && isToday(day) && styles.todayCell,
              day && isSelected(day) && styles.selectedDayCell,
            ]}
            onPress={() => day && setSelectedDate(new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day))}
            disabled={!day}
          >
            {day && (
              <>
                <Text style={[
                  styles.dayText,
                  isToday(day) && styles.todayText,
                  isSelected(day) && styles.selectedDayText,
                ]}>
                  {day}
                </Text>
                {hasVisitsOnDay(day) && (
                  <View style={[
                    styles.visitIndicator,
                    isSelected(day) && styles.visitIndicatorSelected
                  ]} />
                )}
              </>
            )}
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.selectedDateVisits}>
        <Text style={styles.selectedDateTitle}>{formatDate(selectedDate)}</Text>
        {selectedDateVisits.length === 0 ? (
          <Card style={styles.emptyCard}>
            <Text style={styles.emptyText}>{translations.visits.noVisits}</Text>
          </Card>
        ) : (
          selectedDateVisits.map((visit: any) => (
            <Link key={visit.id} href={`/visit/${visit.id}`} asChild>
              <TouchableOpacity>
                <Card style={styles.visitCard}>
                  <View style={styles.visitLeft}>
                    <View style={[styles.statusDot, { backgroundColor: getStatusColor(visit.status) }]} />
                    <Text style={styles.visitTime}>
                      {visit.scheduledStart ? new Date(visit.scheduledStart).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'N/A'}
                    </Text>
                  </View>
                  <View style={styles.visitInfo}>
                    <Text style={styles.visitHospital}>{visit.hospitalName || 'N/A'}</Text>
                    <Text style={styles.visitType}>{visit.visitType || visit.subject || 'N/A'}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={Colors.textSecondary} />
                </Card>
              </TouchableOpacity>
            </Link>
          ))
        )}
      </View>
    </View>
  );

  const renderList = () => {
    const groupedVisits = visits.reduce((acc: any, visit: any) => {
      const dateStr = visit.scheduledStart;
      if (!dateStr) return acc;
      const parsedDate = new Date(dateStr);
      if (isNaN(parsedDate.getTime())) return acc;
      const date = parsedDate.toDateString();
      if (!acc[date]) acc[date] = [];
      acc[date].push(visit);
      return acc;
    }, {});

    const sortedDates = Object.keys(groupedVisits).sort((a, b) => 
      new Date(b).getTime() - new Date(a).getTime()
    );

    return (
      <ScrollView style={styles.content}>
        {isLoading ? (
          <ActivityIndicator size="large" color={Colors.primary} style={styles.loader} />
        ) : visits.length === 0 ? (
          <Card style={styles.emptyCard}>
            <Ionicons name="calendar-outline" size={48} color={Colors.textSecondary} />
            <Text style={styles.emptyText}>{translations.visits.noVisits}</Text>
          </Card>
        ) : (
          sortedDates.map((date) => (
            <View key={date}>
              <Text style={styles.dateHeader}>
                {new Date(date).toLocaleDateString('sk-SK', { weekday: 'long', day: 'numeric', month: 'long' })}
              </Text>
              {groupedVisits[date].map((visit: any) => (
                <Link key={visit.id} href={`/visit/${visit.id}`} asChild>
                  <TouchableOpacity>
                    <Card style={styles.visitCard}>
                      <View style={styles.visitLeft}>
                        <View style={[styles.statusDot, { backgroundColor: getStatusColor(visit.status) }]} />
                        <Text style={styles.visitTime}>
                          {visit.scheduledStart ? new Date(visit.scheduledStart).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'N/A'}
                        </Text>
                      </View>
                      <View style={styles.visitInfo}>
                        <Text style={styles.visitHospital}>{visit.hospitalName || 'N/A'}</Text>
                        <Text style={styles.visitType}>{visit.visitType || visit.subject || 'N/A'}</Text>
                      </View>
                      <Ionicons name="chevron-forward" size={20} color={Colors.textSecondary} />
                    </Card>
                  </TouchableOpacity>
                </Link>
              ))}
            </View>
          ))
        )}
      </ScrollView>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{translations.visits.title}</Text>
        <View style={styles.viewToggle}>
          <TouchableOpacity
            style={[styles.toggleButton, viewMode === 'calendar' && styles.toggleButtonActive]}
            onPress={() => setViewMode('calendar')}
            testID="button-calendar-view"
          >
            <Ionicons 
              name="calendar" 
              size={18} 
              color={viewMode === 'calendar' ? Colors.white : Colors.textSecondary} 
            />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggleButton, viewMode === 'list' && styles.toggleButtonActive]}
            onPress={() => setViewMode('list')}
            testID="button-list-view"
          >
            <Ionicons 
              name="list" 
              size={18} 
              color={viewMode === 'list' ? Colors.white : Colors.textSecondary} 
            />
          </TouchableOpacity>
        </View>
      </View>

      {viewMode === 'calendar' ? renderCalendar() : renderList()}

      <Link href="/visit/new" asChild>
        <TouchableOpacity style={styles.fab} testID="button-new-visit">
          <Ionicons name="add" size={28} color={Colors.white} />
        </TouchableOpacity>
      </Link>
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
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.md,
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  title: {
    fontSize: FontSizes.xl,
    fontWeight: 'bold',
    color: Colors.text,
  },
  viewToggle: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderRadius: 8,
    padding: 2,
  },
  toggleButton: {
    padding: Spacing.sm,
    borderRadius: 6,
  },
  toggleButtonActive: {
    backgroundColor: Colors.primary,
  },
  content: {
    flex: 1,
    padding: Spacing.md,
  },
  loader: {
    marginTop: Spacing.xl,
  },
  calendarContainer: {
    flex: 1,
    backgroundColor: Colors.white,
  },
  calendarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  calendarNavButton: {
    padding: Spacing.sm,
  },
  calendarMonth: {
    fontSize: FontSizes.lg,
    fontWeight: '600',
    color: Colors.text,
  },
  weekdaysRow: {
    flexDirection: 'row',
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  weekdayText: {
    flex: 1,
    textAlign: 'center',
    fontSize: FontSizes.sm,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  daysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: Spacing.xs,
  },
  dayCell: {
    width: '14.28%',
    aspectRatio: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xs,
  },
  todayCell: {
    backgroundColor: Colors.surface,
    borderRadius: 8,
  },
  selectedDayCell: {
    backgroundColor: Colors.primary,
    borderRadius: 8,
  },
  dayText: {
    fontSize: FontSizes.md,
    color: Colors.text,
  },
  todayText: {
    fontWeight: 'bold',
  },
  selectedDayText: {
    color: Colors.white,
    fontWeight: 'bold',
  },
  visitIndicator: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.primary,
    marginTop: 2,
  },
  visitIndicatorSelected: {
    backgroundColor: Colors.white,
  },
  selectedDateVisits: {
    flex: 1,
    padding: Spacing.md,
    backgroundColor: Colors.background,
  },
  selectedDateTitle: {
    fontSize: FontSizes.md,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: Spacing.sm,
    textTransform: 'capitalize',
  },
  dateHeader: {
    fontSize: FontSizes.lg,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: Spacing.md,
    marginTop: Spacing.sm,
    textTransform: 'capitalize',
  },
  visitCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  visitLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: Spacing.sm,
  },
  visitTime: {
    fontSize: FontSizes.sm,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  visitInfo: {
    flex: 1,
  },
  visitHospital: {
    fontSize: FontSizes.md,
    fontWeight: '600',
    color: Colors.text,
  },
  visitType: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
  },
  emptyCard: {
    padding: Spacing.lg,
    alignItems: 'center',
  },
  emptyText: {
    color: Colors.textSecondary,
    fontSize: FontSizes.md,
    marginTop: Spacing.sm,
  },
  fab: {
    position: 'absolute',
    bottom: Spacing.xl,
    right: Spacing.lg,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 8,
  },
});
