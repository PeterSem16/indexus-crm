import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Linking, Platform, ActivityIndicator, TextInput, Alert, Switch
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from '@/hooks/useTranslation';
import { useHospitals, useUpdateHospital, Hospital } from '@/hooks/useHospitals';
import { useSipStore } from '@/stores/sipStore';
import { api } from '@/lib/api';
import { Colors, Spacing, FontSizes } from '@/constants/colors';

type DetailTab = 'info' | 'personnel' | 'midwives' | 'notes';

interface PersonnelPerson {
  person_id: string;
  first_name?: string;
  last_name?: string;
  title_before?: string;
  title_after?: string;
  phone?: string;
  mobile?: string;
  email?: string;
  collaborator_type?: string;
  category_name?: string;
  role?: string;
  position?: string;
  is_primary?: boolean;
  person_active?: boolean;
}

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
  label: string; value: string; onChangeText: (v: string) => void;
  multiline?: boolean; keyboardType?: 'default' | 'email-address' | 'phone-pad';
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

function PersonnelCard({ person, onCall, onEmail }: {
  person: PersonnelPerson;
  onCall: (phone: string) => void;
  onEmail: (email: string) => void;
}) {
  const fullName = [person.title_before, person.first_name, person.last_name, person.title_after]
    .filter(Boolean).join(' ') || `ID:${person.person_id}`;
  const phone = person.mobile || person.phone;

  return (
    <View style={styles.personnelCard}>
      <View style={styles.personnelRow}>
        <View style={[styles.personnelAvatar, { opacity: person.person_active === false ? 0.5 : 1 }]}>
          <Ionicons name="person" size={22} color={Colors.primary} />
        </View>
        <View style={styles.personnelInfo}>
          <Text style={styles.personnelName}>{fullName}</Text>
          {(person.category_name || person.role || person.position) && (
            <Text style={styles.personnelRole} numberOfLines={1}>
              {[person.category_name, person.role || person.position].filter(Boolean).join(' · ')}
            </Text>
          )}
          {phone && <Text style={styles.personnelPhone}>{phone}</Text>}
          {person.email && <Text style={styles.personnelEmail} numberOfLines={1}>{person.email}</Text>}
        </View>
        {person.is_primary && (
          <View style={styles.primaryBadge}>
            <Text style={styles.primaryBadgeText}>★</Text>
          </View>
        )}
      </View>
      {(phone || person.email) && (
        <View style={styles.personnelActions}>
          {phone && (
            <TouchableOpacity style={styles.personnelActionBtn} onPress={() => onCall(phone)} testID={`button-call-person-${person.person_id}`}>
              <Ionicons name="call" size={14} color={Colors.primary} />
            </TouchableOpacity>
          )}
          {person.email && (
            <TouchableOpacity style={styles.personnelActionBtn} onPress={() => onEmail(person.email!)} testID={`button-email-person-${person.person_id}`}>
              <Ionicons name="mail" size={14} color={Colors.primary} />
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
}

export default function HospitalDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { translations } = useTranslation();
  const { data: hospitals = [], isLoading } = useHospitals();
  const updateHospital = useUpdateHospital();
  const { registrationState, makeCall } = useSipStore();

  const hospital = hospitals.find(h => String(h.id) === id);

  const [activeTab, setActiveTab] = useState<DetailTab>('info');
  const [editMode, setEditMode] = useState(false);
  const [form, setForm] = useState<Partial<Hospital>>({});
  const [saving, setSaving] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [addingNote, setAddingNote] = useState(false);
  const qc = useQueryClient();

  const th = translations.hospitals;

  const { data: personnelData, isLoading: personnelLoading } = useQuery<{
    assigned: PersonnelPerson[];
    legacy: PersonnelPerson[];
    midwives: PersonnelPerson[];
    clinicDoctor: any;
  }>({
    queryKey: ['/api/mobile/institutions/hospital', id, 'personnel'],
    queryFn: () => api.get(`/api/mobile/institutions/hospital/${id}/personnel`),
    enabled: !!id && (activeTab === 'personnel' || activeTab === 'midwives'),
    retry: 1,
  });

  const { data: entityNotes = [] } = useQuery<any[]>({
    queryKey: ['/api/entity-notes/hospital', id],
    queryFn: () => api.get(`/api/entity-notes/hospital/${id}`),
    enabled: !!id && activeTab === 'notes',
    retry: 1,
  });

  const allPersonnel: PersonnelPerson[] = [
    ...(personnelData?.assigned || []),
    ...(personnelData?.legacy || []),
  ];
  const allMidwives: PersonnelPerson[] = personnelData?.midwives || [];

  const startEdit = () => {
    if (!hospital) return;
    setForm({
      name: hospital.name || '',
      fullName: hospital.fullName || '',
      contactPerson: hospital.contactPerson || '',
      phone: hospital.phone || '',
      email: hospital.email || '',
      city: hospital.city || '',
      streetNumber: hospital.streetNumber || '',
      postalCode: hospital.postalCode || '',
      region: hospital.region || '',
      countryCode: hospital.countryCode || '',
      isActive: hospital.isActive !== false,
      svetZdravia: hospital.svetZdravia || false,
      autoRecruiting: hospital.autoRecruiting || false,
    });
    setEditMode(true);
  };

  const cancelEdit = () => { setEditMode(false); setForm({}); };

  const saveEdit = async () => {
    if (!hospital) return;
    setSaving(true);
    try {
      await updateHospital.mutateAsync({ id: hospital.id, ...form });
      setEditMode(false);
      setForm({});
      Alert.alert(th.saved, th.saveSuccess);
    } catch (e: any) {
      Alert.alert(translations.common.error, e?.message || th.saveError);
    } finally {
      setSaving(false);
    }
  };

  const openMap = () => {
    if (!hospital) return;
    if (hospital.latitude && hospital.longitude) {
      const label = encodeURIComponent(hospital.name);
      const url = Platform.select({
        ios: `maps:0,0?q=${label}@${hospital.latitude},${hospital.longitude}`,
        android: `geo:${hospital.latitude},${hospital.longitude}?q=${hospital.latitude},${hospital.longitude}(${label})`,
      });
      if (url) Linking.openURL(url);
    } else if (hospital.streetNumber && hospital.city) {
      const address = encodeURIComponent(`${hospital.streetNumber}, ${hospital.city}`);
      const url = Platform.select({ ios: `maps:0,0?q=${address}`, android: `geo:0,0?q=${address}` });
      if (url) Linking.openURL(url);
    }
  };

  const callHospital = (phone?: string) => {
    const p = phone || hospital?.phone;
    if (!p) return;
    if (registrationState === 'registered') makeCall(p);
    else Linking.openURL(`tel:${p}`);
  };

  const sendEmail = (email?: string) => {
    const e = email || hospital?.email;
    if (e) Linking.openURL(`mailto:${e}`);
  };

  const addNote = async () => {
    if (!noteText.trim() || !id) return;
    setAddingNote(true);
    try {
      await api.post(`/api/entity-notes/hospital/${id}`, { content: noteText.trim() });
      setNoteText('');
      qc.invalidateQueries({ queryKey: ['/api/entity-notes/hospital', id] });
    } catch (e: any) {
      Alert.alert(translations.common.error, e?.message || 'Chyba pri ukladaní poznámky');
    } finally {
      setAddingNote(false);
    }
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  if (!hospital) {
    return (
      <View style={styles.container}>
        <SafeAreaView style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={64} color={Colors.error} />
          <Text style={styles.errorText}>{th.noResults}</Text>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Text style={styles.backButtonText}>{translations.common.back}</Text>
          </TouchableOpacity>
        </SafeAreaView>
      </View>
    );
  }

  const isActive = hospital.isActive !== false;
  const h = editMode ? { ...hospital, ...form } : hospital;

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={[Colors.primary, Colors.primaryDark]}
        style={styles.headerGradient}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
      >
        <SafeAreaView edges={['top']}>
          <View style={styles.header}>
            <TouchableOpacity onPress={editMode ? cancelEdit : () => router.back()} style={styles.headerBtn} testID="button-back">
              <Ionicons name={editMode ? 'close' : 'arrow-back'} size={24} color={Colors.white} />
            </TouchableOpacity>
            <Text style={styles.headerTitle} numberOfLines={1}>
              {editMode ? th.editHospital : th.details}
            </Text>
            {editMode ? (
              <TouchableOpacity onPress={saveEdit} style={styles.headerBtn} testID="button-save-hospital" disabled={saving}>
                {saving ? <ActivityIndicator size="small" color={Colors.white} /> : <Ionicons name="checkmark" size={26} color={Colors.white} />}
              </TouchableOpacity>
            ) : (
              <TouchableOpacity onPress={startEdit} style={styles.headerBtn} testID="button-edit-hospital">
                <Ionicons name="create-outline" size={22} color={Colors.white} />
              </TouchableOpacity>
            )}
          </View>

          {!editMode && (
            <View style={styles.tabRow}>
              <TouchableOpacity
                style={[styles.detailTab, activeTab === 'info' && styles.detailTabActive]}
                onPress={() => setActiveTab('info')}
                testID="tab-info"
              >
                <Text style={[styles.detailTabText, activeTab === 'info' && styles.detailTabTextActive]}>
                  {translations.hospitals.details}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.detailTab, activeTab === 'personnel' && styles.detailTabActive]}
                onPress={() => setActiveTab('personnel')}
                testID="tab-personnel"
              >
                <Text style={[styles.detailTabText, activeTab === 'personnel' && styles.detailTabTextActive]}>
                  {th.personnelTab}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.detailTab, activeTab === 'midwives' && styles.detailTabActive]}
                onPress={() => setActiveTab('midwives')}
                testID="tab-midwives"
              >
                <Text style={[styles.detailTabText, activeTab === 'midwives' && styles.detailTabTextActive]}>
                  {th.midwivesTab}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.detailTab, activeTab === 'notes' && styles.detailTabActive]}
                onPress={() => setActiveTab('notes')}
                testID="tab-notes"
              >
                <Text style={[styles.detailTabText, activeTab === 'notes' && styles.detailTabTextActive]}>
                  Zápisky
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </SafeAreaView>
      </LinearGradient>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer} showsVerticalScrollIndicator={false}>

        {/* Header card */}
        <View style={styles.hospitalHeader}>
          <View style={[styles.hospitalIcon, { backgroundColor: isActive ? `${Colors.primary}15` : '#F0F0F0' }]}>
            <Ionicons name="business" size={32} color={isActive ? Colors.primary : Colors.textSecondary} />
          </View>
          <View style={styles.hospitalTitleSection}>
            <Text style={styles.hospitalName}>{h.name}</Text>
            {h.fullName && h.fullName !== h.name && <Text style={styles.hospitalFullName}>{h.fullName}</Text>}
            <View style={styles.badgeRow}>
              <View style={[styles.badge, { backgroundColor: isActive ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)' }]}>
                <Ionicons name={isActive ? 'checkmark-circle' : 'close-circle'} size={13} color={isActive ? Colors.success : Colors.error} />
                <Text style={[styles.badgeText, { color: isActive ? Colors.success : Colors.error }]}>
                  {isActive ? th.activeHospital : th.inactiveHospital}
                </Text>
              </View>
              {h.svetZdravia && (
                <View style={[styles.badge, { backgroundColor: 'rgba(14,165,233,0.12)' }]}>
                  <Ionicons name="heart" size={13} color="#0EA5E9" />
                  <Text style={[styles.badgeText, { color: '#0EA5E9' }]}>Svet zdravia</Text>
                </View>
              )}
            </View>
          </View>
        </View>

        {/* Quick actions */}
        {!editMode && activeTab === 'info' && (
          <View style={styles.actionRow}>
            {hospital.phone && (
              <TouchableOpacity style={styles.actionBtn} onPress={() => callHospital()} testID="button-call">
                <LinearGradient colors={[Colors.primary, Colors.primaryDark]} style={styles.actionBtnGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
                  <Ionicons name="call" size={18} color={Colors.white} />
                  <Text style={styles.actionBtnText}>{th.callHospital}</Text>
                </LinearGradient>
              </TouchableOpacity>
            )}
            {hospital.email && (
              <TouchableOpacity style={styles.actionBtn} onPress={() => sendEmail()} testID="button-email">
                <View style={styles.actionBtnOutline}>
                  <Ionicons name="mail" size={18} color={Colors.primary} />
                  <Text style={styles.actionBtnTextOutline}>{th.sendEmail}</Text>
                </View>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={styles.actionBtnSmall} onPress={openMap} testID="button-navigate">
              <View style={styles.actionBtnOutline}>
                <Ionicons name="navigate" size={18} color={Colors.primary} />
              </View>
            </TouchableOpacity>
          </View>
        )}

        {/* Edit mode */}
        {editMode ? (
          <>
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>{th.basicInfo}</Text>
              <EditField label={th.name} value={form.name || ''} onChangeText={v => setForm(f => ({ ...f, name: v }))} />
              <EditField label={th.fullName} value={form.fullName || ''} onChangeText={v => setForm(f => ({ ...f, fullName: v }))} />
              <EditField label={th.country} value={form.countryCode || ''} onChangeText={v => setForm(f => ({ ...f, countryCode: v }))} />
            </View>
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>{th.locationInfo}</Text>
              <EditField label={th.streetLabel} value={form.streetNumber || ''} onChangeText={v => setForm(f => ({ ...f, streetNumber: v }))} />
              <EditField label={th.postalCode} value={form.postalCode || ''} onChangeText={v => setForm(f => ({ ...f, postalCode: v }))} />
              <EditField label={th.city} value={form.city || ''} onChangeText={v => setForm(f => ({ ...f, city: v }))} />
              <EditField label={th.region} value={form.region || ''} onChangeText={v => setForm(f => ({ ...f, region: v }))} />
            </View>
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>{th.contactInfo}</Text>
              <EditField label={th.contactPerson} value={form.contactPerson || ''} onChangeText={v => setForm(f => ({ ...f, contactPerson: v }))} />
              <EditField label={th.phone} value={form.phone || ''} onChangeText={v => setForm(f => ({ ...f, phone: v }))} keyboardType="phone-pad" />
              <EditField label={th.email} value={form.email || ''} onChangeText={v => setForm(f => ({ ...f, email: v }))} keyboardType="email-address" />
            </View>
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>{th.additionalInfo}</Text>
              <BoolRow label={th.active} value={form.isActive !== false} onToggle={v => setForm(f => ({ ...f, isActive: v }))} />
              <View style={styles.infoDivider} />
              <BoolRow label="Svet zdravia" value={!!form.svetZdravia} onToggle={v => setForm(f => ({ ...f, svetZdravia: v }))} />
              <View style={styles.infoDivider} />
              <BoolRow label="Auto recruiting" value={!!form.autoRecruiting} onToggle={v => setForm(f => ({ ...f, autoRecruiting: v }))} />
            </View>
            <TouchableOpacity style={styles.saveBtn} onPress={saveEdit} disabled={saving} testID="button-save-bottom">
              {saving ? <ActivityIndicator size="small" color={Colors.white} /> : (
                <>
                  <Ionicons name="save-outline" size={20} color={Colors.white} />
                  <Text style={styles.saveBtnText}>{th.saveChanges}</Text>
                </>
              )}
            </TouchableOpacity>
          </>
        ) : activeTab === 'info' ? (
          <>
            <Text style={styles.sectionTitle}>{th.basicInfo}</Text>
            <View style={styles.card}>
              <InfoRow icon="business-outline" label={th.name} value={h.name} />
              {h.fullName && h.fullName !== h.name && (<><InfoDivider /><InfoRow icon="document-text-outline" label={th.fullName} value={h.fullName} /></>)}
              <InfoDivider />
              <InfoRow icon="flag-outline" label={th.country} value={h.countryCode} />
              {h.region && (<><InfoDivider /><InfoRow icon="map-outline" label={th.region} value={h.region} /></>)}
            </View>

            <Text style={styles.sectionTitle}>{th.locationInfo}</Text>
            <View style={styles.card}>
              <InfoRow icon="location-outline" label={th.streetLabel} value={h.streetNumber} />
              {h.streetNumber && h.postalCode && <InfoDivider />}
              <InfoRow icon="mail-outline" label={th.postalCode} value={h.postalCode} />
              {(h.streetNumber || h.postalCode) && h.city && <InfoDivider />}
              <InfoRow icon="business-outline" label={th.city} value={h.city} />
              {h.city && h.region && <InfoDivider />}
              <InfoRow icon="map-outline" label={th.region} value={h.region} />
              {h.latitude && h.longitude && (<><InfoDivider /><InfoRow icon="navigate-outline" label={th.coordinates} value={`${h.latitude}, ${h.longitude}`} /></>)}
              <TouchableOpacity style={styles.mapBtn} onPress={openMap} testID="button-navigate">
                <Ionicons name="navigate" size={16} color={Colors.primary} />
                <Text style={styles.mapBtnText}>{th.navigateToHospital}</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.sectionTitle}>{th.contactInfo}</Text>
            <View style={styles.card}>
              {h.contactPerson && (<><InfoRow icon="person-outline" label={th.contactPerson} value={h.contactPerson} /><InfoDivider /></>)}
              <InfoRow icon="call-outline" label={th.phone} value={h.phone || th.noData} />
              <InfoDivider />
              <InfoRow icon="mail-outline" label={th.email} value={h.email || th.noData} />
              {h.phone && (
                <TouchableOpacity style={styles.mapBtn} onPress={() => callHospital()} testID="button-call-card">
                  <Ionicons name="call" size={16} color={Colors.primary} />
                  <Text style={styles.mapBtnText}>{th.callHospital}</Text>
                </TouchableOpacity>
              )}
            </View>

            <Text style={styles.sectionTitle}>{th.additionalInfo}</Text>
            <View style={styles.card}>
              <View style={styles.infoRow}>
                <View style={styles.infoLabel}>
                  <Ionicons name="checkmark-circle-outline" size={16} color={Colors.textSecondary} />
                  <Text style={styles.infoLabelText}>{th.active}</Text>
                </View>
                <View style={[styles.badge, { backgroundColor: isActive ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)' }]}>
                  <Text style={[styles.badgeText, { color: isActive ? Colors.success : Colors.error }]}>
                    {isActive ? th.yes : th.no}
                  </Text>
                </View>
              </View>
              <InfoDivider />
              <View style={styles.infoRow}>
                <View style={styles.infoLabel}>
                  <Ionicons name="heart-outline" size={16} color={Colors.textSecondary} />
                  <Text style={styles.infoLabelText}>Svet zdravia</Text>
                </View>
                <View style={[styles.badge, { backgroundColor: h.svetZdravia ? 'rgba(14,165,233,0.12)' : 'rgba(0,0,0,0.04)' }]}>
                  <Text style={[styles.badgeText, { color: h.svetZdravia ? '#0EA5E9' : Colors.textSecondary }]}>
                    {h.svetZdravia ? th.yes : th.no}
                  </Text>
                </View>
              </View>
              <InfoDivider />
              <View style={styles.infoRow}>
                <View style={styles.infoLabel}>
                  <Ionicons name="person-add-outline" size={16} color={Colors.textSecondary} />
                  <Text style={styles.infoLabelText}>Auto recruiting</Text>
                </View>
                <View style={[styles.badge, { backgroundColor: h.autoRecruiting ? 'rgba(245,158,11,0.12)' : 'rgba(0,0,0,0.04)' }]}>
                  <Text style={[styles.badgeText, { color: h.autoRecruiting ? '#F59E0B' : Colors.textSecondary }]}>
                    {h.autoRecruiting ? th.yes : th.no}
                  </Text>
                </View>
              </View>
            </View>

            <TouchableOpacity style={styles.editFab} onPress={startEdit} testID="button-edit-fab">
              <LinearGradient colors={[Colors.primary, Colors.primaryDark]} style={styles.editFabGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
                <Ionicons name="create-outline" size={22} color={Colors.white} />
                <Text style={styles.editFabText}>{th.editAction}</Text>
              </LinearGradient>
            </TouchableOpacity>
          </>
        ) : activeTab === 'personnel' ? (
          /* Personnel tab */
          personnelLoading ? (
            <View style={styles.centeredBox}>
              <ActivityIndicator size="large" color={Colors.primary} />
            </View>
          ) : allPersonnel.length === 0 ? (
            <View style={styles.centeredBox}>
              <Ionicons name="people-outline" size={56} color={Colors.textSecondary} />
              <Text style={styles.emptyText}>{th.noPersonnel}</Text>
            </View>
          ) : (
            allPersonnel.map(person => (
              <PersonnelCard
                key={person.person_id}
                person={person}
                onCall={callHospital}
                onEmail={sendEmail}
              />
            ))
          )
        ) : activeTab === 'midwives' ? (
          /* Midwives tab */
          personnelLoading ? (
            <View style={styles.centeredBox}>
              <ActivityIndicator size="large" color={Colors.primary} />
            </View>
          ) : allMidwives.length === 0 ? (
            <View style={styles.centeredBox}>
              <Ionicons name="people-outline" size={56} color={Colors.textSecondary} />
              <Text style={styles.emptyText}>{th.noMidwives}</Text>
            </View>
          ) : (
            allMidwives.map(person => (
              <PersonnelCard
                key={person.person_id}
                person={person}
                onCall={callHospital}
                onEmail={sendEmail}
              />
            ))
          )
        ) : (
          /* Notes tab */
          <>
            <View style={styles.noteInputCard}>
              <TextInput
                style={styles.noteInputField}
                value={noteText}
                onChangeText={setNoteText}
                placeholder="Napísať poznámku..."
                placeholderTextColor={Colors.textSecondary}
                multiline
                numberOfLines={3}
                testID="input-note-text"
              />
              <TouchableOpacity
                style={[styles.addNoteBtn, { opacity: noteText.trim() ? 1 : 0.5 }]}
                onPress={addNote}
                disabled={addingNote || !noteText.trim()}
                testID="button-add-note"
              >
                {addingNote
                  ? <ActivityIndicator size="small" color={Colors.white} />
                  : <Text style={styles.addNoteBtnText}>Uložiť poznámku</Text>}
              </TouchableOpacity>
            </View>
            {(entityNotes as any[]).length === 0 ? (
              <View style={styles.centeredBox}>
                <Ionicons name="document-text-outline" size={48} color={Colors.textSecondary} />
                <Text style={styles.emptyText}>Žiadne poznámky</Text>
              </View>
            ) : (
              (entityNotes as any[]).map((note: any) => (
                <View key={note.id} style={styles.noteItem}>
                  <Text style={styles.noteContent}>{note.content}</Text>
                  <Text style={styles.noteMeta}>{note.userName}{note.createdAt ? ` · ${new Date(note.createdAt).toLocaleDateString('sk-SK')}` : ''}</Text>
                </View>
              ))
            )}
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
  backButton: { marginTop: Spacing.lg, paddingVertical: Spacing.sm, paddingHorizontal: Spacing.xl, backgroundColor: Colors.primary, borderRadius: 8 },
  backButtonText: { color: Colors.white, fontSize: FontSizes.md, fontWeight: '600' },
  headerGradient: {},
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.md, paddingVertical: Spacing.md },
  headerBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { flex: 1, fontSize: FontSizes.lg, fontWeight: '600', color: Colors.white, textAlign: 'center' },
  tabRow: { flexDirection: 'row', paddingHorizontal: Spacing.md, paddingBottom: Spacing.sm, gap: 8 },
  detailTab: { flex: 1, paddingVertical: 7, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center' },
  detailTabActive: { backgroundColor: 'rgba(255,255,255,0.95)' },
  detailTabText: { fontSize: FontSizes.sm, color: 'rgba(255,255,255,0.85)', fontWeight: '600' },
  detailTabTextActive: { color: Colors.primary },
  content: { flex: 1 },
  contentContainer: { padding: Spacing.md, paddingBottom: 40 },
  hospitalHeader: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: Spacing.md, backgroundColor: Colors.white, borderRadius: 16, padding: Spacing.md, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 2 },
  hospitalIcon: { width: 60, height: 60, borderRadius: 30, justifyContent: 'center', alignItems: 'center', marginRight: Spacing.md },
  hospitalTitleSection: { flex: 1 },
  hospitalName: { fontSize: FontSizes.xl, fontWeight: '700', color: Colors.text, marginBottom: 4 },
  hospitalFullName: { fontSize: FontSizes.sm, color: Colors.textSecondary, marginBottom: 6 },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  badgeText: { fontSize: 11, fontWeight: '600' },
  actionRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.md },
  actionBtn: { flex: 1, borderRadius: 12 },
  actionBtnSmall: { width: 50, borderRadius: 12 },
  actionBtnGrad: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: Spacing.md, gap: 6, borderRadius: 12, overflow: 'hidden' },
  actionBtnOutline: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: Spacing.md, gap: 6, borderWidth: 1, borderColor: Colors.primary, borderRadius: 12, backgroundColor: Colors.white },
  actionBtnText: { fontSize: FontSizes.sm, fontWeight: '600', color: Colors.white },
  actionBtnTextOutline: { fontSize: FontSizes.sm, fontWeight: '600', color: Colors.primary },
  sectionTitle: { fontSize: FontSizes.sm, fontWeight: '700', color: Colors.textSecondary, marginBottom: Spacing.xs, marginTop: Spacing.sm, textTransform: 'uppercase', letterSpacing: 0.5 },
  card: { backgroundColor: Colors.white, borderRadius: 16, padding: Spacing.md, marginBottom: Spacing.sm, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 2 },
  infoRow: { paddingVertical: 8 },
  infoLabel: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 3 },
  infoLabelText: { fontSize: FontSizes.xs, color: Colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.3 },
  infoValue: { fontSize: FontSizes.md, color: Colors.text, fontWeight: '500', marginLeft: 24 },
  infoDivider: { height: 1, backgroundColor: '#F0F2F6' },
  mapBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: Spacing.sm, paddingVertical: Spacing.sm, backgroundColor: `${Colors.primary}10`, borderRadius: 8, gap: 6 },
  mapBtnText: { fontSize: FontSizes.sm, fontWeight: '600', color: Colors.primary },
  editField: { marginBottom: 12 },
  editLabel: { fontSize: FontSizes.xs, color: Colors.textSecondary, fontWeight: '600', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.3 },
  editInput: { borderWidth: 1.5, borderColor: '#E0E5EF', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: FontSizes.md, color: Colors.text, backgroundColor: '#FAFBFC' },
  editInputMulti: { height: 80, textAlignVertical: 'top' },
  boolRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10 },
  boolLabel: { fontSize: FontSizes.md, color: Colors.text, fontWeight: '500' },
  saveBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: Colors.primary, borderRadius: 14, paddingVertical: Spacing.md, marginTop: Spacing.sm },
  saveBtnText: { fontSize: FontSizes.md, fontWeight: '700', color: Colors.white },
  editFab: { borderRadius: 14, marginTop: Spacing.sm, overflow: 'hidden' },
  editFabGrad: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: Spacing.md, gap: 8 },
  editFabText: { fontSize: FontSizes.md, fontWeight: '700', color: Colors.white },
  footerSpace: { height: 40 },
  centeredBox: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60, gap: Spacing.md },
  emptyText: { fontSize: FontSizes.md, color: Colors.textSecondary, marginTop: Spacing.sm },
  personnelCard: {
    backgroundColor: Colors.white, borderRadius: 14, marginBottom: 10, padding: 14,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
  },
  personnelRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  personnelAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: `${Colors.primary}12`, justifyContent: 'center', alignItems: 'center' },
  personnelInfo: { flex: 1 },
  personnelName: { fontSize: FontSizes.md, fontWeight: '700', color: Colors.text, marginBottom: 2 },
  personnelRole: { fontSize: FontSizes.xs, color: Colors.textSecondary, marginBottom: 3 },
  personnelPhone: { fontSize: FontSizes.sm, color: Colors.primary, fontWeight: '500' },
  personnelEmail: { fontSize: FontSizes.xs, color: Colors.textSecondary, marginTop: 1 },
  primaryBadge: { backgroundColor: `${Colors.primary}15`, width: 26, height: 26, borderRadius: 13, justifyContent: 'center', alignItems: 'center' },
  primaryBadgeText: { fontSize: 13, color: Colors.primary },
  personnelActions: { flexDirection: 'row', gap: 8, marginTop: 10, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#F0F2F6' },
  personnelActionBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: `${Colors.primary}10`, justifyContent: 'center', alignItems: 'center' },
  noteInputCard: { backgroundColor: Colors.white, borderRadius: 14, padding: Spacing.md, marginBottom: Spacing.md, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 2 },
  noteInputField: { borderWidth: 1.5, borderColor: '#E0E5EF', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: FontSizes.md, color: Colors.text, backgroundColor: '#FAFBFC', minHeight: 80, textAlignVertical: 'top' },
  addNoteBtn: { backgroundColor: Colors.primary, borderRadius: 10, paddingVertical: 10, alignItems: 'center', marginTop: 10 },
  addNoteBtnText: { fontSize: FontSizes.sm, fontWeight: '700', color: Colors.white },
  noteItem: { backgroundColor: Colors.white, borderRadius: 12, padding: 14, marginBottom: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 },
  noteContent: { fontSize: FontSizes.md, color: Colors.text, lineHeight: 20, marginBottom: 4 },
  noteMeta: { fontSize: FontSizes.xs, color: Colors.textSecondary },
});
