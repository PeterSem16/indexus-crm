import { SupportedLanguage } from '@/constants/config';

type TranslationKeys = {
  common: {
    loading: string;
    error: string;
    retry: string;
    cancel: string;
    save: string;
    delete: string;
    edit: string;
    confirm: string;
    back: string;
    next: string;
    done: string;
    search: string;
    noResults: string;
    offline: string;
    syncing: string;
    pendingSync: string;
    selectDate: string;
    day: string;
    month: string;
    year: string;
    today: string;
  };
  auth: {
    login: string;
    logout: string;
    username: string;
    password: string;
    rememberMe: string;
    signIn: string;
    signingIn: string;
    invalidCredentials: string;
    welcome: string;
    appDescription: string;
  };
  navigation: {
    home: string;
    visits: string;
    hospitals: string;
    map: string;
    profile: string;
  };
  visits: {
    title: string;
    today: string;
    upcoming: string;
    completed: string;
    newVisit: string;
    startVisit: string;
    endVisit: string;
    addNote: string;
    voiceNote: string;
    noVisits: string;
    visitType: string;
    hospital: string;
    scheduledTime: string;
    duration: string;
    notes: string;
  };
  hospitals: {
    title: string;
    addHospital: string;
    noHospitals: string;
    name: string;
    city: string;
    address: string;
    contact: string;
  };
  profile: {
    title: string;
    settings: string;
    language: string;
    notifications: string;
    about: string;
    version: string;
  };
};

