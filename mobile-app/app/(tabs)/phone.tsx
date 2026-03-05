import { View, Text, StyleSheet, TouchableOpacity, FlatList, TextInput, ActivityIndicator } from 'react-native';
import { useState, useEffect, useCallback } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from '@/hooks/useTranslation';
import { Colors, Spacing, FontSizes } from '@/constants/colors';
import { api } from '@/lib/api';
import { getCallHistory, saveCallToHistory, CallHistoryEntry } from '@/lib/callHistory';

type PhoneTab = 'keypad' | 'contacts' | 'recent';

interface CrmContact {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
}

export default function PhoneScreen() {
  const { translations } = useTranslation();
  const [activeTab, setActiveTab] = useState<PhoneTab>('keypad');
  const [dialNumber, setDialNumber] = useState('');
  const [contacts, setContacts] = useState<CrmContact[]>([]);
  const [contactSearch, setContactSearch] = useState('');
  const [contactsLoading, setContactsLoading] = useState(false);
  const [recentCalls, setRecentCalls] = useState<CallHistoryEntry[]>([]);
  const [recentLoading, setRecentLoading] = useState(false);

  const loadRecentCalls = useCallback(async () => {
    setRecentLoading(true);
    try {
      const history = await getCallHistory(50);
      setRecentCalls(history);
    } catch (error) {
      console.error('Failed to load call history:', error);
    } finally {
      setRecentLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'recent') {
      loadRecentCalls();
    }
  }, [activeTab, loadRecentCalls]);

  const searchContacts = useCallback(async (search: string) => {
    if (!search || search.length < 2) {
      setContacts([]);
      return;
    }
    setContactsLoading(true);
    try {
      const results = await api.get<CrmContact[]>(`/api/mobile/contacts?search=${encodeURIComponent(search)}`);
      setContacts(results);
    } catch (error) {
      console.error('Failed to search contacts:', error);
    } finally {
      setContactsLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (activeTab === 'contacts') {
        searchContacts(contactSearch);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [contactSearch, activeTab, searchContacts]);

  const handleKeyPress = (key: string) => {
    setDialNumber(prev => prev + key);
  };

  const handleBackspace = () => {
    setDialNumber(prev => prev.slice(0, -1));
  };

  const handleCall = async (number?: string) => {
    const phoneNumber = number || dialNumber;
    if (!phoneNumber) return;

    await saveCallToHistory({
      phoneNumber,
      direction: 'outbound',
      duration: 0,
      status: 'initiated',
      contactName: null,
      contactId: null,
    });

    try {
      await api.post('/api/mobile/call-log', {
        phoneNumber,
        direction: 'outbound',
        duration: 0,
        status: 'initiated',
      });
    } catch (error) {
      console.error('Failed to log call:', error);
    }

    loadRecentCalls();
  };

  const handleContactCall = async (contact: CrmContact) => {
    if (!contact.phone) return;

    await saveCallToHistory({
      phoneNumber: contact.phone,
      direction: 'outbound',
      duration: 0,
      status: 'initiated',
      contactName: contact.name,
      contactId: contact.id,
    });

    try {
      await api.post('/api/mobile/call-log', {
        phoneNumber: contact.phone,
        direction: 'outbound',
        duration: 0,
        status: 'initiated',
        customerId: contact.id,
      });
    } catch (error) {
      console.error('Failed to log call:', error);
    }

    loadRecentCalls();
  };

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatTime = (timestamp: string): string => {
    const date = new Date(timestamp);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    if (isToday) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  const keypadKeys = [
    ['1', '2', '3'],
    ['4', '5', '6'],
    ['7', '8', '9'],
    ['*', '0', '#'],
  ];

  const renderKeypad = () => (
    <View style={styles.keypadContainer}>
      <View style={styles.dialDisplay}>
        <Text style={styles.dialNumber} numberOfLines={1} adjustsFontSizeToFit>
          {dialNumber || ' '}
        </Text>
        {dialNumber.length > 0 && (
          <TouchableOpacity onPress={handleBackspace} style={styles.backspaceBtn}>
            <Ionicons name="backspace-outline" size={24} color={Colors.textSecondary} />
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.keypadGrid}>
        {keypadKeys.map((row, rowIndex) => (
          <View key={rowIndex} style={styles.keypadRow}>
            {row.map((key) => (
              <TouchableOpacity
                key={key}
                style={styles.keypadKey}
                onPress={() => handleKeyPress(key)}
                activeOpacity={0.6}
              >
                <Text style={styles.keypadKeyText}>{key}</Text>
              </TouchableOpacity>
            ))}
          </View>
        ))}
      </View>

      <TouchableOpacity
        style={[styles.callButton, !dialNumber && styles.callButtonDisabled]}
        onPress={() => handleCall()}
        disabled={!dialNumber}
        activeOpacity={0.7}
      >
        <Ionicons name="call" size={28} color={Colors.white} />
      </TouchableOpacity>
    </View>
  );

  const renderContacts = () => (
    <View style={styles.contactsContainer}>
      <View style={styles.searchBar}>
        <Ionicons name="search" size={20} color={Colors.textSecondary} />
        <TextInput
          style={styles.searchInput}
          placeholder={translations.phone.searchContacts}
          placeholderTextColor={Colors.textSecondary}
          value={contactSearch}
          onChangeText={setContactSearch}
        />
        {contactSearch.length > 0 && (
          <TouchableOpacity onPress={() => setContactSearch('')}>
            <Ionicons name="close-circle" size={20} color={Colors.textSecondary} />
          </TouchableOpacity>
        )}
      </View>

      {contactsLoading ? (
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : contacts.length === 0 ? (
        <View style={styles.centerContent}>
          <Ionicons name="people-outline" size={48} color={Colors.textSecondary} />
          <Text style={styles.emptyText}>
            {contactSearch.length < 2
              ? translations.phone.searchContacts
              : translations.phone.noContacts}
          </Text>
        </View>
      ) : (
        <FlatList
          data={contacts}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.contactItem}
              onPress={() => handleContactCall(item)}
              disabled={!item.phone}
              activeOpacity={0.7}
            >
              <View style={styles.contactAvatar}>
                <Text style={styles.contactAvatarText}>
                  {item.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                </Text>
              </View>
              <View style={styles.contactInfo}>
                <Text style={styles.contactName}>{item.name}</Text>
                {item.phone && <Text style={styles.contactPhone}>{item.phone}</Text>}
              </View>
              {item.phone && (
                <View style={styles.contactCallBtn}>
                  <Ionicons name="call" size={20} color={Colors.success} />
                </View>
              )}
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );

  const renderRecent = () => (
    <View style={styles.recentContainer}>
      {recentLoading ? (
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : recentCalls.length === 0 ? (
        <View style={styles.centerContent}>
          <Ionicons name="time-outline" size={48} color={Colors.textSecondary} />
          <Text style={styles.emptyText}>{translations.phone.noRecentCalls}</Text>
        </View>
      ) : (
        <FlatList
          data={recentCalls}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.recentItem}
              onPress={() => {
                setDialNumber(item.phoneNumber);
                setActiveTab('keypad');
              }}
              activeOpacity={0.7}
            >
              <View style={styles.recentIcon}>
                <Ionicons
                  name={
                    item.status === 'missed' ? 'call-outline' :
                    item.direction === 'outbound' ? 'arrow-up' : 'arrow-down'
                  }
                  size={18}
                  color={
                    item.status === 'missed' ? Colors.error :
                    item.direction === 'outbound' ? Colors.info : Colors.success
                  }
                />
              </View>
              <View style={styles.recentInfo}>
                <Text style={styles.recentName}>
                  {item.contactName || item.phoneNumber}
                </Text>
                {item.contactName && (
                  <Text style={styles.recentNumber}>{item.phoneNumber}</Text>
                )}
                <Text style={styles.recentMeta}>
                  {translations.phone[item.direction as 'outbound' | 'inbound']}
                  {item.duration > 0 ? ` · ${formatDuration(item.duration)}` : ''}
                </Text>
              </View>
              <Text style={styles.recentTime}>{formatTime(item.createdAt)}</Text>
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={[Colors.primary, Colors.primaryDark]}
        style={styles.headerGradient}
      >
        <SafeAreaView edges={['top']}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>{translations.phone.title}</Text>
          </View>
        </SafeAreaView>
      </LinearGradient>

      <View style={styles.tabBar}>
        {(['keypad', 'contacts', 'recent'] as PhoneTab[]).map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, activeTab === tab && styles.tabActive]}
            onPress={() => setActiveTab(tab)}
          >
            <Ionicons
              name={
                tab === 'keypad' ? 'keypad' :
                tab === 'contacts' ? 'people' : 'time'
              }
              size={20}
              color={activeTab === tab ? Colors.primary : Colors.textSecondary}
            />
            <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
              {translations.phone[tab]}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.content}>
        {activeTab === 'keypad' && renderKeypad()}
        {activeTab === 'contacts' && renderContacts()}
        {activeTab === 'recent' && renderRecent()}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  headerGradient: {
    paddingBottom: Spacing.md,
  },
  header: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
  },
  headerTitle: {
    fontSize: FontSizes.xxl,
    fontWeight: '700',
    color: Colors.white,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.sm + 2,
    gap: 6,
  },
  tabActive: {
    borderBottomWidth: 2,
    borderBottomColor: Colors.primary,
  },
  tabText: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  tabTextActive: {
    color: Colors.primary,
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  keypadContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.lg,
  },
  dialDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    marginBottom: Spacing.lg,
    paddingHorizontal: Spacing.md,
    minHeight: 48,
  },
  dialNumber: {
    fontSize: 32,
    fontWeight: '300',
    color: Colors.text,
    letterSpacing: 2,
    flex: 1,
    textAlign: 'center',
  },
  backspaceBtn: {
    padding: Spacing.sm,
    position: 'absolute',
    right: 0,
  },
  keypadGrid: {
    width: '100%',
    maxWidth: 300,
  },
  keypadRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: Spacing.md,
  },
  keypadKey: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  keypadKeyText: {
    fontSize: 28,
    fontWeight: '400',
    color: Colors.text,
  },
  callButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.success,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.lg,
  },
  callButtonDisabled: {
    backgroundColor: Colors.border,
  },
  contactsContainer: {
    flex: 1,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    margin: Spacing.md,
    paddingHorizontal: Spacing.md,
    borderRadius: 12,
    height: 44,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: FontSizes.md,
    color: Colors.text,
  },
  centerContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
  },
  emptyText: {
    fontSize: FontSizes.md,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  contactAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  contactAvatarText: {
    fontSize: FontSizes.md,
    fontWeight: '600',
    color: Colors.white,
  },
  contactInfo: {
    flex: 1,
  },
  contactName: {
    fontSize: FontSizes.md,
    fontWeight: '500',
    color: Colors.text,
  },
  contactPhone: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  contactCallBtn: {
    padding: Spacing.sm,
  },
  recentContainer: {
    flex: 1,
  },
  recentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  recentIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  recentInfo: {
    flex: 1,
  },
  recentName: {
    fontSize: FontSizes.md,
    fontWeight: '500',
    color: Colors.text,
  },
  recentNumber: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    marginTop: 1,
  },
  recentMeta: {
    fontSize: FontSizes.xs,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  recentTime: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
  },
});
