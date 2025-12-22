export type Locale = 'en' | 'sk' | 'cs' | 'hu' | 'ro' | 'it' | 'de';

export const COUNTRY_TO_LOCALE: Record<string, Locale> = {
  US: 'en',
  SK: 'sk',
  CZ: 'cs',
  HU: 'hu',
  RO: 'ro',
  IT: 'it',
  DE: 'de',
};

export interface Translations {
  nav: {
    dashboard: string;
    customers: string;
    products: string;
    invoices: string;
    users: string;
    settings: string;
    logout: string;
  };
  common: {
    save: string;
    cancel: string;
    delete: string;
    edit: string;
    add: string;
    search: string;
    filter: string;
    loading: string;
    noData: string;
    confirm: string;
    yes: string;
    no: string;
    actions: string;
    status: string;
    name: string;
    email: string;
    phone: string;
    country: string;
    allCountries: string;
    active: string;
    inactive: string;
    pending: string;
    global: string;
    required: string;
  };
  dashboard: {
    title: string;
    totalCustomers: string;
    activeCustomers: string;
    pendingCustomers: string;
    totalProducts: string;
    recentActivity: string;
  };
  customers: {
    title: string;
    addCustomer: string;
    editCustomer: string;
    deleteCustomer: string;
    deleteConfirm: string;
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    country: string;
    status: string;
    serviceType: string;
    address: string;
    city: string;
    postalCode: string;
    notes: string;
    tabs: {
      client: string;
      marketing: string;
      addresses: string;
      other: string;
    };
    fields: {
      title: string;
      phone2: string;
      otherContact: string;
      email2: string;
      nationalId: string;
      idCardNumber: string;
      dateOfBirth: string;
      newsletter: string;
      complaintType: string;
      cooperationType: string;
      vipStatus: string;
      permanentAddress: string;
      correspondenceAddress: string;
      sameAsPermament: string;
      street: string;
      bankAccount: string;
      iban: string;
      bankName: string;
      swift: string;
      healthInsurance: string;
      noInsuranceConfigured: string;
    };
    serviceTypes: {
      cordBlood: string;
      cordTissue: string;
      both: string;
    };
    none: string;
  };
  products: {
    title: string;
    addProduct: string;
    editProduct: string;
    deleteProduct: string;
    productName: string;
    description: string;
    price: string;
    availability: string;
  };
  invoices: {
    title: string;
    addInvoice: string;
    invoiceNumber: string;
    customer: string;
    amount: string;
    dueDate: string;
    status: string;
    paid: string;
    unpaid: string;
    overdue: string;
  };
  users: {
    title: string;
    addUser: string;
    editUser: string;
    deleteUser: string;
    username: string;
    password: string;
    role: string;
    assignedCountries: string;
    roles: {
      admin: string;
      manager: string;
      user: string;
    };
  };
  settings: {
    title: string;
    configuration: string;
    complaintTypes: string;
    cooperationTypes: string;
    vipStatuses: string;
    healthInsurance: string;
    billingDetails: string;
    addNew: string;
    deleteConfirm: string;
    code: string;
    noItems: string;
  };
  auth: {
    login: string;
    logout: string;
    username: string;
    password: string;
    loginButton: string;
    invalidCredentials: string;
  };
  errors: {
    required: string;
    invalidEmail: string;
    invalidPhone: string;
    invalidIban: string;
    saveFailed: string;
    deleteFailed: string;
    loadFailed: string;
  };
  success: {
    saved: string;
    deleted: string;
    created: string;
    updated: string;
  };
}

