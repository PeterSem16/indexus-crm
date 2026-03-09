import { View, Text, StyleSheet, TouchableOpacity, FlatList, TextInput, ActivityIndicator, Vibration, ScrollView, Modal, Linking } from 'react-native';
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from '@/hooks/useTranslation';
import { Colors, Spacing, FontSizes } from '@/constants/colors';
import { api } from '@/lib/api';
import { getCallHistory, saveCallToHistory, updateCallDuration, updateCallLogId, CallHistoryEntry } from '@/lib/callHistory';
import { useSipStore } from '@/stores/sipStore';

interface ServerCallHistoryEntry {
  id: string;
  phoneNumber: string;
  direction: string;
  status: string;
  startedAt: string;
  endedAt: string | null;
  durationSeconds: number | null;
  contactName: string | null;
  customerId: string | null;
  notes: string | null;
}

interface PersonalContact {
  id: string;
  collaboratorId: string;
  name: string;
  lastName: string | null;
  phone: string;
  email: string | null;
  notes: string | null;
  type: string;
  linkedEntityType: string | null;
  linkedEntityId: string | null;
  createdAt: string;
}

type PhoneTab = 'keypad' | 'contacts' | 'recent';

interface CrmContact {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
}

interface HospitalContact {
  id: string;
  name: string;
  fullName: string | null;
  phone: string | null;
  email: string | null;
  city: string | null;
  contactPerson: string | null;
  countryCode: string;
}

interface ClinicContact {
  id: string;
  name: string;
  doctorName: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  countryCode: string;
}

interface RecordingInfo {
  id: string;
  callLogId: string;
  durationSeconds: number | null;
  phoneNumber: string | null;
  customerName: string | null;
  agentName: string | null;
  analysisStatus: string | null;
  sentiment: string | null;
  qualityScore: number | null;
  summary: string | null;
  createdAt: string;
}

interface CallAnalysis {
  id: string;
  analysisStatus: string;
  transcriptionText: string | null;
  sentiment: string | null;
  qualityScore: number | null;
  summary: string | null;
  keyTopics: string[] | null;
  actionItems: string[] | null;
  alertKeywords: string[] | null;
  complianceNotes: string | null;
  scriptComplianceScore: number | null;
  durationSeconds: number | null;
  analyzedAt: string | null;
  createdAt: string;
}

type ContactSection = 'customers' | 'hospitals' | 'clinics';

