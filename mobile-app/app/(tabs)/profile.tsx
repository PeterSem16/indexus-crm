import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Switch, Modal, Image, Share, Clipboard, ActivityIndicator, TextInput } from 'react-native';
import { useState, useRef, useEffect } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as FileSystem from 'expo-file-system';
// expo-sharing loaded lazily to avoid missing-types TS error
const getSharingModule = (): { shareAsync: (uri: string, opts?: any) => Promise<void>; isAvailableAsync: () => Promise<boolean> } =>
  require('expo-sharing');
import { useAuth } from '@/hooks/useAuth';
import { useTranslation } from '@/hooks/useTranslation';
import { useSettingsStore } from '@/stores/settingsStore';
import { useSyncStore } from '@/stores/syncStore';
import { useSipStore } from '@/stores/sipStore';
import { Colors, Spacing, FontSizes } from '@/constants/colors';
import { SUPPORTED_LANGUAGES, SupportedLanguage } from '@/constants/config';
import { API_BASE_URL } from '@/constants/config';
import { runDiagnostics, formatDiagReport, DiagTest, DiagStatus } from '@/lib/turnDiagnostics';
import { useAppVersion } from '@/hooks/useAppVersion';

export default function ProfileScreen() {
  const { user, logout } = useAuth();
  const { translations, language } = useTranslation();
  const setLanguage = useSettingsStore((state) => state.setLanguage);
  const notificationsEnabled = useSettingsStore((state) => state.notificationsEnabled);
  const setNotificationsEnabled = useSettingsStore((state) => state.setNotificationsEnabled);
  const { lastSyncAt, pendingCount, isOnline } = useSyncStore();
  const { registrationState, debugMessages, iceStats, clearDebugMessages, forceReconnect, connect, isConnecting } = useSipStore();
  const appVersion = useAppVersion();
  const [showLanguagePicker, setShowLanguagePicker] = useState(false);
  const [showPhoneLog, setShowPhoneLog] = useState(false);
  const [logTab, setLogTab] = useState<'turn' | 'log'>('turn');
  const phoneLogScrollRef = useRef<ScrollView>(null);
  const [diagResults, setDiagResults] = useState<DiagTest[] | null>(null);
  const [diagRunning, setDiagRunning] = useState(false);
  const [reregistering, setReregistering] = useState(false);
  const [callForwardingEnabled, setCallForwardingEnabled] = useState(false);
  const [callForwardingNumber, setCallForwardingNumber] = useState('');
  const [savingForwarding, setSavingForwarding] = useState(false);
  const [forwardingLoaded, setForwardingLoaded] = useState(false);

  const loadForwardingSettings = async () => {
    if (forwardingLoaded) return;
    try {
      const { api } = await import('@/lib/api');
      const data = await api.get<{ enabled: boolean; number: string }>('/api/mobile/call-forwarding');
      setCallForwardingEnabled(data.enabled ?? false);
      setCallForwardingNumber(data.number ?? '');
      setForwardingLoaded(true);
    } catch {}
  };

  const handleSaveForwarding = async () => {
    setSavingForwarding(true);
    try {
      const { api } = await import('@/lib/api');
      await api.put<{ enabled: boolean; number: string }>('/api/mobile/call-forwarding', {
        enabled: callForwardingEnabled,
        number: callForwardingNumber,
      });
      Alert.alert('✓', translations.profile.forwardingSaved);
    } catch {
      Alert.alert('!', translations.profile.forwardingError);
    } finally {
      setSavingForwarding(false);
    }
  };

  useEffect(() => {
    loadForwardingSettings();
  }, []);

  const handleLogout = () => {
    Alert.alert(
      translations.auth.logout,
      translations.profile.logoutConfirm,
      [
        { text: translations.common.cancel, style: 'cancel' },
        { text: translations.auth.logout, style: 'destructive', onPress: logout },
      ]
    );
  };

  const handleLanguageSelect = (lang: SupportedLanguage) => {
    setLanguage(lang);
    setShowLanguagePicker(false);
  };

  const buildLogContent = () => {
    const now = new Date();
    const header = [
      `INDEXUS Connect — Phone Log`,
      `Version: ${appVersion}`,
      `Exported: ${now.toLocaleString()}`,
      `SIP: ${registrationState}`,
      `----------------------------------------`,
      '',
    ].join('\n');
    const body = debugMessages.length > 0 ? debugMessages.join('\n') : 'No SIP log entries.';
    return header + body;
  };

  const sharePhoneLog = async () => {
    try {
      const content = buildLogContent();
      await Share.share({ message: content, title: 'INDEXUS Phone Log' });
    } catch (err: any) {
      Alert.alert('Chyba', err?.message || 'Nepodarilo sa zdieľať log');
    }
  };

  const copyPhoneLog = () => {
    const content = buildLogContent();
    Clipboard.setString(content);
    Alert.alert('Skopírované', 'Phone Log bol skopírovaný do schránky');
  };

  const exportLogAsFile = async () => {
    try {
      const diagSection = diagResults
        ? '\n\n' + formatDiagReport(diagResults, `SIP: ${registrationState}`)
        : '';
      const content = buildLogContent() + diagSection;
      const filename = `indexus-diag-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.txt`;
      const path = `${FileSystem.cacheDirectory}${filename}`;
      await FileSystem.writeAsStringAsync(path, content, { encoding: FileSystem.EncodingType.UTF8 });
      const Sharing = getSharingModule();
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(path, { mimeType: 'text/plain', dialogTitle: 'Odoslať diagnostiku', UTI: 'public.plain-text' });
      } else {
        Alert.alert('Uložené', `Súbor: ${path}`);
      }
    } catch (err: any) {
      Alert.alert('Chyba exportu', err?.message || String(err));
    }
  };

  const handleRunDiag = async () => {
    if (diagRunning) return;
    setDiagRunning(true);
    setDiagResults(null);
    try {
      await runDiagnostics((results) => setDiagResults([...results]));
    } finally {
      setDiagRunning(false);
    }
  };

  const handleReregister = async () => {
    if (reregistering || isConnecting) return;
    setReregistering(true);
    try {
      await forceReconnect();
    } finally {
      setReregistering(false);
    }
  };

  const formatLastSync = () => {
    if (!lastSyncAt) return translations.common.never;
    const now = new Date();
    const diff = now.getTime() - lastSyncAt.getTime();
    const minutes = Math.floor(diff / 60000);
    
    if (minutes < 1) return translations.common.justNow;
    if (minutes < 60) return `${minutes} ${translations.common.minutesAgo}`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} ${translations.common.hoursAgo}`;
    return lastSyncAt.toLocaleDateString();
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={[Colors.primary, Colors.primaryDark, '#2A0515']}
        style={styles.headerGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <SafeAreaView edges={['top']}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>{translations.profile.title}</Text>
          </View>
          
          <View style={styles.profileSection}>
            <View style={styles.avatarContainer}>
              {user?.avatarUrl ? (
                <Image
                  source={{ uri: `${API_BASE_URL}${user.avatarUrl}` }}
                  style={styles.avatarImage}
                />
              ) : (
                <Text style={styles.avatarText}>
                  {user?.firstName?.[0]}{user?.lastName?.[0]}
                </Text>
              )}
            </View>
            <Text style={styles.userName}>{user?.firstName} {user?.lastName}</Text>
            <View style={styles.countryBadge}>
              <Ionicons name="location" size={14} color={Colors.white} />
              <Text style={styles.countryText}>{user?.countryCode}</Text>
            </View>
          </View>
        </SafeAreaView>
      </LinearGradient>

      <ScrollView 
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.syncStatusCard}>
          <View style={styles.syncStatusHeader}>
            <Ionicons name="cloud" size={20} color={Colors.primary} />
            <Text style={styles.syncStatusTitle}>{translations.profile.syncStatus}</Text>
            <View style={[styles.onlineIndicator, { backgroundColor: isOnline ? Colors.success : Colors.warning }]} />
          </View>
          <View style={styles.syncStatusBody}>
            <View style={styles.syncItem}>
              <Text style={styles.syncLabel}>{translations.profile.lastSync}</Text>
              <Text style={styles.syncValue}>{formatLastSync()}</Text>
            </View>
            <View style={styles.syncDivider} />
            <View style={styles.syncItem}>
              <Text style={styles.syncLabel}>{translations.profile.pending}</Text>
              <View style={styles.pendingBadge}>
                <Text style={styles.pendingText}>{pendingCount}</Text>
              </View>
            </View>
          </View>
        </View>

        <Text style={styles.sectionTitle}>{translations.profile.settings}</Text>
        
        <View style={styles.settingsCard}>
          <TouchableOpacity 
            style={styles.settingsItem} 
            onPress={() => setShowLanguagePicker(true)}
            testID="button-change-language"
          >
            <View style={styles.settingsIconContainer}>
              <Ionicons name="language" size={20} color={Colors.primary} />
            </View>
            <View style={styles.settingsContent}>
              <Text style={styles.settingsLabel}>{translations.profile.language}</Text>
              <Text style={styles.settingsDescription}>{translations.profile.languageDescription}</Text>
            </View>
            <View style={styles.settingsValueContainer}>
              <Text style={styles.settingsValue}>{translations.languageCodes[language]}</Text>
              <Ionicons name="chevron-forward" size={20} color={Colors.textSecondary} />
            </View>
          </TouchableOpacity>

          <View style={styles.divider} />

          <View style={styles.settingsItem}>
            <View style={styles.settingsIconContainer}>
              <Ionicons name="notifications" size={20} color={Colors.primary} />
            </View>
            <View style={styles.settingsContent}>
              <Text style={styles.settingsLabel}>{translations.profile.notifications}</Text>
              <Text style={styles.settingsDescription}>{translations.profile.notificationsDescription}</Text>
            </View>
            <Switch
              value={notificationsEnabled}
              onValueChange={setNotificationsEnabled}
              trackColor={{ false: Colors.border, true: Colors.primaryLight }}
              thumbColor={notificationsEnabled ? Colors.primary : Colors.textSecondary}
              testID="switch-notifications"
            />
          </View>
        </View>

        <Text style={styles.sectionTitle}>{translations.profile.callForwardingTitle}</Text>

        <View style={styles.settingsCard}>
          <View style={styles.settingsItem}>
            <View style={styles.settingsIconContainer}>
              <Ionicons name="call-outline" size={20} color={Colors.primary} />
            </View>
            <View style={styles.settingsContent}>
              <Text style={styles.settingsLabel}>{translations.profile.callForwardingLabel}</Text>
              <Text style={styles.settingsDescription}>{translations.profile.callForwardingDesc}</Text>
            </View>
            <Switch
              value={callForwardingEnabled}
              onValueChange={setCallForwardingEnabled}
              trackColor={{ false: Colors.border, true: Colors.primaryLight }}
              thumbColor={callForwardingEnabled ? Colors.primary : Colors.textSecondary}
              testID="switch-call-forwarding"
            />
          </View>

          {callForwardingEnabled && (
            <>
              <View style={styles.divider} />
              <View style={styles.forwardingInputRow}>
                <Ionicons name="phone-portrait-outline" size={18} color={Colors.textSecondary} style={{ marginRight: 8 }} />
                <TextInput
                  style={styles.forwardingInput}
                  value={callForwardingNumber}
                  onChangeText={setCallForwardingNumber}
                  placeholder={translations.profile.callForwardingPlaceholder}
                  placeholderTextColor={Colors.textSecondary}
                  keyboardType="phone-pad"
                  autoCorrect={false}
                  testID="input-forwarding-number"
                />
              </View>
              <View style={styles.divider} />
              <TouchableOpacity
                style={[styles.forwardingSaveBtn, savingForwarding && { opacity: 0.6 }]}
                onPress={handleSaveForwarding}
                disabled={savingForwarding}
                testID="button-save-forwarding"
              >
                {savingForwarding
                  ? <ActivityIndicator size="small" color={Colors.white} />
                  : <Text style={styles.forwardingSaveBtnText}>{translations.profile.callForwardingSave}</Text>
                }
              </TouchableOpacity>
            </>
          )}

          {!callForwardingEnabled && (
            <>
              <View style={styles.divider} />
              <TouchableOpacity
                style={[styles.forwardingSaveBtn, savingForwarding && { opacity: 0.6 }]}
                onPress={handleSaveForwarding}
                disabled={savingForwarding}
                testID="button-disable-forwarding"
              >
                {savingForwarding
                  ? <ActivityIndicator size="small" color={Colors.white} />
                  : <Text style={styles.forwardingSaveBtnText}>{translations.profile.callForwardingSave}</Text>
                }
              </TouchableOpacity>
            </>
          )}
        </View>

        <Text style={styles.sectionTitle}>{translations.profile.about}</Text>

        <View style={styles.settingsCard}>
          <View style={styles.settingsItem}>
            <View style={styles.settingsIconContainer}>
              <Ionicons name="information-circle" size={20} color={Colors.primary} />
            </View>
            <View style={styles.settingsContent}>
              <Text style={styles.settingsLabel}>{translations.profile.version}</Text>
              <Text style={styles.settingsDescription}>{translations.common.brandName} {translations.common.appName}</Text>
            </View>
            <Text style={styles.versionNumber}>{translations.common.versionPrefix}{appVersion}</Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.settingsItem}>
            <View style={styles.settingsIconContainer}>
              <Ionicons name="shield-checkmark" size={20} color={Colors.success} />
            </View>
            <View style={styles.settingsContent}>
              <Text style={styles.settingsLabel}>{translations.profile.status}</Text>
              <Text style={styles.settingsDescription}>{translations.profile.accountActive}</Text>
            </View>
            <View style={styles.activeBadge}>
              <Text style={styles.activeText}>{translations.common.active}</Text>
            </View>
          </View>

          <View style={styles.divider} />

          <TouchableOpacity
            style={styles.settingsItem}
            onPress={() => setShowPhoneLog(true)}
            testID="button-phone-log"
          >
            <View style={styles.settingsIconContainer}>
              <Ionicons name="call" size={20} color={Colors.primary} />
            </View>
            <View style={styles.settingsContent}>
              <Text style={styles.settingsLabel}>{translations.profile.phoneLog}</Text>
              <Text style={styles.settingsDescription}>SIP: {registrationState}</Text>
            </View>
            <View style={styles.settingsValueContainer}>
              <View style={[styles.onlineIndicator, { backgroundColor: registrationState === 'registered' ? Colors.success : Colors.warning }]} />
              <Ionicons name="chevron-forward" size={20} color={Colors.textSecondary} />
            </View>
          </TouchableOpacity>
        </View>

        <TouchableOpacity 
          style={styles.logoutButton} 
          onPress={handleLogout}
          testID="button-logout"
        >
          <LinearGradient
            colors={[Colors.error, '#C62828']}
            style={styles.logoutGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <Ionicons name="log-out" size={22} color={Colors.white} />
            <Text style={styles.logoutText}>{translations.auth.logout}</Text>
          </LinearGradient>
        </TouchableOpacity>

        <View style={styles.footerSpace} />
      </ScrollView>

      <Modal
        visible={showPhoneLog}
        animationType="slide"
        transparent={false}
        statusBarTranslucent
        onRequestClose={() => setShowPhoneLog(false)}
      >
        <SafeAreaView edges={['top', 'bottom']} style={styles.phoneLogScreen}>

          {/* ── Header ── */}
          <View style={styles.phoneLogScreenHeader}>
            <View style={styles.phoneLogScreenStatus}>
              <View style={[styles.onlineIndicator, { backgroundColor: registrationState === 'registered' ? Colors.success : Colors.warning }]} />
              <Text style={styles.phoneLogScreenStatusText}>SIP: {registrationState}</Text>
            </View>
            <Text style={styles.phoneLogScreenTitle}>{translations.profile.diagnosticsTitle}</Text>
            <View style={styles.modalHeaderActions}>
              <TouchableOpacity onPress={copyPhoneLog} style={styles.phoneLogActionBtn} testID="button-copy-phone-log">
                <Ionicons name="copy-outline" size={20} color="#ffaa00" />
              </TouchableOpacity>
              <TouchableOpacity onPress={sharePhoneLog} style={styles.phoneLogActionBtn} testID="button-share-phone-log">
                <Ionicons name="share-outline" size={20} color="#ffaa00" />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setShowPhoneLog(false)} style={styles.phoneLogActionBtn} testID="button-close-phone-log">
                <Ionicons name="close" size={22} color="#ffffff" />
              </TouchableOpacity>
            </View>
          </View>

          {/* ── Tabs ── */}
          <View style={styles.logTabs}>
            <TouchableOpacity
              style={[styles.logTab, logTab === 'turn' && styles.logTabActive]}
              onPress={() => setLogTab('turn')}
              testID="button-tab-turn"
            >
              <Ionicons name="wifi" size={14} color={logTab === 'turn' ? '#00e5ff' : '#666688'} />
              <Text style={[styles.logTabText, logTab === 'turn' && styles.logTabTextActive]}>TURN / ICE</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.logTab, logTab === 'log' && styles.logTabActive]}
              onPress={() => setLogTab('log')}
              testID="button-tab-log"
            >
              <Ionicons name="terminal" size={14} color={logTab === 'log' ? '#ffaa00' : '#666688'} />
              <Text style={[styles.logTabText, logTab === 'log' && { color: '#ffaa00' }]}>
                {translations.profile.phoneLog} ({debugMessages.length})
              </Text>
            </TouchableOpacity>
          </View>

          {/* ── TURN / ICE Tab ── */}
          {logTab === 'turn' && (
            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 14, paddingBottom: 50 }}>

              {/* Action buttons */}
              <View style={styles.diagActionRow}>
                <TouchableOpacity
                  style={[styles.diagActionBtn, diagRunning && { opacity: 0.6 }]}
                  onPress={handleRunDiag}
                  disabled={diagRunning}
                  testID="button-run-diag"
                >
                  {diagRunning
                    ? <ActivityIndicator size="small" color="#00e5ff" />
                    : <Ionicons name="pulse" size={16} color="#00e5ff" />
                  }
                  <Text style={styles.diagActionBtnText}>
                    {diagRunning ? translations.profile.runningDiag : translations.profile.runDiag}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.diagActionBtn, { borderColor: '#44ff8850' }, (reregistering || isConnecting) && { opacity: 0.6 }]}
                  onPress={handleReregister}
                  disabled={reregistering || isConnecting}
                  testID="button-reregister"
                >
                  {(reregistering || isConnecting)
                    ? <ActivityIndicator size="small" color="#44ff88" />
                    : <Ionicons name="refresh" size={16} color="#44ff88" />
                  }
                  <Text style={[styles.diagActionBtnText, { color: '#44ff88' }]}>
                    {reregistering || isConnecting ? translations.profile.reregistering : translations.profile.reregisterSip}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Export button */}
              <TouchableOpacity style={styles.diagExportBtn} onPress={exportLogAsFile} testID="button-export-log">
                <Ionicons name="mail-outline" size={15} color="#ffaa00" />
                <Text style={styles.diagExportBtnText}>{translations.profile.exportLog}</Text>
              </TouchableOpacity>

              {/* ─ Active diagnostics results ─ */}
              {diagResults && diagResults.length > 0 && (
                <>
                  <Text style={[styles.diagSectionTitle, { marginTop: 18 }]}>{translations.profile.portTestResults}</Text>
                  {diagResults.map((t) => {
                    const icon: any = t.status === 'ok' ? 'checkmark-circle' : t.status === 'fail' ? 'close-circle' : t.status === 'warn' ? 'warning' : t.status === 'running' ? 'ellipsis-horizontal-circle' : 'radio-button-off';
                    const color = t.status === 'ok' ? '#44ff88' : t.status === 'fail' ? '#ff4444' : t.status === 'warn' ? '#ffaa00' : t.status === 'running' ? '#00e5ff' : '#444466';
                    return (
                      <View key={t.id} style={[styles.diagTestRow, { borderColor: color + '30' }]}>
                        <View style={{ width: 22, alignItems: 'center' }}>
                          {t.status === 'running'
                            ? <ActivityIndicator size="small" color="#00e5ff" />
                            : <Ionicons name={icon} size={18} color={color} />
                          }
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.diagTestName, { color }]}>{t.name}</Text>
                          <Text style={styles.diagTestDetail}>{t.detail}</Text>
                        </View>
                        {t.ms != null && t.status !== 'running' && (
                          <Text style={styles.diagTestMs}>{t.ms}ms</Text>
                        )}
                      </View>
                    );
                  })}
                </>
              )}

              {/* ─ Last call ICE gathering ─ */}
              <Text style={[styles.diagSectionTitle, { marginTop: 20 }]}>{translations.profile.lastCallIce}</Text>
              {!iceStats.lastCallAt ? (
                <Text style={styles.diagEmpty}>{translations.profile.noCallYet}</Text>
              ) : (
                <>
                  <Text style={styles.diagTimestamp}>Čas: {iceStats.lastCallAt}</Text>
                  <View style={styles.diagCandRow}>
                    <View style={styles.diagCandBox}>
                      <Text style={styles.diagCandNum}>{iceStats.candidateCounts.host}</Text>
                      <Text style={styles.diagCandLabel}>host</Text>
                    </View>
                    <View style={styles.diagCandBox}>
                      <Text style={styles.diagCandNum}>{iceStats.candidateCounts.srflx}</Text>
                      <Text style={styles.diagCandLabel}>srflx</Text>
                    </View>
                    <View style={[styles.diagCandBox, { borderColor: iceStats.candidateCounts.relay > 0 ? '#44ff88' : '#ff4444' }]}>
                      <Text style={[styles.diagCandNum, { color: iceStats.candidateCounts.relay > 0 ? '#44ff88' : '#ff4444' }]}>
                        {iceStats.candidateCounts.relay}
                      </Text>
                      <Text style={[styles.diagCandLabel, { color: iceStats.candidateCounts.relay > 0 ? '#44ff88' : '#ff9800' }]}>relay (TURN)</Text>
                    </View>
                  </View>

                  {iceStats.gatheringComplete && iceStats.candidateCounts.relay === 0 && (
                    <View style={styles.diagAlert}>
                      <Ionicons name="alert-circle" size={18} color="#ff4444" />
                      <Text style={styles.diagAlertText}>
                        {'ŽIADNE RELAY candidates!\nTURN server nedostupný na mobilných dátach.\nSpusti diagnostiku hore → zistí ktorý port funguje.'}
                      </Text>
                    </View>
                  )}
                  {iceStats.candidateCounts.relay > 0 && (
                    <View style={styles.diagOk}>
                      <Ionicons name="checkmark-circle" size={18} color="#44ff88" />
                      <Text style={styles.diagOkText}>TURN relay funguje! {iceStats.relayAddr ? `Adresa: ${iceStats.relayAddr}` : ''}</Text>
                    </View>
                  )}
                </>
              )}

              {/* ─ ICE connection state ─ */}
              <Text style={[styles.diagSectionTitle, { marginTop: 20 }]}>{translations.profile.iceState}</Text>
              {(() => {
                const st = iceStats.connectionState;
                const color = st === 'connected' || st === 'completed' ? '#44ff88'
                  : st === 'failed' ? '#ff4444'
                  : st === 'checking' ? '#ffaa00'
                  : st === 'disconnected' || st === 'closed' ? '#ff9800'
                  : '#666688';
                return (
                  <View style={styles.diagRow}>
                    <View style={[styles.diagDot, { backgroundColor: color, width: 12, height: 12, borderRadius: 6 }]} />
                    <Text style={[styles.diagUrlText, { color, fontSize: 13, fontWeight: '700' }]}>{st}</Text>
                    {iceStats.usedRelay && <Text style={styles.diagRelayBadge}>cez TURN RELAY</Text>}
                  </View>
                );
              })()}
              {iceStats.turnError && (
                <View style={[styles.diagAlert, { marginTop: 8, backgroundColor: '#3a0000', borderColor: '#ff2222' }]}>
                  <Ionicons name="alert-circle" size={20} color="#ff2222" />
                  <View style={{ flex: 1, marginLeft: 8 }}>
                    <Text style={[styles.diagAlertText, { fontWeight: 'bold', color: '#ff4444', fontSize: 13 }]}>
                      TURN ERROR (z posledného hovoru):
                    </Text>
                    <Text style={[styles.diagAlertText, { color: '#ffaaaa', marginTop: 2 }]}>{iceStats.turnError}</Text>
                    {iceStats.turnError.includes('702') && (
                      <Text style={{ color: '#ff9800', fontSize: 11, marginTop: 4 }}>
                        → Pravdepodobná príčina: TURN username alebo password v nastaveniach nie je správny.
                        {'\n'}Skontroluj: INDEXUS → Nastavenia → SIP → TURN credentials
                      </Text>
                    )}
                    {iceStats.turnError.includes('701') && (
                      <Text style={{ color: '#ff9800', fontSize: 11, marginTop: 4 }}>
                        → Server nedostupný: coturn na 77.72.181.116 nie beží alebo je port blokovaný.
                      </Text>
                    )}
                    {iceStats.turnError.includes('703') && (
                      <Text style={{ color: '#ff9800', fontSize: 11, marginTop: 4 }}>
                        → Timeout: coturn neodpovedá dostatočne rýchlo (zaťaženie alebo firewall).
                      </Text>
                    )}
                  </View>
                </View>
              )}
              {iceStats.error && (
                <View style={[styles.diagAlert, { marginTop: 8 }]}>
                  <Ionicons name="warning" size={18} color="#ff4444" />
                  <Text style={styles.diagAlertText}>{iceStats.error}</Text>
                </View>
              )}

              {/* ─ Config sanity check: warn about turns:...:3478 misconfiguration ─ */}
              {iceStats.configuredUrls.some(u => /^turns:[^?]+:3478(\?|$)/.test(u)) && (
                <View style={[styles.diagAlert, { marginTop: 8, backgroundColor: '#2a1500', borderColor: '#ff8c00' }]}>
                  <Ionicons name="construct" size={20} color="#ff8c00" />
                  <View style={{ flex: 1, marginLeft: 8 }}>
                    <Text style={[styles.diagAlertText, { fontWeight: 'bold', color: '#ff8c00', fontSize: 13 }]}>
                      CHYBNÁ KONFIGURÁCIA TURN URL
                    </Text>
                    <Text style={[styles.diagAlertText, { color: '#ffd580', marginTop: 2, fontSize: 11 }]}>
                      {'"turns:...:3478"'} — port 3478 nepodporuje TLS!{'\n'}
                      Oprav v INDEXUS → Nastavenia → SIP → TURN Server{'\n'}
                      Správne: {"turn:turn.cordbloodcenter.com:3478"}
                    </Text>
                  </View>
                </View>
              )}

              {/* ─ Configured ICE servers (reference) ─ */}
              {iceStats.configuredUrls.length > 0 && (
                <>
                  <Text style={[styles.diagSectionTitle, { marginTop: 20 }]}>{translations.profile.configuredIce}</Text>
                  {iceStats.configuredUrls.map((url, i) => {
                    const isTLS443 = url.includes(':443');
                    const isTLS5350 = url.includes(':5350');
                    const isUDP3478 = url.includes(':3478') && !url.includes('tcp');
                    const isBadTls3478 = /^turns:[^?]+:3478(\?|$)/.test(url);
                    const dotColor = isBadTls3478 ? '#ff4444' : isTLS443 ? '#00e5ff' : isTLS5350 ? '#4caf50' : isUDP3478 ? '#ff9800' : '#aaaacc';
                    const badge = isBadTls3478 ? '⚠ CHYBNÝ URL — turns: na 3478 nefunguje!' : isTLS443 ? '443/TLS — nikdy blokovaný' : isTLS5350 ? '5350/TLS' : isUDP3478 ? '3478/UDP ⚠' : url.startsWith('turn') ? 'TURN/TCP' : 'STUN';
                    return (
                      <View key={i} style={styles.diagRow}>
                        <View style={[styles.diagDot, { backgroundColor: dotColor }]} />
                        <View style={{ flex: 1 }}>
                          <Text style={styles.diagUrlText} selectable>{url}</Text>
                          <Text style={[styles.diagBadge, { color: dotColor }]}>{badge}</Text>
                        </View>
                      </View>
                    );
                  })}
                </>
              )}

            </ScrollView>
          )}

          {/* ── Phone Log Tab ── */}
          {logTab === 'log' && (
            <View style={{ flex: 1 }}>
              {/* Toolbar */}
              <View style={styles.logToolbar}>
                <Text style={styles.logToolbarCount}>{debugMessages.length} {translations.profile.sipLogLines}</Text>
                <TouchableOpacity
                  style={styles.logToolbarBtn}
                  onPress={() => phoneLogScrollRef.current?.scrollToEnd({ animated: true })}
                  testID="button-scroll-bottom"
                >
                  <Ionicons name="arrow-down" size={14} color="#aaaacc" />
                  <Text style={styles.logToolbarBtnText}>{translations.profile.scrollBottom}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.logToolbarBtn, { borderColor: '#ff444450' }]}
                  onPress={() => {
                    Alert.alert(translations.profile.clearLogTitle, translations.profile.clearLogMsg, [
                      { text: translations.profile.cancelBtn, style: 'cancel' },
                      { text: translations.profile.clearLog, style: 'destructive', onPress: clearDebugMessages },
                    ]);
                  }}
                  testID="button-clear-log"
                >
                  <Ionicons name="trash-outline" size={14} color="#ff6666" />
                  <Text style={[styles.logToolbarBtnText, { color: '#ff6666' }]}>{translations.profile.clearLog}</Text>
                </TouchableOpacity>
              </View>

              <ScrollView
                ref={phoneLogScrollRef}
                style={styles.phoneLogFullContainer}
                contentContainerStyle={styles.phoneLogFullContent}
                showsVerticalScrollIndicator={true}
              >
                {debugMessages.length === 0 ? (
                  <Text style={styles.phoneLogEmpty}>
                    {translations.profile.noSipLog + '\n\nSIP: ' + registrationState}
                  </Text>
                ) : (
                  debugMessages.map((line, i) => {
                    const isRelay = line.includes('RELAY') || line.includes('relay');
                    const isError = line.includes('FAILED') || line.includes('Error') || line.includes('error') || line.includes('failed');
                    const isOk = line.includes('✓') || line.includes('connected') || line.includes('CONNECTED');
                    const lineColor = isRelay ? '#00e5ff' : isError ? '#ff6666' : isOk ? '#66ff99' : '#ffaa00';
                    return (
                      <Text key={`log-${i}`} style={[styles.phoneLogLine, { color: lineColor }]} selectable>
                        {line}
                      </Text>
                    );
                  })
                )}
              </ScrollView>
            </View>
          )}

        </SafeAreaView>
      </Modal>

      <Modal
        visible={showLanguagePicker}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowLanguagePicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{translations.profile.selectLanguage}</Text>
              <TouchableOpacity 
                onPress={() => setShowLanguagePicker(false)}
                style={styles.modalCloseButton}
                testID="button-close-language-picker"
              >
                <Ionicons name="close" size={24} color={Colors.text} />
              </TouchableOpacity>
            </View>
            
            <ScrollView style={styles.languageListContainer} contentContainerStyle={styles.languageListContent}>
              {SUPPORTED_LANGUAGES.map((lang) => (
                <TouchableOpacity
                  key={lang}
                  style={[
                    styles.languageItem,
                    language === lang && styles.languageItemSelected
                  ]}
                  onPress={() => handleLanguageSelect(lang)}
                  testID={`button-select-language-${lang}`}
                >
                  <View style={[
                    styles.languageIconContainer,
                    language === lang && styles.languageIconContainerSelected
                  ]}>
                    <Text style={[
                      styles.languageCode,
                      language === lang && styles.languageCodeSelected
                    ]}>
                      {translations.languageCodes[lang]}
                    </Text>
                  </View>
                  <View style={styles.languageItemText}>
                    <Text style={[
                      styles.languageName,
                      language === lang && styles.languageNameSelected
                    ]}>
                      {translations.languages[lang]}
                    </Text>
                  </View>
                  {language === lang && (
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
    paddingBottom: Spacing.xl,
  },
  header: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  headerTitle: {
    fontSize: FontSizes.xl,
    fontWeight: 'bold',
    color: Colors.white,
    textAlign: 'center',
  },
  profileSection: {
    alignItems: 'center',
    paddingTop: Spacing.md,
  },
  avatarContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    marginBottom: Spacing.md,
  },
  avatarImage: {
    width: 76,
    height: 76,
    borderRadius: 38,
  },
  avatarText: {
    color: Colors.white,
    fontSize: FontSizes.xxl,
    fontWeight: 'bold',
  },
  userName: {
    fontSize: FontSizes.xl,
    fontWeight: '600',
    color: Colors.white,
    marginBottom: Spacing.xs,
  },
  countryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: 16,
    gap: Spacing.xs,
  },
  countryText: {
    color: Colors.white,
    fontSize: FontSizes.sm,
    fontWeight: '600',
  },
  content: {
    flex: 1,
    marginTop: -Spacing.md,
  },
  contentContainer: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
  },
  syncStatusCard: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  syncStatusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.md,
    gap: Spacing.sm,
  },
  syncStatusTitle: {
    flex: 1,
    fontSize: FontSizes.md,
    fontWeight: '600',
    color: Colors.text,
  },
  onlineIndicator: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  syncStatusBody: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  syncItem: {
    alignItems: 'center',
    flex: 1,
  },
  syncLabel: {
    fontSize: FontSizes.xs,
    color: Colors.textSecondary,
    marginBottom: Spacing.xs,
  },
  syncValue: {
    fontSize: FontSizes.md,
    fontWeight: '600',
    color: Colors.text,
  },
  syncDivider: {
    width: 1,
    height: '100%',
    backgroundColor: Colors.border,
  },
  pendingBadge: {
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: 12,
  },
  pendingText: {
    color: Colors.white,
    fontSize: FontSizes.sm,
    fontWeight: '600',
  },
  sectionTitle: {
    fontSize: FontSizes.md,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: Spacing.sm,
    marginTop: Spacing.sm,
  },
  settingsCard: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
    marginBottom: Spacing.md,
  },
  settingsItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
  },
  settingsIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(107, 28, 59, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  settingsContent: {
    flex: 1,
  },
  settingsLabel: {
    fontSize: FontSizes.md,
    fontWeight: '600',
    color: Colors.text,
  },
  settingsDescription: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  settingsValueContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  settingsValue: {
    fontSize: FontSizes.md,
    fontWeight: '600',
    color: Colors.primary,
  },
  versionNumber: {
    fontSize: FontSizes.md,
    fontWeight: '600',
    color: Colors.primary,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border,
    marginLeft: 68,
  },
  activeBadge: {
    backgroundColor: 'rgba(76, 175, 80, 0.15)',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: 12,
  },
  activeText: {
    color: Colors.success,
    fontSize: FontSizes.sm,
    fontWeight: '600',
  },
  logoutButton: {
    marginTop: Spacing.lg,
    borderRadius: 12,
    overflow: 'hidden',
  },
  logoutGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md,
    gap: Spacing.sm,
  },
  logoutText: {
    fontSize: FontSizes.md,
    color: Colors.white,
    fontWeight: '600',
  },
  footerSpace: {
    height: Spacing.xxl,
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
    minHeight: 450,
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
  modalHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  modalActionButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 20,
    backgroundColor: 'rgba(107, 28, 59, 0.08)',
  },
  modalCloseButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  languageListContainer: {
    flex: 1,
    minHeight: 300,
  },
  languageListContent: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    paddingBottom: Spacing.xxl,
  },
  languageItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    backgroundColor: Colors.surface,
    borderRadius: 12,
  },
  languageItemSelected: {
    backgroundColor: 'rgba(107, 28, 59, 0.1)',
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  languageIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(107, 28, 59, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  languageIconContainerSelected: {
    backgroundColor: Colors.primary,
  },
  languageCode: {
    fontSize: FontSizes.md,
    fontWeight: '700',
    color: Colors.primary,
  },
  languageCodeSelected: {
    color: Colors.white,
  },
  languageItemText: {
    flex: 1,
  },
  languageName: {
    fontSize: FontSizes.md,
    fontWeight: '500',
    color: Colors.text,
  },
  languageNameSelected: {
    fontWeight: '600',
    color: Colors.primary,
  },
  phoneLogStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  phoneLogStatusText: {
    fontSize: FontSizes.sm,
    fontWeight: '600',
    color: Colors.text,
  },
  phoneLogContainer: {
    flex: 1,
    minHeight: 300,
  },
  phoneLogContent: {
    padding: Spacing.md,
  },
  phoneLogScreen: {
    flex: 1,
    backgroundColor: '#0d0d1a',
  },
  phoneLogScreenHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    backgroundColor: '#16213e',
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a4a',
  },
  phoneLogScreenTitle: {
    fontSize: FontSizes.md,
    fontWeight: '700',
    color: '#ffffff',
    flex: 1,
    textAlign: 'center',
  },
  phoneLogScreenStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  phoneLogScreenStatusText: {
    fontSize: FontSizes.xs,
    color: '#aaaacc',
    fontWeight: '600',
  },
  phoneLogScreenCount: {
    fontSize: FontSizes.xs,
    color: '#666688',
  },
  phoneLogActionBtn: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  phoneLogFullContainer: {
    flex: 1,
    backgroundColor: '#0d0d1a',
  },
  phoneLogFullContent: {
    padding: 10,
    paddingBottom: 40,
  },
  phoneLogLine: {
    fontSize: 12,
    fontFamily: 'monospace',
    color: '#ffaa00',
    backgroundColor: '#0d0d1a',
    paddingVertical: 3,
    paddingHorizontal: 4,
    marginBottom: 1,
    lineHeight: 18,
  },
  phoneLogEmpty: {
    fontSize: FontSizes.sm,
    color: '#666688',
    textAlign: 'center',
    marginTop: Spacing.xl,
    lineHeight: 22,
  },
  /* ── Tabs ── */
  logTabs: {
    flexDirection: 'row',
    backgroundColor: '#0d0d1a',
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a4a',
  },
  logTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  logTabActive: {
    borderBottomColor: '#00e5ff',
    backgroundColor: 'rgba(0,229,255,0.06)',
  },
  logTabText: {
    fontSize: FontSizes.sm,
    fontWeight: '600',
    color: '#666688',
  },
  logTabTextActive: {
    color: '#00e5ff',
  },

  /* ── Log toolbar ── */
  logToolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#16213e',
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a4a',
  },
  logToolbarCount: {
    flex: 1,
    fontSize: FontSizes.xs,
    color: '#666688',
  },
  logToolbarBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#2a2a4a',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  logToolbarBtnText: {
    fontSize: FontSizes.xs,
    color: '#aaaacc',
    fontWeight: '600',
  },

  /* ── Diag action buttons ── */
  diagActionRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  diagActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 11,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#00e5ff50',
    backgroundColor: 'rgba(0,229,255,0.06)',
  },
  diagActionBtnText: {
    fontSize: FontSizes.sm,
    fontWeight: '700',
    color: '#00e5ff',
  },
  diagExportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 9,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#ffaa0040',
    backgroundColor: 'rgba(255,170,0,0.05)',
    marginBottom: 4,
  },
  diagExportBtnText: {
    fontSize: FontSizes.sm,
    fontWeight: '600',
    color: '#ffaa00',
  },
  diagTestRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingVertical: 9,
    paddingHorizontal: 10,
    marginBottom: 5,
    borderRadius: 8,
    borderWidth: 1,
    backgroundColor: 'rgba(255,255,255,0.02)',
  },
  diagTestName: {
    fontSize: FontSizes.sm,
    fontWeight: '700',
    lineHeight: 18,
  },
  diagTestDetail: {
    fontSize: 11,
    color: '#888899',
    lineHeight: 16,
    marginTop: 2,
  },
  diagTestMs: {
    fontSize: 10,
    color: '#555577',
    fontWeight: '600',
    marginTop: 2,
    minWidth: 45,
    textAlign: 'right',
  },

  /* ── TURN diagnostic panel ── */
  diagSectionTitle: {
    fontSize: 10,
    fontWeight: '800',
    color: '#444466',
    letterSpacing: 1.2,
    marginBottom: 8,
  },
  diagEmpty: {
    fontSize: FontSizes.sm,
    color: '#666688',
    fontStyle: 'italic',
    marginBottom: 8,
  },
  diagTimestamp: {
    fontSize: FontSizes.xs,
    color: '#666688',
    marginBottom: 10,
  },
  diagRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 8,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: '#2a2a4a',
  },
  diagDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 4,
    flexShrink: 0,
  },
  diagUrlText: {
    fontSize: 11,
    fontFamily: 'monospace',
    color: '#aaaacc',
    lineHeight: 16,
  },
  diagBadge: {
    fontSize: 10,
    fontWeight: '700',
    marginTop: 2,
    letterSpacing: 0.3,
  },
  diagCandRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  diagCandBox: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#2a2a4a',
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  diagCandNum: {
    fontSize: FontSizes.xl,
    fontWeight: '800',
    color: '#aaaacc',
    lineHeight: 26,
  },
  diagCandLabel: {
    fontSize: 10,
    color: '#666688',
    fontWeight: '600',
    marginTop: 2,
  },
  diagAlert: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
    backgroundColor: 'rgba(255,68,68,0.08)',
    borderWidth: 1,
    borderColor: '#ff444440',
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
  },
  diagAlertText: {
    flex: 1,
    fontSize: FontSizes.sm,
    color: '#ff8888',
    lineHeight: 20,
  },
  diagOk: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
    backgroundColor: 'rgba(0,229,255,0.07)',
    borderWidth: 1,
    borderColor: '#00e5ff40',
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
  },
  diagOkText: {
    flex: 1,
    fontSize: FontSizes.sm,
    color: '#00e5ff',
    fontWeight: '600',
  },
  diagRelayBadge: {
    fontSize: 10,
    fontWeight: '800',
    color: '#00e5ff',
    backgroundColor: 'rgba(0,229,255,0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginLeft: 8,
    overflow: 'hidden',
  },
  forwardingInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  forwardingInput: {
    flex: 1,
    fontSize: FontSizes.md,
    color: Colors.text,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  forwardingSaveBtn: {
    backgroundColor: Colors.primary,
    marginHorizontal: Spacing.lg,
    marginVertical: Spacing.md,
    paddingVertical: Spacing.md,
    borderRadius: 10,
    alignItems: 'center',
  },
  forwardingSaveBtnText: {
    color: Colors.white,
    fontSize: FontSizes.md,
    fontWeight: '600',
  },
});