export const translations: Record<Locale, Translations> = {
  en: {
    nav: {
      dashboard: 'Dashboard',
      customers: 'Customers',
      products: 'Products',
      invoices: 'Invoices',
      users: 'Users',
      settings: 'Settings',
      logout: 'Logout',
    },
    common: {
      save: 'Save',
      cancel: 'Cancel',
      delete: 'Delete',
      edit: 'Edit',
      add: 'Add',
      search: 'Search',
      filter: 'Filter',
      loading: 'Loading...',
      noData: 'No data available',
      confirm: 'Confirm',
      yes: 'Yes',
      no: 'No',
      actions: 'Actions',
      status: 'Status',
      name: 'Name',
      email: 'Email',
      phone: 'Phone',
      country: 'Country',
      allCountries: 'All Countries',
      active: 'Active',
      inactive: 'Inactive',
      pending: 'Pending',
      global: 'Global',
      required: 'Required',
    },
    dashboard: {
      title: 'Dashboard',
      totalCustomers: 'Total Customers',
      activeCustomers: 'Active Customers',
      pendingCustomers: 'Pending Customers',
      totalProducts: 'Total Products',
      recentActivity: 'Recent Activity',
    },
    customers: {
      title: 'Customers',
      addCustomer: 'Add Customer',
      editCustomer: 'Edit Customer',
      deleteCustomer: 'Delete Customer',
      deleteConfirm: 'Are you sure you want to delete this customer?',
      firstName: 'First Name',
      lastName: 'Last Name',
      email: 'Email',
      phone: 'Phone',
      country: 'Country',
      status: 'Status',
      serviceType: 'Service Type',
      address: 'Address',
      city: 'City',
      postalCode: 'Postal Code',
      notes: 'Notes',
      tabs: {
        client: 'Client',
        marketing: 'Marketing',
        addresses: 'Addresses',
        other: 'Other',
      },
      fields: {
        title: 'Title',
        phone2: 'Phone 2',
        otherContact: 'Other Contact',
        email2: 'Email 2',
        nationalId: 'National ID',
        idCardNumber: 'ID Card Number',
        dateOfBirth: 'Date of Birth',
        newsletter: 'Newsletter',
        complaintType: 'Complaint Type',
        cooperationType: 'Cooperation Type',
        vipStatus: 'VIP Status',
        permanentAddress: 'Permanent Address',
        correspondenceAddress: 'Correspondence Address',
        sameAsPermament: 'Same as permanent address',
        street: 'Street and Number',
        bankAccount: 'Bank Account',
        iban: 'IBAN',
        bankName: 'Bank Name',
        swift: 'SWIFT Code',
        healthInsurance: 'Health Insurance',
        noInsuranceConfigured: 'No insurance configured for selected country',
      },
      serviceTypes: {
        cordBlood: 'Cord Blood',
        cordTissue: 'Cord Tissue',
        both: 'Both',
      },
      none: 'None',
    },
    products: {
      title: 'Products',
      addProduct: 'Add Product',
      editProduct: 'Edit Product',
      deleteProduct: 'Delete Product',
      productName: 'Product Name',
      description: 'Description',
      price: 'Price',
      availability: 'Availability',
    },
    invoices: {
      title: 'Invoices',
      addInvoice: 'Add Invoice',
      invoiceNumber: 'Invoice Number',
      customer: 'Customer',
      amount: 'Amount',
      dueDate: 'Due Date',
      status: 'Status',
      paid: 'Paid',
      unpaid: 'Unpaid',
      overdue: 'Overdue',
    },
    users: {
      title: 'Users',
      addUser: 'Add User',
      editUser: 'Edit User',
      deleteUser: 'Delete User',
      username: 'Username',
      password: 'Password',
      role: 'Role',
      assignedCountries: 'Assigned Countries',
      roles: {
        admin: 'Administrator',
        manager: 'Manager',
        user: 'User',
      },
    },
    settings: {
      title: 'Settings',
      configuration: 'Configuration',
      complaintTypes: 'Complaint Types',
      cooperationTypes: 'Cooperation Types',
      vipStatuses: 'VIP Statuses',
      healthInsurance: 'Health Insurance',
      billingDetails: 'Billing Details',
      addNew: 'Add New',
      deleteConfirm: 'Are you sure you want to delete this item?',
      code: 'Code',
      noItems: 'No items',
    },
    auth: {
      login: 'Login',
      logout: 'Logout',
      username: 'Username',
      password: 'Password',
      loginButton: 'Sign In',
      invalidCredentials: 'Invalid username or password',
    },
    errors: {
      required: 'This field is required',
      invalidEmail: 'Invalid email address',
      invalidPhone: 'Invalid phone number',
      invalidIban: 'Invalid IBAN format',
      saveFailed: 'Failed to save',
      deleteFailed: 'Failed to delete',
      loadFailed: 'Failed to load data',
    },
    success: {
      saved: 'Successfully saved',
      deleted: 'Successfully deleted',
      created: 'Successfully created',
      updated: 'Successfully updated',
    },
  },
  sk: {
    nav: {
      dashboard: 'Prehľad',
      customers: 'Zákazníci',
      products: 'Produkty',
      invoices: 'Faktúry',
      users: 'Používatelia',
      settings: 'Nastavenia',
      logout: 'Odhlásiť',
    },
    common: {
      save: 'Uložiť',
      cancel: 'Zrušiť',
      delete: 'Odstrániť',
      edit: 'Upraviť',
      add: 'Pridať',
      search: 'Hľadať',
      filter: 'Filter',
      loading: 'Načítavam...',
      noData: 'Žiadne dáta',
      confirm: 'Potvrdiť',
      yes: 'Áno',
      no: 'Nie',
      actions: 'Akcie',
      status: 'Stav',
      name: 'Meno',
      email: 'Email',
      phone: 'Telefón',
      country: 'Krajina',
      allCountries: 'Všetky krajiny',
      active: 'Aktívny',
      inactive: 'Neaktívny',
      pending: 'Čakajúci',
      global: 'Globálne',
      required: 'Povinné',
    },
    dashboard: {
      title: 'Prehľad',
      totalCustomers: 'Celkom zákazníkov',
      activeCustomers: 'Aktívni zákazníci',
      pendingCustomers: 'Čakajúci zákazníci',
      totalProducts: 'Celkom produktov',
      recentActivity: 'Posledná aktivita',
    },
    customers: {
      title: 'Zákazníci',
      addCustomer: 'Pridať zákazníka',
      editCustomer: 'Upraviť zákazníka',
      deleteCustomer: 'Odstrániť zákazníka',
      deleteConfirm: 'Naozaj chcete odstrániť tohto zákazníka?',
      firstName: 'Meno',
      lastName: 'Priezvisko',
      email: 'Email',
      phone: 'Telefón',
      country: 'Krajina',
      status: 'Stav',
      serviceType: 'Typ služby',
      address: 'Adresa',
      city: 'Mesto',
      postalCode: 'PSČ',
      notes: 'Poznámky',
      tabs: {
        client: 'Klientka',
        marketing: 'Marketing',
        addresses: 'Adresy',
        other: 'Iné',
      },
      fields: {
        title: 'Titul',
        phone2: 'Telefón 2',
        otherContact: 'Iný kontakt',
        email2: 'Email 2',
        nationalId: 'Rodné číslo',
        idCardNumber: 'Číslo OP',
        dateOfBirth: 'Dátum narodenia',
        newsletter: 'Newsletter',
        complaintType: 'Sťažnosti',
        cooperationType: 'Spolupráca',
        vipStatus: 'VIP Status',
        permanentAddress: 'Trvalé bydlisko',
        correspondenceAddress: 'Korešpondenčná adresa',
        sameAsPermament: 'Rovnaká ako trvalé bydlisko',
        street: 'Ulica a číslo',
        bankAccount: 'Bankový účet',
        iban: 'IBAN',
        bankName: 'Názov banky',
        swift: 'SWIFT kód',
        healthInsurance: 'Zdravotná poisťovňa',
        noInsuranceConfigured: 'Žiadne poisťovne nakonfigurované pre vybratú krajinu',
      },
      serviceTypes: {
        cordBlood: 'Pupočníková krv',
        cordTissue: 'Pupočníkové tkanivo',
        both: 'Obe',
      },
      none: 'Žiadna',
    },
    products: {
      title: 'Produkty',
      addProduct: 'Pridať produkt',
      editProduct: 'Upraviť produkt',
      deleteProduct: 'Odstrániť produkt',
      productName: 'Názov produktu',
      description: 'Popis',
      price: 'Cena',
      availability: 'Dostupnosť',
    },
    invoices: {
      title: 'Faktúry',
      addInvoice: 'Vytvoriť faktúru',
      invoiceNumber: 'Číslo faktúry',
      customer: 'Zákazník',
      amount: 'Suma',
      dueDate: 'Splatnosť',
      status: 'Stav',
      paid: 'Zaplatená',
      unpaid: 'Nezaplatená',
      overdue: 'Po splatnosti',
    },
    users: {
      title: 'Používatelia',
      addUser: 'Pridať používateľa',
      editUser: 'Upraviť používateľa',
      deleteUser: 'Odstrániť používateľa',
      username: 'Používateľské meno',
      password: 'Heslo',
      role: 'Rola',
      assignedCountries: 'Priradené krajiny',
      roles: {
        admin: 'Administrátor',
        manager: 'Manažér',
        user: 'Používateľ',
      },
    },
    settings: {
      title: 'Nastavenia',
      configuration: 'Konfigurácia',
      complaintTypes: 'Typy sťažností',
      cooperationTypes: 'Typy spolupráce',
      vipStatuses: 'VIP Statusy',
      healthInsurance: 'Zdravotné poisťovne',
      billingDetails: 'Fakturačné údaje',
      addNew: 'Pridať nový',
      deleteConfirm: 'Naozaj chcete odstrániť túto položku?',
      code: 'Kód',
      noItems: 'Žiadne položky',
    },
    auth: {
      login: 'Prihlásenie',
      logout: 'Odhlásiť',
      username: 'Používateľské meno',
      password: 'Heslo',
      loginButton: 'Prihlásiť sa',
      invalidCredentials: 'Nesprávne meno alebo heslo',
    },
    errors: {
      required: 'Toto pole je povinné',
      invalidEmail: 'Neplatná emailová adresa',
      invalidPhone: 'Neplatné telefónne číslo',
      invalidIban: 'Neplatný formát IBAN',
      saveFailed: 'Uloženie zlyhalo',
      deleteFailed: 'Odstránenie zlyhalo',
      loadFailed: 'Načítanie dát zlyhalo',
    },
    success: {
      saved: 'Úspešne uložené',
      deleted: 'Úspešne odstránené',
      created: 'Úspešne vytvorené',
      updated: 'Úspešne aktualizované',
    },
  },
  cs: {
    nav: {
      dashboard: 'Přehled',
      customers: 'Zákazníci',
      products: 'Produkty',
      invoices: 'Faktury',
      users: 'Uživatelé',
      settings: 'Nastavení',
      logout: 'Odhlásit',
    },
    common: {
      save: 'Uložit',
      cancel: 'Zrušit',
      delete: 'Odstranit',
      edit: 'Upravit',
      add: 'Přidat',
      search: 'Hledat',
      filter: 'Filtr',
      loading: 'Načítám...',
      noData: 'Žádná data',
      confirm: 'Potvrdit',
      yes: 'Ano',
      no: 'Ne',
      actions: 'Akce',
      status: 'Stav',
      name: 'Jméno',
      email: 'Email',
      phone: 'Telefon',
      country: 'Země',
      allCountries: 'Všechny země',
      active: 'Aktivní',
      inactive: 'Neaktivní',
      pending: 'Čekající',
      global: 'Globální',
      required: 'Povinné',
    },
    dashboard: {
      title: 'Přehled',
      totalCustomers: 'Celkem zákazníků',
      activeCustomers: 'Aktivní zákazníci',
      pendingCustomers: 'Čekající zákazníci',
      totalProducts: 'Celkem produktů',
      recentActivity: 'Poslední aktivita',
    },
    customers: {
      title: 'Zákazníci',
      addCustomer: 'Přidat zákazníka',
      editCustomer: 'Upravit zákazníka',
      deleteCustomer: 'Odstranit zákazníka',
      deleteConfirm: 'Opravdu chcete odstranit tohoto zákazníka?',
      firstName: 'Jméno',
      lastName: 'Příjmení',
      email: 'Email',
      phone: 'Telefon',
      country: 'Země',
      status: 'Stav',
      serviceType: 'Typ služby',
      address: 'Adresa',
      city: 'Město',
      postalCode: 'PSČ',
      notes: 'Poznámky',
      tabs: {
        client: 'Klientka',
        marketing: 'Marketing',
        addresses: 'Adresy',
        other: 'Jiné',
      },
      fields: {
        title: 'Titul',
        phone2: 'Telefon 2',
        otherContact: 'Jiný kontakt',
        email2: 'Email 2',
        nationalId: 'Rodné číslo',
        idCardNumber: 'Číslo OP',
        dateOfBirth: 'Datum narození',
        newsletter: 'Newsletter',
        complaintType: 'Stížnosti',
        cooperationType: 'Spolupráce',
        vipStatus: 'VIP Status',
        permanentAddress: 'Trvalé bydliště',
        correspondenceAddress: 'Korespondenční adresa',
        sameAsPermament: 'Stejná jako trvalé bydliště',
        street: 'Ulice a číslo',
        bankAccount: 'Bankovní účet',
        iban: 'IBAN',
        bankName: 'Název banky',
        swift: 'SWIFT kód',
        healthInsurance: 'Zdravotní pojišťovna',
        noInsuranceConfigured: 'Žádné pojišťovny nakonfigurované pro vybranou zemi',
      },
      serviceTypes: {
        cordBlood: 'Pupečníková krev',
        cordTissue: 'Pupečníková tkáň',
        both: 'Obě',
      },
      none: 'Žádná',
    },
    products: {
      title: 'Produkty',
      addProduct: 'Přidat produkt',
      editProduct: 'Upravit produkt',
      deleteProduct: 'Odstranit produkt',
      productName: 'Název produktu',
      description: 'Popis',
      price: 'Cena',
      availability: 'Dostupnost',
    },
    invoices: {
      title: 'Faktury',
      addInvoice: 'Vytvořit fakturu',
      invoiceNumber: 'Číslo faktury',
      customer: 'Zákazník',
      amount: 'Částka',
      dueDate: 'Splatnost',
      status: 'Stav',
      paid: 'Zaplacená',
      unpaid: 'Nezaplacená',
      overdue: 'Po splatnosti',
    },
    users: {
      title: 'Uživatelé',
      addUser: 'Přidat uživatele',
      editUser: 'Upravit uživatele',
      deleteUser: 'Odstranit uživatele',
      username: 'Uživatelské jméno',
      password: 'Heslo',
      role: 'Role',
      assignedCountries: 'Přiřazené země',
      roles: {
        admin: 'Administrátor',
        manager: 'Manažer',
        user: 'Uživatel',
      },
    },
    settings: {
      title: 'Nastavení',
      configuration: 'Konfigurace',
      complaintTypes: 'Typy stížností',
      cooperationTypes: 'Typy spolupráce',
      vipStatuses: 'VIP Statusy',
      healthInsurance: 'Zdravotní pojišťovny',
      billingDetails: 'Fakturační údaje',
      addNew: 'Přidat nový',
      deleteConfirm: 'Opravdu chcete odstranit tuto položku?',
      code: 'Kód',
      noItems: 'Žádné položky',
    },
    auth: {
      login: 'Přihlášení',
      logout: 'Odhlásit',
      username: 'Uživatelské jméno',
      password: 'Heslo',
      loginButton: 'Přihlásit se',
      invalidCredentials: 'Nesprávné jméno nebo heslo',
    },
    errors: {
      required: 'Toto pole je povinné',
      invalidEmail: 'Neplatná emailová adresa',
      invalidPhone: 'Neplatné telefonní číslo',
      invalidIban: 'Neplatný formát IBAN',
      saveFailed: 'Uložení selhalo',
      deleteFailed: 'Odstranění selhalo',
      loadFailed: 'Načtení dat selhalo',
    },
    success: {
      saved: 'Úspěšně uloženo',
      deleted: 'Úspěšně odstraněno',
      created: 'Úspěšně vytvořeno',
      updated: 'Úspěšně aktualizováno',
    },
  },
  hu: {
    nav: {
      dashboard: 'Irányítópult',
      customers: 'Ügyfelek',
      products: 'Termékek',
      invoices: 'Számlák',
      users: 'Felhasználók',
      settings: 'Beállítások',
      logout: 'Kijelentkezés',
    },
    common: {
      save: 'Mentés',
      cancel: 'Mégse',
      delete: 'Törlés',
      edit: 'Szerkesztés',
      add: 'Hozzáadás',
      search: 'Keresés',
      filter: 'Szűrő',
      loading: 'Betöltés...',
      noData: 'Nincs adat',
      confirm: 'Megerősítés',
      yes: 'Igen',
      no: 'Nem',
      actions: 'Műveletek',
      status: 'Állapot',
      name: 'Név',
      email: 'Email',
      phone: 'Telefon',
      country: 'Ország',
      allCountries: 'Minden ország',
      active: 'Aktív',
      inactive: 'Inaktív',
      pending: 'Függőben',
      global: 'Globális',
      required: 'Kötelező',
    },
    dashboard: {
      title: 'Irányítópult',
      totalCustomers: 'Összes ügyfél',
      activeCustomers: 'Aktív ügyfelek',
      pendingCustomers: 'Függőben lévő ügyfelek',
      totalProducts: 'Összes termék',
      recentActivity: 'Legutóbbi tevékenység',
    },
    customers: {
      title: 'Ügyfelek',
      addCustomer: 'Ügyfél hozzáadása',
      editCustomer: 'Ügyfél szerkesztése',
      deleteCustomer: 'Ügyfél törlése',
      deleteConfirm: 'Biztosan törölni szeretné ezt az ügyfelet?',
      firstName: 'Keresztnév',
      lastName: 'Vezetéknév',
      email: 'Email',
      phone: 'Telefon',
      country: 'Ország',
      status: 'Állapot',
      serviceType: 'Szolgáltatás típusa',
      address: 'Cím',
      city: 'Város',
      postalCode: 'Irányítószám',
      notes: 'Megjegyzések',
      tabs: {
        client: 'Ügyfél',
        marketing: 'Marketing',
        addresses: 'Címek',
        other: 'Egyéb',
      },
      fields: {
        title: 'Titulus',
        phone2: 'Telefon 2',
        otherContact: 'Egyéb kapcsolat',
        email2: 'Email 2',
        nationalId: 'Személyi szám',
        idCardNumber: 'Személyi igazolvány szám',
        dateOfBirth: 'Születési dátum',
        newsletter: 'Hírlevél',
        complaintType: 'Panasz típusa',
        cooperationType: 'Együttműködés típusa',
        vipStatus: 'VIP státusz',
        permanentAddress: 'Állandó lakcím',
        correspondenceAddress: 'Levelezési cím',
        sameAsPermament: 'Megegyezik az állandó lakcímmel',
        street: 'Utca és házszám',
        bankAccount: 'Bankszámla',
        iban: 'IBAN',
        bankName: 'Bank neve',
        swift: 'SWIFT kód',
        healthInsurance: 'Egészségbiztosító',
        noInsuranceConfigured: 'Nincs biztosító konfigurálva a kiválasztott országhoz',
      },
      serviceTypes: {
        cordBlood: 'Köldökzsinórvér',
        cordTissue: 'Köldökzsinór szövet',
        both: 'Mindkettő',
      },
      none: 'Nincs',
    },
    products: {
      title: 'Termékek',
      addProduct: 'Termék hozzáadása',
      editProduct: 'Termék szerkesztése',
      deleteProduct: 'Termék törlése',
      productName: 'Termék neve',
      description: 'Leírás',
      price: 'Ár',
      availability: 'Elérhetőség',
    },
    invoices: {
      title: 'Számlák',
      addInvoice: 'Számla létrehozása',
      invoiceNumber: 'Számlaszám',
      customer: 'Ügyfél',
      amount: 'Összeg',
      dueDate: 'Határidő',
      status: 'Állapot',
      paid: 'Fizetve',
      unpaid: 'Fizetetlen',
      overdue: 'Lejárt',
    },
    users: {
      title: 'Felhasználók',
      addUser: 'Felhasználó hozzáadása',
      editUser: 'Felhasználó szerkesztése',
      deleteUser: 'Felhasználó törlése',
      username: 'Felhasználónév',
      password: 'Jelszó',
      role: 'Szerepkör',
      assignedCountries: 'Hozzárendelt országok',
      roles: {
        admin: 'Adminisztrátor',
        manager: 'Menedzser',
        user: 'Felhasználó',
      },
    },
    settings: {
      title: 'Beállítások',
      configuration: 'Konfiguráció',
      complaintTypes: 'Panasz típusok',
      cooperationTypes: 'Együttműködés típusok',
      vipStatuses: 'VIP státuszok',
      healthInsurance: 'Egészségbiztosítók',
      billingDetails: 'Számlázási adatok',
      addNew: 'Új hozzáadása',
      deleteConfirm: 'Biztosan törölni szeretné ezt az elemet?',
      code: 'Kód',
      noItems: 'Nincsenek elemek',
    },
    auth: {
      login: 'Bejelentkezés',
      logout: 'Kijelentkezés',
      username: 'Felhasználónév',
      password: 'Jelszó',
      loginButton: 'Bejelentkezés',
      invalidCredentials: 'Hibás felhasználónév vagy jelszó',
    },
    errors: {
      required: 'Ez a mező kötelező',
      invalidEmail: 'Érvénytelen email cím',
      invalidPhone: 'Érvénytelen telefonszám',
      invalidIban: 'Érvénytelen IBAN formátum',
      saveFailed: 'Mentés sikertelen',
      deleteFailed: 'Törlés sikertelen',
      loadFailed: 'Adatok betöltése sikertelen',
    },
    success: {
      saved: 'Sikeresen mentve',
      deleted: 'Sikeresen törölve',
      created: 'Sikeresen létrehozva',
      updated: 'Sikeresen frissítve',
    },
  },
  ro: {
    nav: {
      dashboard: 'Panou de control',
      customers: 'Clienți',
      products: 'Produse',
      invoices: 'Facturi',
      users: 'Utilizatori',
      settings: 'Setări',
      logout: 'Deconectare',
    },
    common: {
      save: 'Salvare',
      cancel: 'Anulare',
      delete: 'Ștergere',
      edit: 'Editare',
      add: 'Adaugă',
      search: 'Căutare',
      filter: 'Filtru',
      loading: 'Se încarcă...',
      noData: 'Nu există date',
      confirm: 'Confirmare',
      yes: 'Da',
      no: 'Nu',
      actions: 'Acțiuni',
      status: 'Status',
      name: 'Nume',
      email: 'Email',
      phone: 'Telefon',
      country: 'Țară',
      allCountries: 'Toate țările',
      active: 'Activ',
      inactive: 'Inactiv',
      pending: 'În așteptare',
      global: 'Global',
      required: 'Obligatoriu',
    },
    dashboard: {
      title: 'Panou de control',
      totalCustomers: 'Total clienți',
      activeCustomers: 'Clienți activi',
      pendingCustomers: 'Clienți în așteptare',
      totalProducts: 'Total produse',
      recentActivity: 'Activitate recentă',
    },
    customers: {
      title: 'Clienți',
      addCustomer: 'Adaugă client',
      editCustomer: 'Editează client',
      deleteCustomer: 'Șterge client',
      deleteConfirm: 'Sigur doriți să ștergeți acest client?',
      firstName: 'Prenume',
      lastName: 'Nume',
      email: 'Email',
      phone: 'Telefon',
      country: 'Țară',
      status: 'Status',
      serviceType: 'Tip serviciu',
      address: 'Adresă',
      city: 'Oraș',
      postalCode: 'Cod poștal',
      notes: 'Note',
      tabs: {
        client: 'Client',
        marketing: 'Marketing',
        addresses: 'Adrese',
        other: 'Altele',
      },
      fields: {
        title: 'Titlu',
        phone2: 'Telefon 2',
        otherContact: 'Alt contact',
        email2: 'Email 2',
        nationalId: 'CNP',
        idCardNumber: 'Număr CI',
        dateOfBirth: 'Data nașterii',
        newsletter: 'Newsletter',
        complaintType: 'Tip reclamație',
        cooperationType: 'Tip cooperare',
        vipStatus: 'Status VIP',
        permanentAddress: 'Adresă permanentă',
        correspondenceAddress: 'Adresă de corespondență',
        sameAsPermament: 'Aceeași cu adresa permanentă',
        street: 'Strada și numărul',
        bankAccount: 'Cont bancar',
        iban: 'IBAN',
        bankName: 'Numele băncii',
        swift: 'Cod SWIFT',
        healthInsurance: 'Asigurare de sănătate',
        noInsuranceConfigured: 'Nu există asigurări configurate pentru țara selectată',
      },
      serviceTypes: {
        cordBlood: 'Sânge din cordon',
        cordTissue: 'Țesut din cordon',
        both: 'Ambele',
      },
      none: 'Niciunul',
    },
    products: {
      title: 'Produse',
      addProduct: 'Adaugă produs',
      editProduct: 'Editează produs',
      deleteProduct: 'Șterge produs',
      productName: 'Nume produs',
      description: 'Descriere',
      price: 'Preț',
      availability: 'Disponibilitate',
    },
    invoices: {
      title: 'Facturi',
      addInvoice: 'Creează factură',
      invoiceNumber: 'Număr factură',
      customer: 'Client',
      amount: 'Sumă',
      dueDate: 'Termen de plată',
      status: 'Status',
      paid: 'Plătită',
      unpaid: 'Neplătită',
      overdue: 'Întârziată',
    },
    users: {
      title: 'Utilizatori',
      addUser: 'Adaugă utilizator',
      editUser: 'Editează utilizator',
      deleteUser: 'Șterge utilizator',
      username: 'Nume utilizator',
      password: 'Parolă',
      role: 'Rol',
      assignedCountries: 'Țări alocate',
      roles: {
        admin: 'Administrator',
        manager: 'Manager',
        user: 'Utilizator',
      },
    },
    settings: {
      title: 'Setări',
      configuration: 'Configurare',
      complaintTypes: 'Tipuri de reclamații',
      cooperationTypes: 'Tipuri de cooperare',
      vipStatuses: 'Statusuri VIP',
      healthInsurance: 'Asigurări de sănătate',
      billingDetails: 'Detalii facturare',
      addNew: 'Adaugă nou',
      deleteConfirm: 'Sigur doriți să ștergeți acest element?',
      code: 'Cod',
      noItems: 'Nu există elemente',
    },
    auth: {
      login: 'Autentificare',
      logout: 'Deconectare',
      username: 'Nume utilizator',
      password: 'Parolă',
      loginButton: 'Conectare',
      invalidCredentials: 'Nume de utilizator sau parolă incorectă',
    },
    errors: {
      required: 'Acest câmp este obligatoriu',
      invalidEmail: 'Adresă de email invalidă',
      invalidPhone: 'Număr de telefon invalid',
      invalidIban: 'Format IBAN invalid',
      saveFailed: 'Salvarea a eșuat',
      deleteFailed: 'Ștergerea a eșuat',
      loadFailed: 'Încărcarea datelor a eșuat',
    },
    success: {
      saved: 'Salvat cu succes',
      deleted: 'Șters cu succes',
      created: 'Creat cu succes',
      updated: 'Actualizat cu succes',
    },
  },
  it: {
    nav: {
      dashboard: 'Dashboard',
      customers: 'Clienti',
      products: 'Prodotti',
      invoices: 'Fatture',
      users: 'Utenti',
      settings: 'Impostazioni',
      logout: 'Esci',
    },
    common: {
      save: 'Salva',
      cancel: 'Annulla',
      delete: 'Elimina',
      edit: 'Modifica',
      add: 'Aggiungi',
      search: 'Cerca',
      filter: 'Filtro',
      loading: 'Caricamento...',
      noData: 'Nessun dato disponibile',
      confirm: 'Conferma',
      yes: 'Sì',
      no: 'No',
      actions: 'Azioni',
      status: 'Stato',
      name: 'Nome',
      email: 'Email',
      phone: 'Telefono',
      country: 'Paese',
      allCountries: 'Tutti i paesi',
      active: 'Attivo',
      inactive: 'Inattivo',
      pending: 'In attesa',
      global: 'Globale',
      required: 'Obbligatorio',
    },
    dashboard: {
      title: 'Dashboard',
      totalCustomers: 'Clienti totali',
      activeCustomers: 'Clienti attivi',
      pendingCustomers: 'Clienti in attesa',
      totalProducts: 'Prodotti totali',
      recentActivity: 'Attività recente',
    },
    customers: {
      title: 'Clienti',
      addCustomer: 'Aggiungi cliente',
      editCustomer: 'Modifica cliente',
      deleteCustomer: 'Elimina cliente',
      deleteConfirm: 'Sei sicuro di voler eliminare questo cliente?',
      firstName: 'Nome',
      lastName: 'Cognome',
      email: 'Email',
      phone: 'Telefono',
      country: 'Paese',
      status: 'Stato',
      serviceType: 'Tipo di servizio',
      address: 'Indirizzo',
      city: 'Città',
      postalCode: 'CAP',
      notes: 'Note',
      tabs: {
        client: 'Cliente',
        marketing: 'Marketing',
        addresses: 'Indirizzi',
        other: 'Altro',
      },
      fields: {
        title: 'Titolo',
        phone2: 'Telefono 2',
        otherContact: 'Altro contatto',
        email2: 'Email 2',
        nationalId: 'Codice fiscale',
        idCardNumber: 'Numero carta d\'identità',
        dateOfBirth: 'Data di nascita',
        newsletter: 'Newsletter',
        complaintType: 'Tipo di reclamo',
        cooperationType: 'Tipo di cooperazione',
        vipStatus: 'Stato VIP',
        permanentAddress: 'Indirizzo permanente',
        correspondenceAddress: 'Indirizzo di corrispondenza',
        sameAsPermament: 'Uguale all\'indirizzo permanente',
        street: 'Via e numero',
        bankAccount: 'Conto bancario',
        iban: 'IBAN',
        bankName: 'Nome banca',
        swift: 'Codice SWIFT',
        healthInsurance: 'Assicurazione sanitaria',
        noInsuranceConfigured: 'Nessuna assicurazione configurata per il paese selezionato',
      },
      serviceTypes: {
        cordBlood: 'Sangue cordonale',
        cordTissue: 'Tessuto cordonale',
        both: 'Entrambi',
      },
      none: 'Nessuno',
    },
    products: {
      title: 'Prodotti',
      addProduct: 'Aggiungi prodotto',
      editProduct: 'Modifica prodotto',
      deleteProduct: 'Elimina prodotto',
      productName: 'Nome prodotto',
      description: 'Descrizione',
      price: 'Prezzo',
      availability: 'Disponibilità',
    },
    invoices: {
      title: 'Fatture',
      addInvoice: 'Crea fattura',
      invoiceNumber: 'Numero fattura',
      customer: 'Cliente',
      amount: 'Importo',
      dueDate: 'Scadenza',
      status: 'Stato',
      paid: 'Pagata',
      unpaid: 'Non pagata',
      overdue: 'Scaduta',
    },
    users: {
      title: 'Utenti',
      addUser: 'Aggiungi utente',
      editUser: 'Modifica utente',
      deleteUser: 'Elimina utente',
      username: 'Nome utente',
      password: 'Password',
      role: 'Ruolo',
      assignedCountries: 'Paesi assegnati',
      roles: {
        admin: 'Amministratore',
        manager: 'Manager',
        user: 'Utente',
      },
    },
    settings: {
      title: 'Impostazioni',
      configuration: 'Configurazione',
      complaintTypes: 'Tipi di reclamo',
      cooperationTypes: 'Tipi di cooperazione',
      vipStatuses: 'Stati VIP',
      healthInsurance: 'Assicurazioni sanitarie',
      billingDetails: 'Dettagli fatturazione',
      addNew: 'Aggiungi nuovo',
      deleteConfirm: 'Sei sicuro di voler eliminare questo elemento?',
      code: 'Codice',
      noItems: 'Nessun elemento',
    },
    auth: {
      login: 'Accesso',
      logout: 'Esci',
      username: 'Nome utente',
      password: 'Password',
      loginButton: 'Accedi',
      invalidCredentials: 'Nome utente o password non validi',
    },
    errors: {
      required: 'Questo campo è obbligatorio',
      invalidEmail: 'Indirizzo email non valido',
      invalidPhone: 'Numero di telefono non valido',
      invalidIban: 'Formato IBAN non valido',
      saveFailed: 'Salvataggio fallito',
      deleteFailed: 'Eliminazione fallita',
      loadFailed: 'Caricamento dati fallito',
    },
    success: {
      saved: 'Salvato con successo',
      deleted: 'Eliminato con successo',
      created: 'Creato con successo',
      updated: 'Aggiornato con successo',
    },
  },
  de: {
    nav: {
      dashboard: 'Dashboard',
      customers: 'Kunden',
      products: 'Produkte',
      invoices: 'Rechnungen',
      users: 'Benutzer',
      settings: 'Einstellungen',
      logout: 'Abmelden',
    },
    common: {
      save: 'Speichern',
      cancel: 'Abbrechen',
      delete: 'Löschen',
      edit: 'Bearbeiten',
      add: 'Hinzufügen',
      search: 'Suchen',
      filter: 'Filter',
      loading: 'Laden...',
      noData: 'Keine Daten verfügbar',
      confirm: 'Bestätigen',
      yes: 'Ja',
      no: 'Nein',
      actions: 'Aktionen',
      status: 'Status',
      name: 'Name',
      email: 'E-Mail',
      phone: 'Telefon',
      country: 'Land',
      allCountries: 'Alle Länder',
      active: 'Aktiv',
      inactive: 'Inaktiv',
      pending: 'Ausstehend',
      global: 'Global',
      required: 'Erforderlich',
    },
    dashboard: {
      title: 'Dashboard',
      totalCustomers: 'Gesamtkunden',
      activeCustomers: 'Aktive Kunden',
      pendingCustomers: 'Ausstehende Kunden',
      totalProducts: 'Gesamtprodukte',
      recentActivity: 'Letzte Aktivität',
    },
    customers: {
      title: 'Kunden',
      addCustomer: 'Kunde hinzufügen',
      editCustomer: 'Kunde bearbeiten',
      deleteCustomer: 'Kunde löschen',
      deleteConfirm: 'Sind Sie sicher, dass Sie diesen Kunden löschen möchten?',
      firstName: 'Vorname',
      lastName: 'Nachname',
      email: 'E-Mail',
      phone: 'Telefon',
      country: 'Land',
      status: 'Status',
      serviceType: 'Dienstleistungsart',
      address: 'Adresse',
      city: 'Stadt',
      postalCode: 'PLZ',
      notes: 'Notizen',
      tabs: {
        client: 'Kunde',
        marketing: 'Marketing',
        addresses: 'Adressen',
        other: 'Sonstiges',
      },
      fields: {
        title: 'Titel',
        phone2: 'Telefon 2',
        otherContact: 'Anderer Kontakt',
        email2: 'E-Mail 2',
        nationalId: 'Personalausweisnummer',
        idCardNumber: 'Ausweisnummer',
        dateOfBirth: 'Geburtsdatum',
        newsletter: 'Newsletter',
        complaintType: 'Beschwerdetyp',
        cooperationType: 'Kooperationstyp',
        vipStatus: 'VIP-Status',
        permanentAddress: 'Ständige Adresse',
        correspondenceAddress: 'Korrespondenzadresse',
        sameAsPermament: 'Gleich wie ständige Adresse',
        street: 'Straße und Hausnummer',
        bankAccount: 'Bankkonto',
        iban: 'IBAN',
        bankName: 'Bankname',
        swift: 'SWIFT-Code',
        healthInsurance: 'Krankenversicherung',
        noInsuranceConfigured: 'Keine Versicherung für das ausgewählte Land konfiguriert',
      },
      serviceTypes: {
        cordBlood: 'Nabelschnurblut',
        cordTissue: 'Nabelschnurgewebe',
        both: 'Beides',
      },
      none: 'Keine',
    },
    products: {
      title: 'Produkte',
      addProduct: 'Produkt hinzufügen',
      editProduct: 'Produkt bearbeiten',
      deleteProduct: 'Produkt löschen',
      productName: 'Produktname',
      description: 'Beschreibung',
      price: 'Preis',
      availability: 'Verfügbarkeit',
    },
    invoices: {
      title: 'Rechnungen',
      addInvoice: 'Rechnung erstellen',
      invoiceNumber: 'Rechnungsnummer',
      customer: 'Kunde',
      amount: 'Betrag',
      dueDate: 'Fälligkeitsdatum',
      status: 'Status',
      paid: 'Bezahlt',
      unpaid: 'Unbezahlt',
      overdue: 'Überfällig',
    },
    users: {
      title: 'Benutzer',
      addUser: 'Benutzer hinzufügen',
      editUser: 'Benutzer bearbeiten',
      deleteUser: 'Benutzer löschen',
      username: 'Benutzername',
      password: 'Passwort',
      role: 'Rolle',
      assignedCountries: 'Zugewiesene Länder',
      roles: {
        admin: 'Administrator',
        manager: 'Manager',
        user: 'Benutzer',
      },
    },
    settings: {
      title: 'Einstellungen',
      configuration: 'Konfiguration',
      complaintTypes: 'Beschwerdetypen',
      cooperationTypes: 'Kooperationstypen',
      vipStatuses: 'VIP-Status',
      healthInsurance: 'Krankenversicherungen',
      billingDetails: 'Rechnungsdetails',
      addNew: 'Neu hinzufügen',
      deleteConfirm: 'Sind Sie sicher, dass Sie dieses Element löschen möchten?',
      code: 'Code',
      noItems: 'Keine Elemente',
    },
    auth: {
      login: 'Anmeldung',
      logout: 'Abmelden',
      username: 'Benutzername',
      password: 'Passwort',
      loginButton: 'Anmelden',
      invalidCredentials: 'Ungültiger Benutzername oder Passwort',
    },
    errors: {
      required: 'Dieses Feld ist erforderlich',
      invalidEmail: 'Ungültige E-Mail-Adresse',
      invalidPhone: 'Ungültige Telefonnummer',
      invalidIban: 'Ungültiges IBAN-Format',
      saveFailed: 'Speichern fehlgeschlagen',
      deleteFailed: 'Löschen fehlgeschlagen',
      loadFailed: 'Daten laden fehlgeschlagen',
    },
    success: {
      saved: 'Erfolgreich gespeichert',
      deleted: 'Erfolgreich gelöscht',
      created: 'Erfolgreich erstellt',
      updated: 'Erfolgreich aktualisiert',
    },
  },
};