export default function PhoneScreen() {
  const { translations } = useTranslation();
  const params = useLocalSearchParams<{ dialNumber?: string }>();
  const [activeTab, setActiveTab] = useState<PhoneTab>('keypad');
  const [dialNumber, setDialNumber] = useState('');
  const [contacts, setContacts] = useState<CrmContact[]>([]);
  const [contactSearch, setContactSearch] = useState('');
  const [contactsLoading, setContactsLoading] = useState(false);
  const [recentCalls, setRecentCalls] = useState<CallHistoryEntry[]>([]);
  const [recentLoading, setRecentLoading] = useState(false);
  const [showInCallDialpad, setShowInCallDialpad] = useState(false);
  const [currentCallHistoryId, setCurrentCallHistoryId] = useState<string | null>(null);
  const [currentCallLogId, setCurrentCallLogId] = useState<string | null>(null);
  const [currentContactName, setCurrentContactName] = useState<string | undefined>(undefined);
  const [currentCustomerId, setCurrentCustomerId] = useState<string | undefined>(undefined);
  const [analysisModal, setAnalysisModal] = useState<CallAnalysis | null>(null);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const recordingStartedRef = useRef(false);

  const [hospitalContacts, setHospitalContacts] = useState<HospitalContact[]>([]);
  const [clinicContacts, setClinicContacts] = useState<ClinicContact[]>([]);
  const [facilitiesLoading, setFacilitiesLoading] = useState(false);
  const [activeContactSection, setActiveContactSection] = useState<ContactSection>('customers');

  const [expandedCallId, setExpandedCallId] = useState<string | null>(null);
  const [recordingInfo, setRecordingInfo] = useState<Record<string, RecordingInfo | null>>({});
  const [recordingLoadingId, setRecordingLoadingId] = useState<string | null>(null);
  const [playingRecordingId, setPlayingRecordingId] = useState<string | null>(null);
  const currentSoundRef = useRef<any>(null);
  const lastDurationRef = useRef(0);
  const [hospitalSearch, setHospitalSearch] = useState('');
  const [clinicSearch, setClinicSearch] = useState('');
  const [recentSearch, setRecentSearch] = useState('');

  const [saveContactModal, setSaveContactModal] = useState<{ phone: string; editId?: string } | null>(null);
  const [saveContactForm, setSaveContactForm] = useState({ firstName: '', lastName: '', phone: '', email: '', notes: '' });
  const [saveContactLoading, setSaveContactLoading] = useState(false);
  const [personalContacts, setPersonalContacts] = useState<PersonalContact[]>([]);

  const {
    registrationState, callState, callInfo, isConnecting,
    recordingState, callRecordingEnabled, debugMessages,
    connect, disconnect, makeCall, answerCall, rejectCall,
    hangup, toggleMute, toggleHold, sendDtmf,
    startRecording, stopAndUploadRecording,
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
    if (callState === 'active' && callRecordingEnabled && !recordingStartedRef.current) {
      recordingStartedRef.current = true;
      startRecording().catch(() => {});
    }
  }, [callState, callRecordingEnabled]);

  useEffect(() => {
    if (callInfo.duration > 0) {
      lastDurationRef.current = callInfo.duration;
    }
  }, [callInfo.duration]);

  useEffect(() => {
    if (callState === 'idle' && currentCallHistoryId) {
      const finalDuration = lastDurationRef.current || callInfo.duration;
      updateCallDuration(currentCallHistoryId, finalDuration, 'completed').catch(() => {});

      if (currentCallLogId) {
        api.post(`/api/mobile/call-log/${currentCallLogId}/duration`, {
          duration: finalDuration,
        }).catch(() => {});
      }

      lastDurationRef.current = 0;

      if (recordingStartedRef.current && currentCallLogId) {
        recordingStartedRef.current = false;
        stopAndUploadRecording({
          callLogId: currentCallLogId,
          phoneNumber: callInfo.phoneNumber || '',
          direction: callInfo.direction || 'outbound',
          durationSeconds: finalDuration,
          collaboratorName: 'Mobile Agent',
          customerName: currentContactName,
          customerId: currentCustomerId,
        }).catch(() => {});
      } else {
        recordingStartedRef.current = false;
      }

      setCurrentCallHistoryId(null);
      setCurrentCallLogId(null);
      setCurrentContactName(undefined);
      setCurrentCustomerId(undefined);
      setDialNumber('');
      loadRecentCalls();
    }
  }, [callState]);

  const loadRecentCalls = useCallback(async (search?: string) => {
    setRecentLoading(true);
    try {
      const searchParam = search !== undefined ? search : recentSearch;
      const serverHistory = await api.get<ServerCallHistoryEntry[]>(
        `/api/mobile/call-history?limit=100${searchParam ? `&search=${encodeURIComponent(searchParam)}` : ''}`
      );
      const mapped: CallHistoryEntry[] = serverHistory.map(h => ({
        id: h.id,
        phoneNumber: h.phoneNumber,
        direction: h.direction,
        duration: h.durationSeconds || 0,
        status: h.status,
        contactName: h.contactName,
        contactId: h.customerId,
        callLogId: h.id,
        createdAt: h.startedAt,
      }));
      setRecentCalls(mapped);
    } catch (error) {
      try {
        const history = await getCallHistory(50);
        setRecentCalls(history);
      } catch {}
      console.error('Failed to load call history:', error);
    } finally {
      setRecentLoading(false);
    }
  }, [recentSearch]);

  const loadPersonalContacts = useCallback(async () => {
    try {
      const contacts = await api.get<PersonalContact[]>('/api/mobile/contacts-personal');
      setPersonalContacts(contacts);
    } catch {}
  }, []);

  useEffect(() => {
    if (activeTab === 'recent') {
      loadRecentCalls();
      loadPersonalContacts();
    }
  }, [activeTab]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (activeTab === 'recent') {
        loadRecentCalls(recentSearch);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [recentSearch]);

  const loadFacilities = useCallback(async () => {
    setFacilitiesLoading(true);
    try {
      const [hospitals, clinics] = await Promise.all([
        api.get<HospitalContact[]>('/api/mobile/hospitals-contacts'),
        api.get<ClinicContact[]>('/api/mobile/clinics'),
      ]);
      setHospitalContacts(hospitals);
      setClinicContacts(clinics);
    } catch (error) {
      console.error('Failed to load facilities:', error);
    } finally {
      setFacilitiesLoading(false);
    }
  }, []);

  useEffect(() => {
    if (params.dialNumber) {
      setDialNumber(params.dialNumber);
      setActiveTab('keypad');
    }
  }, [params.dialNumber]);

  useEffect(() => {
    if (activeTab === 'contacts' && (activeContactSection === 'hospitals' || activeContactSection === 'clinics')) {
      if (hospitalContacts.length === 0 && clinicContacts.length === 0) {
        loadFacilities();
      }
    }
    if (activeTab === 'contacts' && activeContactSection === 'customers') {
      if (personalContacts.length === 0) {
        loadPersonalContacts();
      }
    }
  }, [activeTab, activeContactSection]);

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
      if (activeTab === 'contacts' && activeContactSection === 'customers') {
        searchContacts(contactSearch);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [contactSearch, activeTab, activeContactSection, searchContacts]);

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

    setCurrentContactName(contactName);
    setCurrentCustomerId(contactId);

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
      setCurrentContactName(undefined);
      setCurrentCustomerId(undefined);
    }

    try {
      const callLog = await api.post<{ id: string }>('/api/mobile/call-log', {
        phoneNumber,
        direction: 'outbound',
        duration: 0,
        status: success ? 'initiated' : 'failed',
        customerId: contactId,
      });
      if (callLog?.id) {
        setCurrentCallLogId(callLog.id);
        await updateCallLogId(historyId, callLog.id);
      }
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

  const handleHospitalCall = (hospital: HospitalContact) => {
    if (!hospital.phone) return;
    initiateCall(hospital.phone, hospital.name);
  };

  const handleClinicCall = (clinic: ClinicContact) => {
    if (!clinic.phone) return;
    initiateCall(clinic.phone, clinic.name);
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

  const fetchCallAnalysis = async (callLogId: string) => {
    setAnalysisLoading(true);
    try {
      const analysis = await api.get<CallAnalysis>(`/api/mobile/call-recording/${callLogId}/analysis`);
      setAnalysisModal(analysis);
    } catch (error: any) {
      console.error('Failed to fetch call analysis:', error);
    } finally {
      setAnalysisLoading(false);
    }
  };

  const fetchRecordingInfo = async (callLogId: string) => {
    if (recordingInfo[callLogId] !== undefined) return;
    setRecordingLoadingId(callLogId);
    try {
      const info = await api.get<RecordingInfo>(`/api/mobile/call-recordings/by-call-log/${callLogId}`);
      setRecordingInfo(prev => ({ ...prev, [callLogId]: info }));
    } catch (error: any) {
      setRecordingInfo(prev => ({ ...prev, [callLogId]: null }));
    } finally {
      setRecordingLoadingId(null);
    }
  };

  const handleExpandCall = (item: CallHistoryEntry) => {
    if (expandedCallId === item.id) {
      setExpandedCallId(null);
      return;
    }
    setExpandedCallId(item.id);
    if (item.callLogId) {
      fetchRecordingInfo(item.callLogId);
    }
  };

  const stopCurrentPlayback = async () => {
    if (currentSoundRef.current) {
      try {
        await currentSoundRef.current.stopAsync();
        await currentSoundRef.current.unloadAsync();
      } catch (_) {}
      currentSoundRef.current = null;
    }
    setPlayingRecordingId(null);
  };

  const handlePlayRecording = async (recording: RecordingInfo) => {
    try {
      if (playingRecordingId === recording.id) {
        await stopCurrentPlayback();
        return;
      }
      await stopCurrentPlayback();
      setPlayingRecordingId(recording.id);
      const { Audio } = await import('expo-av');
      const token = await api.getToken();
      const streamUrl = `${api.baseUrl}/api/mobile/call-recordings/${recording.id}/stream`;
      const { sound } = await Audio.Sound.createAsync(
        { uri: streamUrl, headers: { Authorization: `Bearer ${token}` } },
        { shouldPlay: true }
      );
      currentSoundRef.current = sound;
      sound.setOnPlaybackStatusUpdate((status: any) => {
        if (status.didJustFinish) {
          setPlayingRecordingId(null);
          sound.unloadAsync();
          currentSoundRef.current = null;
        }
      });
    } catch (error) {
      console.error('Failed to play recording:', error);
      setPlayingRecordingId(null);
      currentSoundRef.current = null;
    }
  };

  const getSentimentColor = (sentiment: string | null): string => {
    switch (sentiment) {
      case 'positive': return Colors.success;
      case 'negative': return Colors.error;
      case 'angry': return '#ff3333';
      default: return Colors.info;
    }
  };

  const getSentimentLabel = (sentiment: string | null): string => {
    switch (sentiment) {
      case 'positive': return translations.phone.sentimentPositive;
      case 'negative': return translations.phone.sentimentNegative;
      case 'angry': return translations.phone.sentimentAngry;
      default: return translations.phone.sentimentNeutral;
    }
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

  const formatDateTime = (timestamp: string): string => {
    const date = new Date(timestamp);
    return date.toLocaleString([], {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
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
            {recordingState === 'recording' && (
              <View style={styles.recordingIndicator}>
                <View style={styles.recordingDot} />
                <Text style={styles.recordingText}>{translations.phone.recording}</Text>
              </View>
            )}
            {recordingState === 'uploading' && (
              <View style={styles.recordingIndicator}>
                <ActivityIndicator size="small" color="#ff4444" />
                <Text style={styles.recordingText}>{translations.phone.uploadingRecording}</Text>
              </View>
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
           registrationState === 'registering' ? translations.phone.reconnecting :
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

  const renderContactSectionTabs = () => (
    <View style={styles.contactSectionTabs}>
      {(['customers', 'hospitals', 'clinics'] as ContactSection[]).map((section) => (
        <TouchableOpacity
          key={section}
          style={[styles.contactSectionTab, activeContactSection === section && styles.contactSectionTabActive]}
          onPress={() => setActiveContactSection(section)}
          activeOpacity={0.7}
        >
          <Ionicons
            name={section === 'customers' ? 'people' : section === 'hospitals' ? 'business' : 'medkit'}
            size={16}
            color={activeContactSection === section ? Colors.primary : Colors.textSecondary}
          />
          <Text style={[styles.contactSectionTabText, activeContactSection === section && styles.contactSectionTabTextActive]}>
            {translations.phone[section]}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  const filteredPersonalContacts = useMemo(() => {
    if (!contactSearch || contactSearch.length < 2) return personalContacts;
    const q = contactSearch.toLowerCase();
    return personalContacts.filter(c => {
      const fullName = `${c.name} ${c.lastName || ''}`.toLowerCase();
      return fullName.includes(q) || c.phone.toLowerCase().includes(q) || (c.email || '').toLowerCase().includes(q);
    });
  }, [personalContacts, contactSearch]);

  const allCustomerContacts: CrmContact[] = useMemo(() => {
    const personalAsCrm: CrmContact[] = filteredPersonalContacts.map(p => ({
      id: `personal-${p.id}`,
      name: `${p.name}${p.lastName ? ' ' + p.lastName : ''}`,
      phone: p.phone,
      email: p.email,
    }));
    return [...personalAsCrm, ...contacts];
  }, [filteredPersonalContacts, contacts]);

  const renderCustomerSearch = () => (
    <View style={styles.contactsContainer}>
      <View style={styles.searchBar}>
        <Ionicons name="search" size={20} color={Colors.textSecondary} />
        <TextInput
          style={styles.searchInput}
          placeholder={translations.phone.searchContacts}
          placeholderTextColor={Colors.textSecondary}
          value={contactSearch}
          onChangeText={setContactSearch}
          data-testid="input-contact-search"
        />
        {contactSearch.length > 0 && (
          <TouchableOpacity onPress={() => setContactSearch('')} data-testid="button-clear-search">
            <Ionicons name="close-circle" size={20} color={Colors.textSecondary} />
          </TouchableOpacity>
        )}
      </View>

      <TouchableOpacity
        style={styles.addContactBtn}
        onPress={() => {
          setSaveContactForm({ firstName: '', lastName: '', phone: '', email: '', notes: '' });
          setSaveContactModal({ phone: '' });
        }}
        activeOpacity={0.7}
        data-testid="button-add-new-contact"
      >
        <Ionicons name="person-add" size={18} color={Colors.primary} />
        <Text style={{ color: Colors.primary, fontWeight: '600', fontSize: FontSizes.sm }}>
          {translations.phone.addContact || "Add Contact"}
        </Text>
      </TouchableOpacity>

      {contactsLoading ? (
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : allCustomerContacts.length === 0 ? (
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
          data={allCustomerContacts}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => {
            const isPersonal = item.id.startsWith('personal-');
            const personalId = isPersonal ? item.id.replace('personal-', '') : null;
            const personalContact = personalId ? personalContacts.find(c => c.id === personalId) : null;
            return (
              <View style={styles.contactItem} data-testid={`contact-customer-${item.id}`}>
                <View style={[styles.contactAvatar, isPersonal && { backgroundColor: Colors.info + '20' }]}>
                  <Text style={[styles.contactAvatarText, isPersonal && { color: Colors.info }]}>
                    {item.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                  </Text>
                </View>
                <View style={[styles.contactInfo, { flex: 1 }]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={styles.contactName} numberOfLines={1}>{item.name}</Text>
                    {isPersonal && (
                      <View style={{ backgroundColor: Colors.info + '20', paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4 }}>
                        <Text style={{ fontSize: 10, color: Colors.info, fontWeight: '600' }}>
                          {translations.phone.personal || "Personal"}
                        </Text>
                      </View>
                    )}
                  </View>
                  {item.phone && <Text style={styles.contactPhone}>{item.phone}</Text>}
                  {item.email && <Text style={[styles.contactPhone, { fontSize: FontSizes.xs }]}>{item.email}</Text>}
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  {item.phone && (
                    <TouchableOpacity
                      style={styles.contactActionBtn}
                      onPress={() => handleContactCall(item)}
                      activeOpacity={0.6}
                      data-testid={`button-call-${item.id}`}
                    >
                      <Ionicons name="call" size={18} color={Colors.success} />
                    </TouchableOpacity>
                  )}
                  {item.email && (
                    <TouchableOpacity
                      style={styles.contactActionBtn}
                      onPress={() => Linking.openURL(`mailto:${item.email}`)}
                      activeOpacity={0.6}
                      data-testid={`button-email-${item.id}`}
                    >
                      <Ionicons name="mail" size={18} color={Colors.primary} />
                    </TouchableOpacity>
                  )}
                  {isPersonal && personalContact && (
                    <>
                      <TouchableOpacity
                        style={styles.contactActionBtn}
                        onPress={() => handleEditContact(personalContact)}
                        activeOpacity={0.6}
                        data-testid={`button-edit-${item.id}`}
                      >
                        <Ionicons name="create-outline" size={18} color={Colors.textSecondary} />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.contactActionBtn}
                        onPress={() => handleDeleteContact(personalContact.id)}
                        activeOpacity={0.6}
                        data-testid={`button-delete-${item.id}`}
                      >
                        <Ionicons name="trash-outline" size={16} color={Colors.error} />
                      </TouchableOpacity>
                    </>
                  )}
                </View>
              </View>
            );
          }}
        />
      )}
    </View>
  );

  const filteredHospitals = hospitalContacts.filter(h => {
    if (!hospitalSearch || hospitalSearch.length < 2) return true;
    const q = hospitalSearch.toLowerCase();
    return (h.name?.toLowerCase().includes(q) || h.city?.toLowerCase().includes(q) || h.contactPerson?.toLowerCase().includes(q) || h.phone?.toLowerCase().includes(q));
  });

  const filteredClinics = clinicContacts.filter(c => {
    if (!clinicSearch || clinicSearch.length < 2) return true;
    const q = clinicSearch.toLowerCase();
    return (c.name?.toLowerCase().includes(q) || c.doctorName?.toLowerCase().includes(q) || c.city?.toLowerCase().includes(q) || c.phone?.toLowerCase().includes(q));
  });

  const renderHospitals = () => (
    <View style={styles.contactsContainer}>
      <View style={styles.searchBar}>
        <Ionicons name="search" size={20} color={Colors.textSecondary} />
        <TextInput
          style={styles.searchInput}
          placeholder={translations.phone.searchContacts}
          placeholderTextColor={Colors.textSecondary}
          value={hospitalSearch}
          onChangeText={setHospitalSearch}
          data-testid="input-hospital-search"
        />
        {hospitalSearch.length > 0 && (
          <TouchableOpacity onPress={() => setHospitalSearch('')} data-testid="button-clear-hospital-search">
            <Ionicons name="close-circle" size={20} color={Colors.textSecondary} />
          </TouchableOpacity>
        )}
      </View>
      {facilitiesLoading ? (
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : filteredHospitals.length === 0 ? (
        <View style={styles.centerContent}>
          <Ionicons name="business-outline" size={48} color={Colors.textSecondary} />
          <Text style={styles.emptyText}>{translations.phone.noHospitals}</Text>
        </View>
      ) : (
        <FlatList
          data={filteredHospitals}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.contactItem}
              onPress={() => handleHospitalCall(item)}
              disabled={!item.phone || registrationState !== 'registered'}
              activeOpacity={0.7}
              data-testid={`contact-hospital-${item.id}`}
            >
              <View style={[styles.contactAvatar, { backgroundColor: '#2196F3' }]}>
                <Ionicons name="business" size={20} color={Colors.white} />
              </View>
              <View style={styles.contactInfo}>
                <Text style={styles.contactName} numberOfLines={1}>{item.name}</Text>
                {item.city && (
                  <Text style={styles.contactPhone}>{item.city} · {item.countryCode}</Text>
                )}
                {item.contactPerson && (
                  <Text style={styles.contactMeta}>
                    {translations.phone.contactPerson}: {item.contactPerson}
                  </Text>
                )}
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

  const renderClinics = () => (
    <View style={styles.contactsContainer}>
      <View style={styles.searchBar}>
        <Ionicons name="search" size={20} color={Colors.textSecondary} />
        <TextInput
          style={styles.searchInput}
          placeholder={translations.phone.searchContacts}
          placeholderTextColor={Colors.textSecondary}
          value={clinicSearch}
          onChangeText={setClinicSearch}
          data-testid="input-clinic-search"
        />
        {clinicSearch.length > 0 && (
          <TouchableOpacity onPress={() => setClinicSearch('')} data-testid="button-clear-clinic-search">
            <Ionicons name="close-circle" size={20} color={Colors.textSecondary} />
          </TouchableOpacity>
        )}
      </View>
      {facilitiesLoading ? (
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : filteredClinics.length === 0 ? (
        <View style={styles.centerContent}>
          <Ionicons name="medkit-outline" size={48} color={Colors.textSecondary} />
          <Text style={styles.emptyText}>{translations.phone.noClinics}</Text>
        </View>
      ) : (
        <FlatList
          data={filteredClinics}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.contactItem}
              onPress={() => handleClinicCall(item)}
              disabled={!item.phone || registrationState !== 'registered'}
              activeOpacity={0.7}
              data-testid={`contact-clinic-${item.id}`}
            >
              <View style={[styles.contactAvatar, { backgroundColor: '#4CAF50' }]}>
                <Ionicons name="medkit" size={20} color={Colors.white} />
              </View>
              <View style={styles.contactInfo}>
                <Text style={styles.contactName} numberOfLines={1}>{item.name}</Text>
                {item.doctorName && (
                  <Text style={styles.contactMeta}>
                    {translations.phone.doctor}: {item.doctorName}
                  </Text>
                )}
                {item.city && (
                  <Text style={styles.contactPhone}>{item.city} · {item.countryCode}</Text>
                )}
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

  const renderContacts = () => (
    <View style={styles.contactsContainer}>
      {renderContactSectionTabs()}
      {activeContactSection === 'customers' && renderCustomerSearch()}
      {activeContactSection === 'hospitals' && renderHospitals()}
      {activeContactSection === 'clinics' && renderClinics()}
    </View>
  );

  const getContactNameForPhone = useCallback((phone: string) => {
    const personal = personalContacts.find(c => c.phone === phone || phone.includes(c.phone) || c.phone.includes(phone));
    if (!personal) return null;
    return `${personal.name}${personal.lastName ? ' ' + personal.lastName : ''}`.trim();
  }, [personalContacts]);

  const handleSaveContact = async () => {
    if (!saveContactModal || !saveContactForm.firstName.trim() || !saveContactForm.phone.trim()) return;
    setSaveContactLoading(true);
    try {
      const payload = {
        name: saveContactForm.firstName.trim(),
        lastName: saveContactForm.lastName.trim() || null,
        phone: saveContactForm.phone.trim(),
        email: saveContactForm.email.trim() || null,
        notes: saveContactForm.notes.trim() || null,
        type: 'personal',
      };
      if (saveContactModal.editId) {
        await api.put(`/api/mobile/contacts-personal/${saveContactModal.editId}`, payload);
      } else {
        await api.post('/api/mobile/contacts-personal', payload);
      }
      await loadPersonalContacts();
      setSaveContactModal(null);
      setSaveContactForm({ firstName: '', lastName: '', phone: '', email: '', notes: '' });
    } catch (error) {
      console.error('Failed to save contact:', error);
    } finally {
      setSaveContactLoading(false);
    }
  };

  const handleDeleteContact = async (contactId: string) => {
    try {
      await api.delete(`/api/mobile/contacts-personal/${contactId}`);
      await loadPersonalContacts();
    } catch (error) {
      console.error('Failed to delete contact:', error);
    }
  };

  const handleEditContact = (contact: PersonalContact) => {
    setSaveContactForm({
      firstName: contact.name,
      lastName: contact.lastName || '',
      phone: contact.phone,
      email: contact.email || '',
      notes: contact.notes || '',
    });
    setSaveContactModal({ phone: contact.phone, editId: contact.id });
  };

  const renderRecent = () => (
    <View style={styles.recentContainer}>
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={18} color={Colors.textSecondary} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder={translations.phone.searchCalls || "Search calls..."}
          placeholderTextColor={Colors.textSecondary}
          value={recentSearch}
          onChangeText={setRecentSearch}
          data-testid="input-recent-search"
        />
        {recentSearch.length > 0 && (
          <TouchableOpacity onPress={() => setRecentSearch('')} data-testid="button-clear-recent-search">
            <Ionicons name="close-circle" size={18} color={Colors.textSecondary} />
          </TouchableOpacity>
        )}
      </View>
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
          renderItem={({ item }) => {
            const isExpanded = expandedCallId === item.id;
            const recording = item.callLogId ? recordingInfo[item.callLogId] : undefined;
            const isLoadingRecording = recordingLoadingId === item.callLogId;

            return (
              <View>
                <TouchableOpacity
                  style={styles.recentItem}
                  onPress={() => handleExpandCall(item)}
                  activeOpacity={0.7}
                  data-testid={`recent-call-${item.id}`}
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
                      {item.contactName || getContactNameForPhone(item.phoneNumber) || item.phoneNumber}
                    </Text>
                    {(item.contactName || getContactNameForPhone(item.phoneNumber)) && (
                      <Text style={styles.recentNumber}>{item.phoneNumber}</Text>
                    )}
                    <Text style={styles.recentMeta}>
                      {translations.phone[item.direction as 'outbound' | 'inbound']}
                      {item.duration > 0 ? ` · ${formatDuration(item.duration)}` : ''}
                    </Text>
                  </View>
                  <View style={styles.recentRight}>
                    <Text style={styles.recentTime}>{formatTime(item.createdAt)}</Text>
                    <Ionicons
                      name={isExpanded ? 'chevron-up' : 'chevron-down'}
                      size={16}
                      color={Colors.textSecondary}
                    />
                  </View>
                </TouchableOpacity>

                {isExpanded && (
                  <View style={styles.recentExpanded}>
                    <View style={styles.recentDetailRow}>
                      <Ionicons name="calendar-outline" size={14} color={Colors.textSecondary} />
                      <Text style={styles.recentDetailText}>{formatDateTime(item.createdAt)}</Text>
                    </View>
                    <View style={styles.recentDetailRow}>
                      <Ionicons name="time-outline" size={14} color={Colors.textSecondary} />
                      <Text style={styles.recentDetailText}>
                        {translations.phone.duration}: {formatDuration(item.duration)}
                      </Text>
                    </View>
                    <View style={styles.recentDetailRow}>
                      <Ionicons
                        name={item.direction === 'outbound' ? 'arrow-up-circle-outline' : 'arrow-down-circle-outline'}
                        size={14}
                        color={Colors.textSecondary}
                      />
                      <Text style={styles.recentDetailText}>
                        {translations.phone[item.direction as 'outbound' | 'inbound']}
                      </Text>
                    </View>

                    <View style={styles.recentActions}>
                      <TouchableOpacity
                        style={styles.recentActionBtn}
                        onPress={() => {
                          setDialNumber(item.phoneNumber);
                          setActiveTab('keypad');
                        }}
                        activeOpacity={0.7}
                        data-testid={`button-redial-${item.id}`}
                      >
                        <Ionicons name="call" size={16} color={Colors.success} />
                        <Text style={[styles.recentActionText, { color: Colors.success }]}>
                          {translations.phone.call}
                        </Text>
                      </TouchableOpacity>

                      {!item.contactName && !getContactNameForPhone(item.phoneNumber) && (
                        <TouchableOpacity
                          style={styles.recentActionBtn}
                          onPress={() => {
                            setSaveContactForm({ firstName: '', lastName: '', phone: item.phoneNumber, email: '', notes: '' });
                            setSaveContactModal({ phone: item.phoneNumber });
                          }}
                          activeOpacity={0.7}
                          data-testid={`button-save-contact-${item.id}`}
                        >
                          <Ionicons name="person-add" size={16} color={Colors.primary} />
                          <Text style={[styles.recentActionText, { color: Colors.primary }]}>
                            {translations.phone.saveContact || "Save Contact"}
                          </Text>
                        </TouchableOpacity>
                      )}

                      {item.callLogId && (
                        <>
                          {isLoadingRecording ? (
                            <ActivityIndicator size="small" color={Colors.primary} style={{ marginLeft: 12 }} />
                          ) : recording ? (
                            <TouchableOpacity
                              style={styles.recentActionBtn}
                              onPress={() => handlePlayRecording(recording)}
                              activeOpacity={0.7}
                              data-testid={`button-play-recording-${item.id}`}
                            >
                              <Ionicons
                                name={playingRecordingId === recording.id ? 'stop-circle' : 'play-circle'}
                                size={16}
                                color={Colors.primary}
                              />
                              <Text style={[styles.recentActionText, { color: Colors.primary }]}>
                                {translations.phone.playRecording}
                              </Text>
                            </TouchableOpacity>
                          ) : recording === null ? (
                            <View style={styles.recentActionBtn}>
                              <Ionicons name="mic-off-outline" size={14} color={Colors.textSecondary} />
                              <Text style={[styles.recentActionText, { color: Colors.textSecondary }]}>
                                {translations.phone.noRecording}
                              </Text>
                            </View>
                          ) : null}

                          {recording && (
                            <TouchableOpacity
                              style={styles.recentActionBtn}
                              onPress={() => fetchCallAnalysis(item.callLogId!)}
                              activeOpacity={0.7}
                              data-testid={`button-analysis-${item.id}`}
                            >
                              <Ionicons name="analytics" size={16} color={Colors.info} />
                              <Text style={[styles.recentActionText, { color: Colors.info }]}>
                                {translations.phone.callAnalysis}
                              </Text>
                            </TouchableOpacity>
                          )}
                        </>
                      )}
                    </View>

                    {recording && recording.summary && (
                      <View style={styles.recentSummary}>
                        <Text style={styles.recentSummaryTitle}>{translations.phone.summary}</Text>
                        <Text style={styles.recentSummaryText} numberOfLines={3}>{recording.summary}</Text>
                      </View>
                    )}
                  </View>
                )}
              </View>
            );
          }}
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
            <View style={{ flex: 1 }} />
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
            data-testid={`tab-${tab}`}
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

      <Modal
        visible={analysisModal !== null || analysisLoading}
        animationType="slide"
        transparent={true}
        onRequestClose={() => { setAnalysisModal(null); setAnalysisLoading(false); }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{translations.phone.callAnalysis}</Text>
              <TouchableOpacity onPress={() => { setAnalysisModal(null); setAnalysisLoading(false); }} data-testid="button-close-analysis">
                <Ionicons name="close" size={24} color={Colors.text} />
              </TouchableOpacity>
            </View>

            {analysisLoading ? (
              <View style={styles.modalLoading}>
                <ActivityIndicator size="large" color={Colors.primary} />
                <Text style={styles.modalLoadingText}>{translations.phone.loadingAnalysis}</Text>
              </View>
            ) : analysisModal ? (
              <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
                {analysisModal.analysisStatus === 'processing' ? (
                  <View style={styles.analysisPending}>
                    <ActivityIndicator size="small" color={Colors.primary} />
                    <Text style={styles.analysisPendingText}>{translations.phone.analysisProcessing}</Text>
                  </View>
                ) : analysisModal.analysisStatus === 'failed' ? (
                  <View style={styles.analysisPending}>
                    <Ionicons name="alert-circle" size={24} color={Colors.error} />
                    <Text style={styles.analysisPendingText}>{translations.phone.analysisFailed}</Text>
                  </View>
                ) : (
                  <>
                    <View style={styles.analysisRow}>
                      <View style={[styles.sentimentBadge, { backgroundColor: getSentimentColor(analysisModal.sentiment) }]}>
                        <Text style={styles.sentimentText}>{getSentimentLabel(analysisModal.sentiment)}</Text>
                      </View>
                      {analysisModal.qualityScore !== null && (
                        <View style={styles.qualityBadge}>
                          <Text style={styles.qualityLabel}>{translations.phone.quality}</Text>
                          <Text style={styles.qualityScore}>{analysisModal.qualityScore}/10</Text>
                        </View>
                      )}
                    </View>

                    {analysisModal.summary && (
                      <View style={styles.analysisSection}>
                        <Text style={styles.analysisSectionTitle}>{translations.phone.summary}</Text>
                        <Text style={styles.analysisSectionText}>{analysisModal.summary}</Text>
                      </View>
                    )}

                    {analysisModal.keyTopics && analysisModal.keyTopics.length > 0 && (
                      <View style={styles.analysisSection}>
                        <Text style={styles.analysisSectionTitle}>{translations.phone.keyTopics}</Text>
                        {analysisModal.keyTopics.map((topic, i) => (
                          <View key={i} style={styles.topicItem}>
                            <View style={styles.topicDot} />
                            <Text style={styles.topicText}>{topic}</Text>
                          </View>
                        ))}
                      </View>
                    )}

                    {analysisModal.actionItems && analysisModal.actionItems.length > 0 && (
                      <View style={styles.analysisSection}>
                        <Text style={styles.analysisSectionTitle}>{translations.phone.actionItems}</Text>
                        {analysisModal.actionItems.map((item, i) => (
                          <View key={i} style={styles.topicItem}>
                            <Ionicons name="checkbox-outline" size={14} color={Colors.primary} />
                            <Text style={styles.topicText}>{item}</Text>
                          </View>
                        ))}
                      </View>
                    )}

                    {analysisModal.alertKeywords && analysisModal.alertKeywords.length > 0 && (
                      <View style={styles.analysisSection}>
                        <Text style={[styles.analysisSectionTitle, { color: Colors.error }]}>{translations.phone.alerts}</Text>
                        <View style={styles.alertRow}>
                          {analysisModal.alertKeywords.map((kw, i) => (
                            <View key={i} style={styles.alertBadge}>
                              <Text style={styles.alertBadgeText}>{kw}</Text>
                            </View>
                          ))}
                        </View>
                      </View>
                    )}

                    {analysisModal.transcriptionText && (
                      <View style={styles.analysisSection}>
                        <Text style={styles.analysisSectionTitle}>{translations.phone.transcription}</Text>
                        <Text style={styles.transcriptionText}>{analysisModal.transcriptionText}</Text>
                      </View>
                    )}
                  </>
                )}
              </ScrollView>
            ) : null}
          </View>
        </View>
      </Modal>

      <Modal
        visible={saveContactModal !== null}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setSaveContactModal(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: '75%' }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{saveContactModal?.editId ? (translations.phone.editContact || "Edit Contact") : (translations.phone.saveContact || "Save Contact")}</Text>
              <TouchableOpacity onPress={() => setSaveContactModal(null)} data-testid="button-close-save-contact">
                <Ionicons name="close" size={24} color={Colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              style={{ paddingHorizontal: Spacing.lg }}
              contentContainerStyle={{ paddingBottom: Spacing.md }}
              keyboardShouldPersistTaps="handled"
            >
              <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.saveContactLabel}>{translations.phone.firstName || "First name"} *</Text>
                  <TextInput
                    style={styles.saveContactInput}
                    placeholder={translations.phone.firstName || "First name"}
                    placeholderTextColor={Colors.textSecondary}
                    value={saveContactForm.firstName}
                    onChangeText={(v) => setSaveContactForm(f => ({ ...f, firstName: v }))}
                    autoFocus
                    data-testid="input-save-contact-firstname"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.saveContactLabel}>{translations.phone.lastName || "Last name"}</Text>
                  <TextInput
                    style={styles.saveContactInput}
                    placeholder={translations.phone.lastName || "Last name"}
                    placeholderTextColor={Colors.textSecondary}
                    value={saveContactForm.lastName}
                    onChangeText={(v) => setSaveContactForm(f => ({ ...f, lastName: v }))}
                    data-testid="input-save-contact-lastname"
                  />
                </View>
              </View>

              <Text style={styles.saveContactLabel}>{translations.phone.phoneNumber || "Phone"} *</Text>
              <TextInput
                style={styles.saveContactInput}
                placeholder={translations.phone.phoneNumber || "Phone number"}
                placeholderTextColor={Colors.textSecondary}
                value={saveContactForm.phone}
                onChangeText={(v) => setSaveContactForm(f => ({ ...f, phone: v }))}
                keyboardType="phone-pad"
                data-testid="input-save-contact-phone"
              />

              <Text style={styles.saveContactLabel}>{translations.phone.email || "Email"}</Text>
              <TextInput
                style={styles.saveContactInput}
                placeholder={translations.phone.email || "Email"}
                placeholderTextColor={Colors.textSecondary}
                value={saveContactForm.email}
                onChangeText={(v) => setSaveContactForm(f => ({ ...f, email: v }))}
                keyboardType="email-address"
                autoCapitalize="none"
                data-testid="input-save-contact-email"
              />

              <Text style={styles.saveContactLabel}>{translations.phone.notesLabel || "Notes"}</Text>
              <TextInput
                style={[styles.saveContactInput, { height: 60, textAlignVertical: 'top' }]}
                placeholder={translations.phone.notesLabel || "Notes"}
                placeholderTextColor={Colors.textSecondary}
                value={saveContactForm.notes}
                onChangeText={(v) => setSaveContactForm(f => ({ ...f, notes: v }))}
                multiline
                data-testid="input-save-contact-notes"
              />
            </ScrollView>

            <View style={{ paddingHorizontal: Spacing.lg, paddingBottom: Spacing.md }}>
              <TouchableOpacity
                style={[styles.saveContactButton, { opacity: (saveContactForm.firstName.trim() && saveContactForm.phone.trim()) ? 1 : 0.5 }]}
                onPress={handleSaveContact}
                disabled={!saveContactForm.firstName.trim() || !saveContactForm.phone.trim() || saveContactLoading}
                data-testid="button-confirm-save-contact"
              >
                {saveContactLoading ? (
                  <ActivityIndicator size="small" color={Colors.white} />
                ) : (
                  <Text style={{ color: Colors.white, fontWeight: '600', textAlign: 'center', fontSize: FontSizes.md }}>
                    {translations.phone.save || "Save"}
                  </Text>
                )}
              </TouchableOpacity>
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
  contactSectionTabs: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    marginHorizontal: Spacing.md,
    marginTop: Spacing.sm,
    borderRadius: 10,
    padding: 3,
  },
  contactSectionTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.xs + 2,
    gap: 4,
    borderRadius: 8,
  },
  contactSectionTabActive: {
    backgroundColor: Colors.white,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  contactSectionTabText: {
    fontSize: FontSizes.xs,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  contactSectionTabTextActive: {
    color: Colors.primary,
    fontWeight: '600',
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
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    marginHorizontal: Spacing.md,
    marginTop: Spacing.sm,
    marginBottom: Spacing.xs,
    paddingHorizontal: Spacing.md,
    borderRadius: 12,
    height: 44,
    gap: 8,
  },
  searchIcon: {
    marginRight: 4,
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
  contactMeta: {
    fontSize: FontSizes.xs,
    color: Colors.textSecondary,
    marginTop: 1,
    fontStyle: 'italic',
  },
  contactCallBtn: {
    padding: Spacing.sm,
  },
  contactActionBtn: {
    padding: 6,
    borderRadius: 16,
    backgroundColor: Colors.surface,
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
  recentRight: {
    alignItems: 'flex-end',
    gap: 4,
  },
  recentTime: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
  },
  recentExpanded: {
    backgroundColor: Colors.surface,
    paddingHorizontal: Spacing.md + 36 + Spacing.md,
    paddingVertical: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  recentDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  recentDetailText: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
  },
  recentActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: Spacing.sm,
    paddingTop: Spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
  },
  recentActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
    backgroundColor: Colors.white,
  },
  recentActionText: {
    fontSize: FontSizes.xs,
    fontWeight: '500',
  },
  recentSummary: {
    marginTop: Spacing.sm,
    paddingTop: Spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
  },
  recentSummaryTitle: {
    fontSize: FontSizes.xs,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 2,
  },
  recentSummaryText: {
    fontSize: FontSizes.xs,
    color: Colors.textSecondary,
    lineHeight: 16,
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
  recordingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: 'rgba(255,68,68,0.2)',
  },
  recordingDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#ff4444',
  },
  recordingText: {
    fontSize: FontSizes.sm,
    color: '#ff4444',
    fontWeight: '500',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '85%',
    paddingBottom: Spacing.xxl,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  modalTitle: {
    fontSize: FontSizes.lg,
    fontWeight: '600',
    color: Colors.text,
  },
  modalLoading: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.xxl,
    gap: Spacing.md,
  },
  modalLoadingText: {
    fontSize: FontSizes.md,
    color: Colors.textSecondary,
  },
  modalScroll: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
  },
  saveContactLabel: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    fontWeight: '500',
    marginBottom: 4,
    marginTop: 10,
  },
  saveContactInput: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: FontSizes.md,
    color: Colors.text,
    backgroundColor: Colors.surface,
  },
  saveContactButton: {
    backgroundColor: Colors.primary,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addContactBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    marginHorizontal: Spacing.md,
    marginBottom: Spacing.xs,
    backgroundColor: Colors.primary + '10',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.primary + '30',
    borderStyle: 'dashed',
  },
  analysisPending: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.xl,
    gap: Spacing.sm,
  },
  analysisPendingText: {
    fontSize: FontSizes.md,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  analysisRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    marginBottom: Spacing.lg,
  },
  sentimentBadge: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: 16,
  },
  sentimentText: {
    fontSize: FontSizes.sm,
    fontWeight: '600',
    color: Colors.white,
  },
  qualityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: Colors.surface,
  },
  qualityLabel: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
  },
  qualityScore: {
    fontSize: FontSizes.sm,
    fontWeight: '700',
    color: Colors.text,
  },
  analysisSection: {
    marginBottom: Spacing.lg,
  },
  analysisSectionTitle: {
    fontSize: FontSizes.md,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: Spacing.sm,
  },
  analysisSectionText: {
    fontSize: FontSizes.md,
    color: Colors.textSecondary,
    lineHeight: 22,
  },
  topicItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 4,
  },
  topicDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.primary,
    marginTop: 7,
  },
  topicText: {
    fontSize: FontSizes.md,
    color: Colors.textSecondary,
    flex: 1,
  },
  alertRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  alertBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: 8,
    backgroundColor: 'rgba(255,0,0,0.1)',
  },
  alertBadgeText: {
    fontSize: FontSizes.xs,
    color: Colors.error,
    fontWeight: '500',
  },
  transcriptionText: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    lineHeight: 20,
    fontStyle: 'italic',
  },
});
