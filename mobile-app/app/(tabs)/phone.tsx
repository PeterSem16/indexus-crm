import { View, Text, StyleSheet, TouchableOpacity, FlatList, TextInput, ActivityIndicator, Vibration } from 'react-native';
import { useState, useEffect, useCallback } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from '@/hooks/useTranslation';
import { Colors, Spacing, FontSizes } from '@/constants/colors';
import { api } from '@/lib/api';
import { getCallHistory, saveCallToHistory, updateCallDuration, CallHistoryEntry } from '@/lib/callHistory';
import { useSipStore } from '@/stores/sipStore';

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
  const [showInCallDialpad, setShowInCallDialpad] = useState(false);
  const [currentCallHistoryId, setCurrentCallHistoryId] = useState<string | null>(null);

  const {
    registrationState, callState, callInfo, isConnecting,
    connect, disconnect, makeCall, answerCall, rejectCall,
    hangup, toggleMute, toggleHold, sendDtmf,
  } = useSipStore();

  useEffect(() => {
    if (registrationState === 'unregistered' || registrationState === 'error') {
      connect().catch(() => {});
    }
  }, []);

  useEffect(() => {
    if (registrationState === 'error') {
      const retryTimer = setTimeout(() => {
        connect().catch(() => {});
      }, 5000);
      return () => clearTimeout(retryTimer);
    }
  }, [registrationState]);

  useEffect(() => {
    if (callState === 'ringing' && callInfo.direction === 'inbound') {
      Vibration.vibrate([0, 500, 200, 500], true);
    }
  }, [callState, callInfo.direction]);

  useEffect(() => {
    if (callState === 'idle' && currentCallHistoryId) {
      updateCallDuration(currentCallHistoryId, callInfo.duration, 'completed').catch(() => {});
      setCurrentCallHistoryId(null);
      loadRecentCalls();
    }
  }, [callState]);

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
    if (callState === 'active' || callState === 'on_hold') {
      sendDtmf(key);
    } else {
      setDialNumber(prev => prev + key);
    }
  };

  const handleBackspace = () => {
    setDialNumber(prev => prev.slice(0, -1));
  };

  const initiateCall = async (phoneNumber: string, contactName?: string, contactId?: string) => {
    if (!phoneNumber) return;

    const historyId = await saveCallToHistory({
      phoneNumber,
      direction: 'outbound',
      duration: 0,
      status: 'initiated',
      contactName: contactName || null,
      contactId: contactId || null,
    });
    setCurrentCallHistoryId(historyId);

    const success = await makeCall(phoneNumber);
    if (!success) {
      await updateCallDuration(historyId, 0, 'failed');
      setCurrentCallHistoryId(null);
    }

    try {
      await api.post('/api/mobile/call-log', {
        phoneNumber,
        direction: 'outbound',
        duration: 0,
        status: success ? 'initiated' : 'failed',
        customerId: contactId,
      });
    } catch (error) {
      console.error('Failed to log call:', error);
    }

    loadRecentCalls();
  };

  const handleCall = () => initiateCall(dialNumber);

  const handleContactCall = (contact: CrmContact) => {
    if (!contact.phone) return;
    initiateCall(contact.phone, contact.name, contact.id);
  };

  const handleHangup = () => {
    hangup();
    setShowInCallDialpad(false);
  };

  const handleAnswer = () => {
    answerCall();
    Vibration.cancel();
  };

  const handleReject = () => {
    rejectCall();
    Vibration.cancel();
    setShowInCallDialpad(false);
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

  const hasActiveCall = callState !== 'idle' && callState !== 'ended';

  const renderActiveCall = () => (
    <View style={styles.activeCallContainer}>
      <LinearGradient
        colors={['#1a1a2e', '#16213e', '#0f3460']}
        style={styles.activeCallGradient}
      >
        <SafeAreaView edges={['top', 'bottom']} style={styles.activeCallSafe}>
          <View style={styles.activeCallHeader}>
            <Text style={styles.activeCallStatus}>
              {callState === 'connecting' ? translations.phone.connecting :
               callState === 'ringing' ? (callInfo.direction === 'inbound' ? translations.phone.incoming : translations.phone.calling) :
               callState === 'on_hold' ? translations.phone.onHold :
               translations.phone.connected}
            </Text>
          </View>

          <View style={styles.activeCallCenter}>
            <View style={styles.activeCallAvatar}>
              <Ionicons name="person" size={48} color="rgba(255,255,255,0.7)" />
            </View>
            <Text style={styles.activeCallNumber}>{callInfo.phoneNumber}</Text>
            {(callState === 'active' || callState === 'on_hold') && (
              <Text style={styles.activeCallDuration}>{formatDuration(callInfo.duration)}</Text>
            )}
            {callState === 'connecting' && (
              <ActivityIndicator size="small" color="rgba(255,255,255,0.6)" style={{ marginTop: 8 }} />
            )}
          </View>

          {showInCallDialpad && (callState === 'active' || callState === 'on_hold') && (
            <View style={styles.inCallDialpadGrid}>
              {keypadKeys.map((row, rowIndex) => (
                <View key={rowIndex} style={styles.inCallDialpadRow}>
                  {row.map((key) => (
                    <TouchableOpacity
                      key={key}
                      style={styles.inCallDialpadKey}
                      onPress={() => handleKeyPress(key)}
                      activeOpacity={0.6}
                    >
                      <Text style={styles.inCallDialpadKeyText}>{key}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              ))}
            </View>
          )}

          <View style={styles.activeCallControls}>
            {callState === 'ringing' && callInfo.direction === 'inbound' ? (
              <View style={styles.incomingControls}>
                <TouchableOpacity style={styles.rejectButton} onPress={handleReject} activeOpacity={0.7}>
                  <Ionicons name="close" size={32} color={Colors.white} />
                </TouchableOpacity>
                <TouchableOpacity style={styles.answerButton} onPress={handleAnswer} activeOpacity={0.7}>
                  <Ionicons name="call" size={32} color={Colors.white} />
                </TouchableOpacity>
              </View>
            ) : (
              <>
                {(callState === 'active' || callState === 'on_hold') && (
                  <View style={styles.callActionRow}>
                    <TouchableOpacity
                      style={[styles.callActionBtn, callInfo.isMuted && styles.callActionBtnActive]}
                      onPress={toggleMute}
                      activeOpacity={0.7}
                    >
                      <Ionicons name={callInfo.isMuted ? 'mic-off' : 'mic'} size={24} color={Colors.white} />
                      <Text style={styles.callActionLabel}>
                        {callInfo.isMuted ? translations.phone.unmute : translations.phone.mute}
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.callActionBtn, callInfo.isOnHold && styles.callActionBtnActive]}
                      onPress={toggleHold}
                      activeOpacity={0.7}
                    >
                      <Ionicons name={callInfo.isOnHold ? 'play' : 'pause'} size={24} color={Colors.white} />
                      <Text style={styles.callActionLabel}>
                        {callInfo.isOnHold ? translations.phone.unhold : translations.phone.hold}
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.callActionBtn, showInCallDialpad && styles.callActionBtnActive]}
                      onPress={() => setShowInCallDialpad(!showInCallDialpad)}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="keypad" size={24} color={Colors.white} />
                      <Text style={styles.callActionLabel}>{translations.phone.dialpad}</Text>
                    </TouchableOpacity>
                  </View>
                )}

                <TouchableOpacity style={styles.hangupButton} onPress={handleHangup} activeOpacity={0.7}>
                  <Ionicons name="call" size={32} color={Colors.white} style={{ transform: [{ rotate: '135deg' }] }} />
                </TouchableOpacity>
              </>
            )}
          </View>
        </SafeAreaView>
      </LinearGradient>
    </View>
  );

  const renderRegistrationBadge = () => {
    if (registrationState === 'registered') return null;

    return (
      <TouchableOpacity
        style={[
          styles.regBadge,
          registrationState === 'error' ? styles.regBadgeError : styles.regBadgeWarn,
        ]}
        onPress={() => connect()}
        activeOpacity={0.7}
      >
        {isConnecting ? (
          <ActivityIndicator size="small" color={Colors.white} />
        ) : (
          <Ionicons
            name={registrationState === 'error' ? 'alert-circle' : 'sync'}
            size={16}
            color={Colors.white}
          />
        )}
        <Text style={styles.regBadgeText}>
          {registrationState === 'error' ? translations.phone.sipNotConfigured :
           isConnecting ? translations.phone.connecting :
           translations.phone.webrtcDisabled}
        </Text>
      </TouchableOpacity>
    );
  };

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
        style={[styles.callButton, (!dialNumber || registrationState !== 'registered') && styles.callButtonDisabled]}
        onPress={handleCall}
        disabled={!dialNumber || registrationState !== 'registered'}
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
              disabled={!item.phone || registrationState !== 'registered'}
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

  if (hasActiveCall) {
    return renderActiveCall();
  }

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={[Colors.primary, Colors.primaryDark]}
        style={styles.headerGradient}
      >
        <SafeAreaView edges={['top']}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>{translations.phone.title}</Text>
            {registrationState === 'registered' && (
              <View style={styles.regDot} />
            )}
          </View>
        </SafeAreaView>
      </LinearGradient>

      {renderRegistrationBadge()}

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
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: FontSizes.xxl,
    fontWeight: '700',
    color: Colors.white,
  },
  regDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.success,
  },
  regBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs + 2,
  },
  regBadgeError: {
    backgroundColor: Colors.error,
  },
  regBadgeWarn: {
    backgroundColor: Colors.warning,
  },
  regBadgeText: {
    color: Colors.white,
    fontSize: FontSizes.sm,
    fontWeight: '500',
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
  activeCallContainer: {
    flex: 1,
  },
  activeCallGradient: {
    flex: 1,
  },
  activeCallSafe: {
    flex: 1,
    justifyContent: 'space-between',
  },
  activeCallHeader: {
    alignItems: 'center',
    paddingTop: Spacing.xl,
  },
  activeCallStatus: {
    fontSize: FontSizes.md,
    color: 'rgba(255,255,255,0.7)',
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  activeCallCenter: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  activeCallAvatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.lg,
  },
  activeCallNumber: {
    fontSize: FontSizes.xxl,
    fontWeight: '600',
    color: Colors.white,
    letterSpacing: 1,
  },
  activeCallDuration: {
    fontSize: FontSizes.xl,
    color: 'rgba(255,255,255,0.6)',
    marginTop: Spacing.sm,
    fontVariant: ['tabular-nums'],
  },
  activeCallControls: {
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.xxl,
    alignItems: 'center',
  },
  callActionRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.xl + 8,
    marginBottom: Spacing.xl,
  },
  callActionBtn: {
    alignItems: 'center',
    gap: 6,
    width: 64,
  },
  callActionBtnActive: {
    opacity: 1,
  },
  callActionLabel: {
    fontSize: FontSizes.xs,
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'center',
  },
  hangupButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.error,
    alignItems: 'center',
    justifyContent: 'center',
  },
  incomingControls: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 64,
  },
  rejectButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.error,
    alignItems: 'center',
    justifyContent: 'center',
  },
  answerButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.success,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inCallDialpadGrid: {
    paddingHorizontal: Spacing.xxl,
    paddingBottom: Spacing.md,
  },
  inCallDialpadRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: Spacing.sm,
  },
  inCallDialpadKey: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  inCallDialpadKeyText: {
    fontSize: 22,
    fontWeight: '400',
    color: Colors.white,
  },
});