const translations: Record<SupportedLanguage, TranslationKeys> = {
  sk: {
    common: {
      loading: 'Načítavam...',
      error: 'Chyba',
      retry: 'Skúsiť znova',
      cancel: 'Zrušiť',
      save: 'Uložiť',
      delete: 'Odstrániť',
      edit: 'Upraviť',
      confirm: 'Potvrdiť',
      back: 'Späť',
      next: 'Ďalej',
      done: 'Hotovo',
      search: 'Hľadať',
      noResults: 'Žiadne výsledky',
      offline: 'Offline režim',
      syncing: 'Synchronizujem...',
      pendingSync: 'Čaká na synchronizáciu',
      selectDate: 'Vybrať dátum',
      day: 'Deň',
      month: 'Mesiac',
      year: 'Rok',
      today: 'Dnes',
    },
    auth: {
      login: 'Prihlásenie',
      logout: 'Odhlásiť sa',
      username: 'Používateľské meno',
      password: 'Heslo',
      rememberMe: 'Zapamätať si ma',
      signIn: 'Prihlásiť sa',
      signingIn: 'Prihlasujem...',
      invalidCredentials: 'Nesprávne prihlasovacie údaje',
      welcome: 'Vitajte späť',
      appDescription: 'Aplikácia pre obchodných zástupcov',
    },
    navigation: {
      home: 'Domov',
      visits: 'Návštevy',
      hospitals: 'Nemocnice',
      map: 'Mapa',
      profile: 'Profil',
    },
    visits: {
      title: 'Návštevy',
      today: 'Dnes',
      upcoming: 'Nadchádzajúce',
      completed: 'Dokončené',
      newVisit: 'Nová návšteva',
      startVisit: 'Začať návštevu',
      endVisit: 'Ukončiť návštevu',
      addNote: 'Pridať poznámku',
      voiceNote: 'Hlasová poznámka',
      noVisits: 'Žiadne návštevy',
      visitType: 'Typ návštevy',
      hospital: 'Nemocnica',
      scheduledTime: 'Plánovaný čas',
      duration: 'Trvanie',
      notes: 'Poznámky',
    },
    hospitals: {
      title: 'Nemocnice',
      addHospital: 'Pridať nemocnicu',
      noHospitals: 'Žiadne nemocnice',
      name: 'Názov',
      city: 'Mesto',
      address: 'Adresa',
      contact: 'Kontakt',
    },
    profile: {
      title: 'Profil',
      settings: 'Nastavenia',
      language: 'Jazyk',
      notifications: 'Notifikácie',
      about: 'O aplikácii',
      version: 'Verzia',
    },
  },
  cs: {
    common: {
      loading: 'Načítám...',
      error: 'Chyba',
      retry: 'Zkusit znovu',
      cancel: 'Zrušit',
      save: 'Uložit',
      delete: 'Odstranit',
      edit: 'Upravit',
      confirm: 'Potvrdit',
      back: 'Zpět',
      next: 'Další',
      done: 'Hotovo',
      search: 'Hledat',
      noResults: 'Žádné výsledky',
      offline: 'Offline režim',
      syncing: 'Synchronizuji...',
      pendingSync: 'Čeká na synchronizaci',
      selectDate: 'Vybrat datum',
      day: 'Den',
      month: 'Měsíc',
      year: 'Rok',
      today: 'Dnes',
    },
    auth: {
      login: 'Přihlášení',
      logout: 'Odhlásit se',
      username: 'Uživatelské jméno',
      password: 'Heslo',
      rememberMe: 'Zapamatovat si mě',
      signIn: 'Přihlásit se',
      signingIn: 'Přihlašuji...',
      invalidCredentials: 'Nesprávné přihlašovací údaje',
      welcome: 'Vítejte zpět',
      appDescription: 'Aplikace pro obchodní zástupce',
    },
    navigation: {
      home: 'Domů',
      visits: 'Návštěvy',
      hospitals: 'Nemocnice',
      map: 'Mapa',
      profile: 'Profil',
    },
    visits: {
      title: 'Návštěvy',
      today: 'Dnes',
      upcoming: 'Nadcházející',
      completed: 'Dokončené',
      newVisit: 'Nová návštěva',
      startVisit: 'Začít návštěvu',
      endVisit: 'Ukončit návštěvu',
      addNote: 'Přidat poznámku',
      voiceNote: 'Hlasová poznámka',
      noVisits: 'Žádné návštěvy',
      visitType: 'Typ návštěvy',
      hospital: 'Nemocnice',
      scheduledTime: 'Plánovaný čas',
      duration: 'Trvání',
      notes: 'Poznámky',
    },
    hospitals: {
      title: 'Nemocnice',
      addHospital: 'Přidat nemocnici',
      noHospitals: 'Žádné nemocnice',
      name: 'Název',
      city: 'Město',
      address: 'Adresa',
      contact: 'Kontakt',
    },
    profile: {
      title: 'Profil',
      settings: 'Nastavení',
      language: 'Jazyk',
      notifications: 'Notifikace',
      about: 'O aplikaci',
      version: 'Verze',
    },
  },
  hu: {
    common: {
      loading: 'Betöltés...',
      error: 'Hiba',
      retry: 'Újra',
      cancel: 'Mégse',
      save: 'Mentés',
      delete: 'Törlés',
      edit: 'Szerkesztés',
      confirm: 'Megerősítés',
      back: 'Vissza',
      next: 'Következő',
      done: 'Kész',
      search: 'Keresés',
      noResults: 'Nincs találat',
      offline: 'Offline mód',
      syncing: 'Szinkronizálás...',
      pendingSync: 'Szinkronizálásra vár',
      selectDate: 'Dátum kiválasztása',
      day: 'Nap',
      month: 'Hónap',
      year: 'Év',
      today: 'Ma',
    },
    auth: {
      login: 'Bejelentkezés',
      logout: 'Kijelentkezés',
      username: 'Felhasználónév',
      password: 'Jelszó',
      rememberMe: 'Emlékezz rám',
      signIn: 'Bejelentkezés',
      signingIn: 'Bejelentkezés...',
      invalidCredentials: 'Hibás bejelentkezési adatok',
      welcome: 'Üdv újra',
      appDescription: 'Területi képviselő alkalmazás',
    },
    navigation: {
      home: 'Kezdőlap',
      visits: 'Látogatások',
      hospitals: 'Kórházak',
      map: 'Térkép',
      profile: 'Profil',
    },
    visits: {
      title: 'Látogatások',
      today: 'Ma',
      upcoming: 'Közelgő',
      completed: 'Befejezett',
      newVisit: 'Új látogatás',
      startVisit: 'Látogatás indítása',
      endVisit: 'Látogatás befejezése',
      addNote: 'Jegyzet hozzáadása',
      voiceNote: 'Hangfelvétel',
      noVisits: 'Nincs látogatás',
      visitType: 'Látogatás típusa',
      hospital: 'Kórház',
      scheduledTime: 'Tervezett idő',
      duration: 'Időtartam',
      notes: 'Jegyzetek',
    },
    hospitals: {
      title: 'Kórházak',
      addHospital: 'Kórház hozzáadása',
      noHospitals: 'Nincs kórház',
      name: 'Név',
      city: 'Város',
      address: 'Cím',
      contact: 'Kapcsolat',
    },
    profile: {
      title: 'Profil',
      settings: 'Beállítások',
      language: 'Nyelv',
      notifications: 'Értesítések',
      about: 'Az alkalmazásról',
      version: 'Verzió',
    },
  },
  de: {
    common: {
      loading: 'Laden...',
      error: 'Fehler',
      retry: 'Erneut versuchen',
      cancel: 'Abbrechen',
      save: 'Speichern',
      delete: 'Löschen',
      edit: 'Bearbeiten',
      confirm: 'Bestätigen',
      back: 'Zurück',
      next: 'Weiter',
      done: 'Fertig',
      search: 'Suchen',
      noResults: 'Keine Ergebnisse',
      offline: 'Offline-Modus',
      syncing: 'Synchronisieren...',
      pendingSync: 'Ausstehende Synchronisierung',
      selectDate: 'Datum auswählen',
      day: 'Tag',
      month: 'Monat',
      year: 'Jahr',
      today: 'Heute',
    },
    auth: {
      login: 'Anmeldung',
      logout: 'Abmelden',
      username: 'Benutzername',
      password: 'Passwort',
      rememberMe: 'Angemeldet bleiben',
      signIn: 'Anmelden',
      signingIn: 'Anmelden...',
      invalidCredentials: 'Ungültige Anmeldedaten',
      welcome: 'Willkommen zurück',
      appDescription: 'Außendienst-App',
    },
    navigation: {
      home: 'Startseite',
      visits: 'Besuche',
      hospitals: 'Krankenhäuser',
      map: 'Karte',
      profile: 'Profil',
    },
    visits: {
      title: 'Besuche',
      today: 'Heute',
      upcoming: 'Bevorstehend',
      completed: 'Abgeschlossen',
      newVisit: 'Neuer Besuch',
      startVisit: 'Besuch starten',
      endVisit: 'Besuch beenden',
      addNote: 'Notiz hinzufügen',
      voiceNote: 'Sprachnotiz',
      noVisits: 'Keine Besuche',
      visitType: 'Besuchstyp',
      hospital: 'Krankenhaus',
      scheduledTime: 'Geplante Zeit',
      duration: 'Dauer',
      notes: 'Notizen',
    },
    hospitals: {
      title: 'Krankenhäuser',
      addHospital: 'Krankenhaus hinzufügen',
      noHospitals: 'Keine Krankenhäuser',
      name: 'Name',
      city: 'Stadt',
      address: 'Adresse',
      contact: 'Kontakt',
    },
    profile: {
      title: 'Profil',
      settings: 'Einstellungen',
      language: 'Sprache',
      notifications: 'Benachrichtigungen',
      about: 'Über die App',
      version: 'Version',
    },
  },
  it: {
    common: {
      loading: 'Caricamento...',
      error: 'Errore',
      retry: 'Riprova',
      cancel: 'Annulla',
      save: 'Salva',
      delete: 'Elimina',
      edit: 'Modifica',
      confirm: 'Conferma',
      back: 'Indietro',
      next: 'Avanti',
      done: 'Fatto',
      search: 'Cerca',
      noResults: 'Nessun risultato',
      offline: 'Modalità offline',
      syncing: 'Sincronizzazione...',
      pendingSync: 'In attesa di sincronizzazione',
      selectDate: 'Seleziona data',
      day: 'Giorno',
      month: 'Mese',
      year: 'Anno',
      today: 'Oggi',
    },
    auth: {
      login: 'Accesso',
      logout: 'Esci',
      username: 'Nome utente',
      password: 'Password',
      rememberMe: 'Ricordami',
      signIn: 'Accedi',
      signingIn: 'Accesso in corso...',
      invalidCredentials: 'Credenziali non valide',
      welcome: 'Bentornato',
      appDescription: 'App per rappresentanti',
    },
    navigation: {
      home: 'Home',
      visits: 'Visite',
      hospitals: 'Ospedali',
      map: 'Mappa',
      profile: 'Profilo',
    },
    visits: {
      title: 'Visite',
      today: 'Oggi',
      upcoming: 'In programma',
      completed: 'Completate',
      newVisit: 'Nuova visita',
      startVisit: 'Inizia visita',
      endVisit: 'Termina visita',
      addNote: 'Aggiungi nota',
      voiceNote: 'Nota vocale',
      noVisits: 'Nessuna visita',
      visitType: 'Tipo di visita',
      hospital: 'Ospedale',
      scheduledTime: 'Orario previsto',
      duration: 'Durata',
      notes: 'Note',
    },
    hospitals: {
      title: 'Ospedali',
      addHospital: 'Aggiungi ospedale',
      noHospitals: 'Nessun ospedale',
      name: 'Nome',
      city: 'Città',
      address: 'Indirizzo',
      contact: 'Contatto',
    },
    profile: {
      title: 'Profilo',
      settings: 'Impostazioni',
      language: 'Lingua',
      notifications: 'Notifiche',
      about: 'Info app',
      version: 'Versione',
    },
  },
  ro: {
    common: {
      loading: 'Se încarcă...',
      error: 'Eroare',
      retry: 'Reîncearcă',
      cancel: 'Anulează',
      save: 'Salvează',
      delete: 'Șterge',
      edit: 'Editează',
      confirm: 'Confirmă',
      back: 'Înapoi',
      next: 'Înainte',
      done: 'Gata',
      search: 'Caută',
      noResults: 'Fără rezultate',
      offline: 'Mod offline',
      syncing: 'Se sincronizează...',
      pendingSync: 'În așteptare sincronizare',
      selectDate: 'Selectează data',
      day: 'Zi',
      month: 'Lună',
      year: 'An',
      today: 'Astăzi',
    },
    auth: {
      login: 'Autentificare',
      logout: 'Deconectare',
      username: 'Nume utilizator',
      password: 'Parolă',
      rememberMe: 'Ține-mă minte',
      signIn: 'Conectează-te',
      signingIn: 'Se conectează...',
      invalidCredentials: 'Credențiale invalide',
      welcome: 'Bine ai revenit',
      appDescription: 'Aplicație pentru reprezentanți',
    },
    navigation: {
      home: 'Acasă',
      visits: 'Vizite',
      hospitals: 'Spitale',
      map: 'Hartă',
      profile: 'Profil',
    },
    visits: {
      title: 'Vizite',
      today: 'Astăzi',
      upcoming: 'Viitoare',
      completed: 'Finalizate',
      newVisit: 'Vizită nouă',
      startVisit: 'Începe vizita',
      endVisit: 'Încheie vizita',
      addNote: 'Adaugă notă',
      voiceNote: 'Notă vocală',
      noVisits: 'Nicio vizită',
      visitType: 'Tip vizită',
      hospital: 'Spital',
      scheduledTime: 'Ora programată',
      duration: 'Durată',
      notes: 'Note',
    },
    hospitals: {
      title: 'Spitale',
      addHospital: 'Adaugă spital',
      noHospitals: 'Niciun spital',
      name: 'Nume',
      city: 'Oraș',
      address: 'Adresă',
      contact: 'Contact',
    },
    profile: {
      title: 'Profil',
      settings: 'Setări',
      language: 'Limbă',
      notifications: 'Notificări',
      about: 'Despre aplicație',
      version: 'Versiune',
    },
  },
  en: {
    common: {
      loading: 'Loading...',
      error: 'Error',
      retry: 'Retry',
      cancel: 'Cancel',
      save: 'Save',
      delete: 'Delete',
      edit: 'Edit',
      confirm: 'Confirm',
      back: 'Back',
      next: 'Next',
      done: 'Done',
      search: 'Search',
      noResults: 'No results',
      offline: 'Offline mode',
      syncing: 'Syncing...',
      pendingSync: 'Pending sync',
      selectDate: 'Select Date',
      day: 'Day',
      month: 'Month',
      year: 'Year',
      today: 'Today',
    },
    auth: {
      login: 'Login',
      logout: 'Logout',
      username: 'Username',
      password: 'Password',
      rememberMe: 'Remember me',
      signIn: 'Sign In',
      signingIn: 'Signing in...',
      invalidCredentials: 'Invalid credentials',
      welcome: 'Welcome back',
      appDescription: 'Field Representative App',
    },
    navigation: {
      home: 'Home',
      visits: 'Visits',
      hospitals: 'Hospitals',
      map: 'Map',
      profile: 'Profile',
    },
    visits: {
      title: 'Visits',
      today: 'Today',
      upcoming: 'Upcoming',
      completed: 'Completed',
      newVisit: 'New Visit',
      startVisit: 'Start Visit',
      endVisit: 'End Visit',
      addNote: 'Add Note',
      voiceNote: 'Voice Note',
      noVisits: 'No visits',
      visitType: 'Visit Type',
      hospital: 'Hospital',
      scheduledTime: 'Scheduled Time',
      duration: 'Duration',
      notes: 'Notes',
    },
    hospitals: {
      title: 'Hospitals',
      addHospital: 'Add Hospital',
      noHospitals: 'No hospitals',
      name: 'Name',
      city: 'City',
      address: 'Address',
      contact: 'Contact',
    },
    profile: {
      title: 'Profile',
      settings: 'Settings',
      language: 'Language',
      notifications: 'Notifications',
      about: 'About',
      version: 'Version',
    },
  },
};

export function getTranslation(language: SupportedLanguage): TranslationKeys {
  return translations[language] || translations.en;
}

export function t(language: SupportedLanguage, path: string): string {
  const parts = path.split('.');
  let result: any = translations[language] || translations.en;
  
  for (const part of parts) {
    result = result?.[part];
  }
  
  return result || path;
}
