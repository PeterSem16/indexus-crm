import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Linking, Platform, ActivityIndicator, TextInput, Alert, Switch
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useState } from 'react';
import { useClinics, useUpdateClinic, Clinic } from '@/hooks/useClinics';
import { useSipStore } from '@/stores/sipStore';
import { Colors, Spacing, FontSizes } from '@/constants/colors';

function InfoRow({ icon, label, value }: { icon: keyof typeof Ionicons.glyphMap; label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <View style={styles.infoRow}>
      <View style={styles.infoLabel}>
        <Ionicons name={icon} size={16} color={Colors.textSecondary} />
        <Text style={styles.infoLabelText}>{label}</Text>
      </View>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

function InfoDivider() {
  return <View style={styles.infoDivider} />;
}

function EditField({
  label, value, onChangeText, multiline, keyboardType,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  multiline?: boolean;
  keyboardType?: 'default' | 'email-address' | 'phone-pad';
}) {
  return (
    <View style={styles.editField}>
      <Text style={styles.editLabel}>{label}</Text>
      <TextInput
        style={[styles.editInput, multiline && styles.editInputMulti]}
        value={value}
        onChangeText={onChangeText}
        multiline={multiline}
        keyboardType={keyboardType || 'default'}
        placeholderTextColor={Colors.textSecondary}
      />
    </View>
  );
}

function BoolRow({ label, value, onToggle }: { label: string; value: boolean; onToggle: (v: boolean) => void }) {
  return (
    <View style={styles.boolRow}>
      <Text style={styles.boolLabel}>{label}</Text>
      <Switch
        value={value}
        onValueChange={onToggle}
        trackColor={{ false: '#D1D5DB', true: `${Colors.primary}80` }}
        thumbColor={value ? Colors.primary : '#9CA3AF'}
      />
    </View>
  );
}

export default function ClinicDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { data: clinics = [], isLoading } = useClinics();
  const updateClinic = useUpdateClinic();
  const { registrationState, makeCall } = useSipStore();

  const clinic = clinics.find(c => String(c.id) === id);

  const [editMode, setEditMode] = useState(false);
  const [form, setForm] = useState<Partial<Clinic>>({});
  const [saving, setSaving] = useState(false);

  const startEdit = () => {
    if (!clinic) return;
    setForm({
      name: clinic.name || '',
      doctorName: clinic.doctorName || '',
      doctorTitle: clinic.doctorTitle || '',
      doctorFirstName: clinic.doctorFirstName || '',
      doctorLastName: clinic.doctorLastName || '',
      phone: clinic.phone || '',
      phone2: clinic.phone2 || '',
      phone3: clinic.phone3 || '',
      email: clinic.email || '',
      email2: clinic.email2 || '',
      website: clinic.website || '',
      streetNumber: clinic.streetNumber || '',
      city: clinic.city || '',
      postalCode: clinic.postalCode || '',
      region: clinic.region || '',
      district: clinic.district || '',
      countryCode: clinic.countryCode || '',
      notes: clinic.notes || '',
      contractStatus: clinic.contractStatus || '',
      isActive: clinic.isActive !== false,
      hasFlyers: !!clinic.hasFlyers,
    });
    setEditMode(true);
  };

  const cancelEdit = () => {
    setEditMode(false);
    setForm({});
  };

  const saveEdit = async () => {
    if (!clinic) return;
    setSaving(true);
    try {
      await updateClinic.mutateAsync({ id: clinic.id, ...form });
      setEditMode(false);
      setForm({});
      Alert.alert('Uložené', 'Zmeny boli úspešne uložené.');
    } catch (e: any) {
      Alert.alert('Chyba', e?.message || 'Nepodarilo sa uložiť');
    } finally {
      setSaving(false);
    }
  };

  const openMap = () => {
    if (!clinic) return;
    if (clinic.latitude && clinic.longitude) {
      const label = encodeURIComponent(clinic.name);
      const url = Platform.select({
        ios: `maps:0,0?q=${label}@${clinic.latitude},${clinic.longitude}`,
        android: `geo:${clinic.latitude},${clinic.longitude}?q=${clinic.latitude},${clinic.longitude}(${label})`,
      });
      if (url) Linking.openURL(url);
    } else if (clinic.streetNumber && clinic.city) {
      const address = encodeURIComponent(`${clinic.streetNumber}, ${clinic.city}`);
      const url = Platform.select({
        ios: `maps:0,0?q=${address}`,
        android: `geo:0,0?q=${address}`,
      });
      if (url) Linking.openURL(url);
    } else if (clinic.city) {
      const url = Platform.select({
        ios: `maps:0,0?q=${encodeURIComponent(clinic.city)}`,
        android: `geo:0,0?q=${encodeURIComponent(clinic.city)}`,
      });
      if (url) Linking.openURL(url);
    }
  };

  const callClinic = (phone?: string) => {
    const p = phone || clinic?.phone;
    if (!p) return;
    if (registrationState === 'registered') makeCall(p);
    else Linking.openURL(`tel:${p}`);
  };

  const openEmail = (email?: string) => {
    const e = email || clinic?.email;
    if (e) Linking.openURL(`mailto:${e}`);
  };

  const openWebsite = () => {
    if (!clinic?.website) return;
    const url = clinic.website.startsWith('http') ? clinic.website : `https://${clinic.website}`;
    Linking.openURL(url);
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  if (!clinic) {
    return (
      <View style={styles.container}>
        <SafeAreaView style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={64} color={Colors.error} />
          <Text style={styles.errorText}>Ambulancia nenájdená</Text>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Text style={styles.backButtonText}>Späť</Text>
          </TouchableOpacity>
        </SafeAreaView>
      </View>
    );
  }

  const isActive = clinic.isActive !== false;
  const c = editMode ? { ...clinic, ...form } : clinic;

  const doctorFullName = [c.doctorTitle, c.doctorFirstName, c.doctorLastName]
    .filter(Boolean).join(' ') || c.doctorName || '';

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#10b981', '#059669']}
        style={styles.headerGradient}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
      >
        <SafeAreaView edges={['top']}>
          <View style={styles.header}>
            <TouchableOpacity onPress={editMode ? cancelEdit : () => router.back()} style={styles.headerBtn} testID="button-back">
              <Ionicons name={editMode ? 'close' : 'arrow-back'} size={24} color={Colors.white} />
            </TouchableOpacity>
            <Text style={styles.headerTitle} numberOfLines={1}>
              {editMode ? 'Upraviť ambulanciu' : 'Detail ambulancie'}
            </Text>
            {editMode ? (
              <TouchableOpacity onPress={saveEdit} style={styles.headerBtn} testID="button-save-clinic" disabled={saving}>
                {saving
                  ? <ActivityIndicator size="small" color={Colors.white} />
                  : <Ionicons name="checkmark" size={26} color={Colors.white} />
                }
              </TouchableOpacity>
            ) : (
              <TouchableOpacity onPress={startEdit} style={styles.headerBtn} testID="button-edit-clinic">
                <Ionicons name="create-outline" size={22} color={Colors.white} />
              </TouchableOpacity>
            )}
          </View>
        </SafeAreaView>
      </LinearGradient>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer} showsVerticalScrollIndicator={false}>

        {/* Header card */}
        <View style={styles.clinicHeader}>
          <View style={[styles.clinicIcon, { backgroundColor: isActive ? 'rgba(16,185,129,0.12)' : '#F0F0F0' }]}>
            <Ionicons name="medkit" size={32} color={isActive ? '#10b981' : Colors.textSecondary} />
          </View>
          <View style={styles.clinicTitleSection}>
            <Text style={styles.clinicName}>{c.name}</Text>
            {doctorFullName ? (
              <Text style={styles.clinicDoctor}>{doctorFullName}</Text>
            ) : null}
            <View style={styles.badgeRow}>
              <View style={[styles.badge, { backgroundColor: isActive ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)' }]}>
                <Ionicons name={isActive ? 'checkmark-circle' : 'close-circle'} size={13} color={isActive ? '#10b981' : Colors.error} />
                <Text style={[styles.badgeText, { color: isActive ? '#10b981' : Colors.error }]}>
                  {isActive ? 'Aktívna' : 'Neaktívna'}
                </Text>
              </View>
              {c.hasFlyers && (
                <View style={[styles.badge, { backgroundColor: 'rgba(245,158,11,0.12)' }]}>
                  <Ionicons name="document-text" size={13} color="#F59E0B" />
                  <Text style={[styles.badgeText, { color: '#F59E0B' }]}>Letáky</Text>
                </View>
              )}
              {c.contractStatus && (
                <View style={[styles.badge, { backgroundColor: 'rgba(99,102,241,0.12)' }]}>
                  <Ionicons name="document" size={13} color="#6366F1" />
                  <Text style={[styles.badgeText, { color: '#6366F1' }]}>{c.contractStatus}</Text>
                </View>
              )}
            </View>
          </View>
        </View>

        {/* Quick actions */}
        {!editMode && (
          <View style={styles.actionRow}>
            {clinic.phone && (
              <TouchableOpacity style={styles.actionBtn} onPress={() => callClinic()} testID="button-call">
                <LinearGradient colors={['#10b981', '#059669']} style={styles.actionBtnGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
                  <Ionicons name="call" size={18} color={Colors.white} />
                  <Text style={styles.actionBtnText}>Zavolať</Text>
                </LinearGradient>
              </TouchableOpacity>
            )}
            {clinic.email && (
              <TouchableOpacity style={styles.actionBtn} onPress={() => openEmail()} testID="button-email">
                <View style={styles.actionBtnOutline}>
                  <Ionicons name="mail" size={18} color="#10b981" />
                  <Text style={[styles.actionBtnTextOutline, { color: '#10b981' }]}>Email</Text>
                </View>
              </TouchableOpacity>
            )}
            {(clinic.city || clinic.streetNumber) && (
              <TouchableOpacity style={styles.actionBtnSmall} onPress={openMap} testID="button-navigate">
                <View style={[styles.actionBtnOutline, { borderColor: '#10b981' }]}>
                  <Ionicons name="navigate" size={18} color="#10b981" />
                </View>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Edit mode */}
        {editMode ? (
          <>
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Ambulancia</Text>
              <EditField label="Názov" value={form.name || ''} onChangeText={v => setForm(f => ({ ...f, name: v }))} />
            </View>

            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Lekár</Text>
              <EditField label="Titul" value={form.doctorTitle || ''} onChangeText={v => setForm(f => ({ ...f, doctorTitle: v }))} />
              <EditField label="Meno" value={form.doctorFirstName || ''} onChangeText={v => setForm(f => ({ ...f, doctorFirstName: v }))} />
              <EditField label="Priezvisko" value={form.doctorLastName || ''} onChangeText={v => setForm(f => ({ ...f, doctorLastName: v }))} />
            </View>

            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Kontakt</Text>
              <EditField label="Telefón 1" value={form.phone || ''} onChangeText={v => setForm(f => ({ ...f, phone: v }))} keyboardType="phone-pad" />
              <EditField label="Telefón 2" value={form.phone2 || ''} onChangeText={v => setForm(f => ({ ...f, phone2: v }))} keyboardType="phone-pad" />
              <EditField label="Telefón 3" value={form.phone3 || ''} onChangeText={v => setForm(f => ({ ...f, phone3: v }))} keyboardType="phone-pad" />
              <EditField label="Email 1" value={form.email || ''} onChangeText={v => setForm(f => ({ ...f, email: v }))} keyboardType="email-address" />
              <EditField label="Email 2" value={form.email2 || ''} onChangeText={v => setForm(f => ({ ...f, email2: v }))} keyboardType="email-address" />
              <EditField label="Web" value={form.website || ''} onChangeText={v => setForm(f => ({ ...f, website: v }))} />
            </View>

            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Adresa</Text>
              <EditField label="Ulica a číslo" value={form.streetNumber || ''} onChangeText={v => setForm(f => ({ ...f, streetNumber: v }))} />
              <EditField label="PSČ" value={form.postalCode || ''} onChangeText={v => setForm(f => ({ ...f, postalCode: v }))} />
              <EditField label="Mesto" value={form.city || ''} onChangeText={v => setForm(f => ({ ...f, city: v }))} />
              <EditField label="Kraj" value={form.region || ''} onChangeText={v => setForm(f => ({ ...f, region: v }))} />
              <EditField label="Okres" value={form.district || ''} onChangeText={v => setForm(f => ({ ...f, district: v }))} />
              <EditField label="Krajina" value={form.countryCode || ''} onChangeText={v => setForm(f => ({ ...f, countryCode: v }))} />
            </View>

            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Stav</Text>
              <BoolRow label="Aktívna" value={form.isActive !== false} onToggle={v => setForm(f => ({ ...f, isActive: v }))} />
              <View style={styles.infoDivider} />
              <BoolRow label="Má letáky" value={!!form.hasFlyers} onToggle={v => setForm(f => ({ ...f, hasFlyers: v }))} />
              <EditField label="Stav zmluvy" value={form.contractStatus || ''} onChangeText={v => setForm(f => ({ ...f, contractStatus: v }))} />
            </View>

            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Poznámky</Text>
              <EditField label="Poznámka" value={form.notes || ''} onChangeText={v => setForm(f => ({ ...f, notes: v }))} multiline />
            </View>

            <TouchableOpacity style={styles.saveBtn} onPress={saveEdit} disabled={saving} testID="button-save-bottom">
              {saving ? <ActivityIndicator size="small" color={Colors.white} /> : (
                <>
                  <Ionicons name="save-outline" size={20} color={Colors.white} />
                  <Text style={styles.saveBtnText}>Uložiť zmeny</Text>
                </>
              )}
            </TouchableOpacity>
          </>
        ) : (
          <>
            {/* Doctor info */}
            {(c.doctorName || c.doctorFirstName || c.doctorTitle) && (
              <>
                <Text style={styles.sectionTitle}>Lekár</Text>
                <View style={styles.card}>
                  {doctorFullName ? <InfoRow icon="person-outline" label="Meno" value={doctorFullName} /> : null}
                  {c.pzsCode && <><InfoDivider /><InfoRow icon="barcode-outline" label="Kód PZS" value={c.pzsCode} /></>}
                  {c.ico && <><InfoDivider /><InfoRow icon="business-outline" label="IČO" value={c.ico} /></>}
                </View>
              </>
            )}

            {/* Contact */}
            <Text style={styles.sectionTitle}>Kontakt</Text>
            <View style={styles.card}>
              <InfoRow icon="call-outline" label="Telefón 1" value={c.phone || 'Nezadaný'} />
              {c.phone2 && <><InfoDivider /><InfoRow icon="call-outline" label="Telefón 2" value={c.phone2} /></>}
              {c.phone3 && <><InfoDivider /><InfoRow icon="call-outline" label="Telefón 3" value={c.phone3} /></>}
              {(c.phone || c.phone2) && <InfoDivider />}
              <InfoRow icon="mail-outline" label="Email 1" value={c.email || 'Nezadaný'} />
              {c.email2 && <><InfoDivider /><InfoRow icon="mail-outline" label="Email 2" value={c.email2} /></>}
              {c.website && <><InfoDivider /><InfoRow icon="globe-outline" label="Web" value={c.website} /></>}
              {c.phone && (
                <TouchableOpacity style={styles.actionInCard} onPress={() => callClinic()} testID="button-call-card">
                  <Ionicons name="call" size={15} color="#10b981" />
                  <Text style={[styles.actionInCardText, { color: '#10b981' }]}>Zavolať</Text>
                </TouchableOpacity>
              )}
              {c.phone2 && (
                <TouchableOpacity style={styles.actionInCard} onPress={() => callClinic(c.phone2)} testID="button-call-card-2">
                  <Ionicons name="call" size={15} color="#10b981" />
                  <Text style={[styles.actionInCardText, { color: '#10b981' }]}>Zavolať (tel. 2)</Text>
                </TouchableOpacity>
              )}
              {c.email && (
                <TouchableOpacity style={styles.actionInCard} onPress={() => openEmail(c.email)} testID="button-email-card">
                  <Ionicons name="mail" size={15} color="#10b981" />
                  <Text style={[styles.actionInCardText, { color: '#10b981' }]}>Napísať email</Text>
                </TouchableOpacity>
              )}
              {c.website && (
                <TouchableOpacity style={styles.actionInCard} onPress={openWebsite} testID="button-web-card">
                  <Ionicons name="globe" size={15} color="#10b981" />
                  <Text style={[styles.actionInCardText, { color: '#10b981' }]}>Otvoriť web</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Location */}
            <Text style={styles.sectionTitle}>Adresa</Text>
            <View style={styles.card}>
              <InfoRow icon="location-outline" label="Ulica" value={c.streetNumber} />
              {c.streetNumber && c.postalCode && <InfoDivider />}
              <InfoRow icon="mail-outline" label="PSČ" value={c.postalCode} />
              {(c.streetNumber || c.postalCode) && c.city && <InfoDivider />}
              <InfoRow icon="business-outline" label="Mesto" value={c.city} />
              {c.city && c.region && <InfoDivider />}
              <InfoRow icon="map-outline" label="Kraj" value={c.region} />
              {c.region && c.district && <InfoDivider />}
              <InfoRow icon="map-outline" label="Okres" value={c.district} />
              {c.latitude && c.longitude && (
                <><InfoDivider />
                  <InfoRow icon="navigate-outline" label="GPS" value={`${c.latitude}, ${c.longitude}`} />
                </>
              )}
              <TouchableOpacity style={styles.actionInCard} onPress={openMap} testID="button-navigate-card">
                <Ionicons name="navigate" size={15} color="#10b981" />
                <Text style={[styles.actionInCardText, { color: '#10b981' }]}>Navigovať</Text>
              </TouchableOpacity>
            </View>

            {/* Additional info */}
            <Text style={styles.sectionTitle}>Ďalšie údaje</Text>
            <View style={styles.card}>
              <View style={styles.infoRow}>
                <View style={styles.infoLabel}>
                  <Ionicons name="checkmark-circle-outline" size={16} color={Colors.textSecondary} />
                  <Text style={styles.infoLabelText}>Aktívna</Text>
                </View>
                <View style={[styles.badge, { backgroundColor: isActive ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)' }]}>
                  <Text style={[styles.badgeText, { color: isActive ? '#10b981' : Colors.error }]}>
                    {isActive ? 'Áno' : 'Nie'}
                  </Text>
                </View>
              </View>
              <InfoDivider />
              <View style={styles.infoRow}>
                <View style={styles.infoLabel}>
                  <Ionicons name="document-text-outline" size={16} color={Colors.textSecondary} />
                  <Text style={styles.infoLabelText}>Má letáky</Text>
                </View>
                <View style={[styles.badge, { backgroundColor: c.hasFlyers ? 'rgba(245,158,11,0.12)' : 'rgba(0,0,0,0.04)' }]}>
                  <Text style={[styles.badgeText, { color: c.hasFlyers ? '#F59E0B' : Colors.textSecondary }]}>
                    {c.hasFlyers ? 'Áno' : 'Nie'}
                  </Text>
                </View>
              </View>
              {c.contractStatus && <><InfoDivider /><InfoRow icon="document-outline" label="Stav zmluvy" value={c.contractStatus} /></>}
              {c.interestCooperation && <><InfoDivider /><InfoRow icon="handshake-outline" label="Záujem o spoluprácu" value={c.interestCooperation} /></>}
              {c.interestContract && <><InfoDivider /><InfoRow icon="document-text-outline" label="Záujem o zmluvu" value={c.interestContract} /></>}
              {c.lastCallResult && <><InfoDivider /><InfoRow icon="call-outline" label="Posl. hovor" value={c.lastCallResult} /></>}
              {c.lastCallNote && <><InfoDivider /><InfoRow icon="chatbubble-outline" label="Poznámka z hovoru" value={c.lastCallNote} /></>}
            </View>

            {c.notes && (
              <>
                <Text style={styles.sectionTitle}>Poznámky</Text>
                <View style={styles.card}>
                  <Text style={styles.notesText}>{c.notes}</Text>
                </View>
              </>
            )}

            <TouchableOpacity style={styles.editFab} onPress={startEdit} testID="button-edit-fab">
              <LinearGradient colors={['#10b981', '#059669']} style={styles.editFabGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
                <Ionicons name="create-outline" size={22} color={Colors.white} />
                <Text style={styles.editFabText}>Upraviť</Text>
              </LinearGradient>
            </TouchableOpacity>
          </>
        )}

        <View style={styles.footerSpace} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F4F6FA' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F4F6FA' },
  errorContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: Spacing.xl },
  errorText: { fontSize: FontSizes.lg, color: Colors.textSecondary, marginTop: Spacing.md, textAlign: 'center' },
  backButton: { marginTop: Spacing.lg, paddingVertical: Spacing.sm, paddingHorizontal: Spacing.xl, backgroundColor: '#10b981', borderRadius: 8 },
  backButtonText: { color: Colors.white, fontSize: FontSizes.md, fontWeight: '600' },
  headerGradient: {},
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.md, paddingVertical: Spacing.md },
  headerBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { flex: 1, fontSize: FontSizes.lg, fontWeight: '600', color: Colors.white, textAlign: 'center' },
  content: { flex: 1 },
  contentContainer: { padding: Spacing.md, paddingBottom: 40 },
  clinicHeader: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: Spacing.md, backgroundColor: Colors.white, borderRadius: 16, padding: Spacing.md, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 2 },
  clinicIcon: { width: 60, height: 60, borderRadius: 30, justifyContent: 'center', alignItems: 'center', marginRight: Spacing.md },
  clinicTitleSection: { flex: 1 },
  clinicName: { fontSize: FontSizes.xl, fontWeight: '700', color: Colors.text, marginBottom: 4 },
  clinicDoctor: { fontSize: FontSizes.sm, color: Colors.textSecondary, marginBottom: 6 },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  badgeText: { fontSize: 11, fontWeight: '600' },
  actionRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.md },
  actionBtn: { flex: 1, borderRadius: 12 },
  actionBtnSmall: { width: 50, borderRadius: 12 },
  actionBtnGrad: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: Spacing.md, gap: 6, borderRadius: 12, overflow: 'hidden' },
  actionBtnOutline: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: Spacing.md, gap: 6, borderWidth: 1, borderColor: '#10b981', borderRadius: 12, backgroundColor: Colors.white },
  actionBtnText: { fontSize: FontSizes.sm, fontWeight: '600', color: Colors.white },
  actionBtnTextOutline: { fontSize: FontSizes.sm, fontWeight: '600', color: '#10b981' },
  sectionTitle: { fontSize: FontSizes.sm, fontWeight: '700', color: Colors.textSecondary, marginBottom: Spacing.xs, marginTop: Spacing.sm, textTransform: 'uppercase', letterSpacing: 0.5 },
  card: { backgroundColor: Colors.white, borderRadius: 16, padding: Spacing.md, marginBottom: Spacing.sm, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 2 },
  infoRow: { paddingVertical: 8 },
  infoLabel: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 3 },
  infoLabelText: { fontSize: FontSizes.xs, color: Colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.3 },
  infoValue: { fontSize: FontSizes.md, color: Colors.text, fontWeight: '500', marginLeft: 24 },
  infoDivider: { height: 1, backgroundColor: '#F0F2F6' },
  actionInCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: Spacing.sm, paddingVertical: Spacing.sm, backgroundColor: 'rgba(16,185,129,0.08)', borderRadius: 8, gap: 6 },
  actionInCardText: { fontSize: FontSizes.sm, fontWeight: '600' },
  editField: { marginBottom: 12 },
  editLabel: { fontSize: FontSizes.xs, color: Colors.textSecondary, fontWeight: '600', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.3 },
  editInput: { borderWidth: 1.5, borderColor: '#E0E5EF', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: FontSizes.md, color: Colors.text, backgroundColor: '#FAFBFC' },
  editInputMulti: { height: 80, textAlignVertical: 'top' },
  boolRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10 },
  boolLabel: { fontSize: FontSizes.md, color: Colors.text, fontWeight: '500' },
  saveBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#10b981', borderRadius: 14, paddingVertical: Spacing.md, marginTop: Spacing.sm, gap: 8 },
  saveBtnText: { color: Colors.white, fontSize: FontSizes.md, fontWeight: '700' },
  editFab: { borderRadius: 14, overflow: 'hidden', marginTop: Spacing.md },
  editFabGrad: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 14, gap: 8 },
  editFabText: { color: Colors.white, fontSize: FontSizes.md, fontWeight: '700' },
  notesText: { fontSize: FontSizes.md, color: Colors.text, lineHeight: 22 },
  footerSpace: { height: 40 },
});
