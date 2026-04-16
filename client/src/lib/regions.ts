export const REGIONS_BY_COUNTRY: Record<string, string[]> = {
  SK: [
    "Bratislavský kraj",
    "Trnavský kraj",
    "Trenčiansky kraj",
    "Nitriansky kraj",
    "Žilinský kraj",
    "Banskobystrický kraj",
    "Prešovský kraj",
    "Košický kraj",
  ],
  CZ: [
    "Hlavní město Praha",
    "Středočeský kraj",
    "Jihočeský kraj",
    "Plzeňský kraj",
    "Karlovarský kraj",
    "Ústecký kraj",
    "Liberecký kraj",
    "Královéhradecký kraj",
    "Pardubický kraj",
    "Kraj Vysočina",
    "Jihomoravský kraj",
    "Olomoucký kraj",
    "Moravskoslezský kraj",
    "Zlínský kraj",
  ],
  HU: [
    "Budapest",
    "Baranya megye",
    "Bács-Kiskun megye",
    "Békés megye",
    "Borsod-Abaúj-Zemplén megye",
    "Csongrád-Csanád megye",
    "Fejér megye",
    "Győr-Moson-Sopron megye",
    "Hajdú-Bihar megye",
    "Heves megye",
    "Jász-Nagykun-Szolnok megye",
    "Komárom-Esztergom megye",
    "Nógrád megye",
    "Pest megye",
    "Somogy megye",
    "Szabolcs-Szatmár-Bereg megye",
    "Tolna megye",
    "Vas megye",
    "Veszprém megye",
    "Zala megye",
  ],
  RO: [
    "București",
    "Alba",
    "Arad",
    "Argeș",
    "Bacău",
    "Bihor",
    "Bistrița-Năsăud",
    "Botoșani",
    "Brașov",
    "Brăila",
    "Buzău",
    "Caraș-Severin",
    "Călărași",
    "Cluj",
    "Constanța",
    "Covasna",
    "Dâmbovița",
    "Dolj",
    "Galați",
    "Giurgiu",
    "Gorj",
    "Harghita",
    "Hunedoara",
    "Ialomița",
    "Iași",
    "Ilfov",
    "Maramureș",
    "Mehedinți",
    "Mureș",
    "Neamț",
    "Olt",
    "Prahova",
    "Satu Mare",
    "Sălaj",
    "Sibiu",
    "Suceava",
    "Teleorman",
    "Timiș",
    "Tulcea",
    "Vaslui",
    "Vâlcea",
    "Vrancea",
  ],
  IT: [
    "Abruzzo",
    "Basilicata",
    "Calabria",
    "Campania",
    "Emilia-Romagna",
    "Friuli Venezia Giulia",
    "Lazio",
    "Liguria",
    "Lombardia",
    "Marche",
    "Molise",
    "Piemonte",
    "Puglia",
    "Sardegna",
    "Sicilia",
    "Toscana",
    "Trentino-Alto Adige",
    "Umbria",
    "Valle d'Aosta",
    "Veneto",
  ],
  DE: [
    "Baden-Württemberg",
    "Bayern",
    "Berlin",
    "Brandenburg",
    "Bremen",
    "Hamburg",
    "Hessen",
    "Mecklenburg-Vorpommern",
    "Niedersachsen",
    "Nordrhein-Westfalen",
    "Rheinland-Pfalz",
    "Saarland",
    "Sachsen",
    "Sachsen-Anhalt",
    "Schleswig-Holstein",
    "Thüringen",
  ],
};

export const REGION_MAP: Record<string, Record<string, string>> = {
  SK: {
    "Bratislava": "Bratislavský kraj", "Pezinok": "Bratislavský kraj", "Senec": "Bratislavský kraj", "Malacky": "Bratislavský kraj",
    "Trnava": "Trnavský kraj", "Piešťany": "Trnavský kraj", "Dunajská Streda": "Trnavský kraj", "Galanta": "Trnavský kraj", "Hlohovec": "Trnavský kraj", "Senica": "Trnavský kraj", "Skalica": "Trnavský kraj",
    "Trenčín": "Trenčiansky kraj", "Považská Bystrica": "Trenčiansky kraj", "Púchov": "Trenčiansky kraj", "Prievidza": "Trenčiansky kraj", "Nové Mesto nad Váhom": "Trenčiansky kraj", "Partizánske": "Trenčiansky kraj", "Bánovce nad Bebravou": "Trenčiansky kraj", "Ilava": "Trenčiansky kraj", "Myjava": "Trenčiansky kraj",
    "Nitra": "Nitriansky kraj", "Komárno": "Nitriansky kraj", "Levice": "Nitriansky kraj", "Nové Zámky": "Nitriansky kraj", "Šaľa": "Nitriansky kraj", "Topoľčany": "Nitriansky kraj", "Zlaté Moravce": "Nitriansky kraj",
    "Žilina": "Žilinský kraj", "Martin": "Žilinský kraj", "Čadca": "Žilinský kraj", "Dolný Kubín": "Žilinský kraj", "Liptovský Mikuláš": "Žilinský kraj", "Námestovo": "Žilinský kraj", "Ružomberok": "Žilinský kraj", "Tvrdošín": "Žilinský kraj", "Turčianske Teplice": "Žilinský kraj", "Bytča": "Žilinský kraj", "Kysucké Nové Mesto": "Žilinský kraj",
    "Banská Bystrica": "Banskobystrický kraj", "Zvolen": "Banskobystrický kraj", "Lučenec": "Banskobystrický kraj", "Rimavská Sobota": "Banskobystrický kraj", "Žiar nad Hronom": "Banskobystrický kraj", "Brezno": "Banskobystrický kraj", "Detva": "Banskobystrický kraj", "Krupina": "Banskobystrický kraj", "Revúca": "Banskobystrický kraj", "Veľký Krtíš": "Banskobystrický kraj", "Banská Štiavnica": "Banskobystrický kraj", "Poltár": "Banskobystrický kraj",
    "Prešov": "Prešovský kraj", "Poprad": "Prešovský kraj", "Bardejov": "Prešovský kraj", "Humenné": "Prešovský kraj", "Kežmarok": "Prešovský kraj", "Levoča": "Prešovský kraj", "Medzilaborce": "Prešovský kraj", "Sabinov": "Prešovský kraj", "Snina": "Prešovský kraj", "Stará Ľubovňa": "Prešovský kraj", "Stropkov": "Prešovský kraj", "Svidník": "Prešovský kraj", "Vranov nad Topľou": "Prešovský kraj", "Svit": "Prešovský kraj", "Vysoké Tatry": "Prešovský kraj", "Starý Smokovec": "Prešovský kraj",
    "Košice": "Košický kraj", "Michalovce": "Košický kraj", "Spišská Nová Ves": "Košický kraj", "Trebišov": "Košický kraj", "Rožňava": "Košický kraj", "Gelnica": "Košický kraj", "Sobrance": "Košický kraj", "Moldava nad Bodvou": "Košický kraj",
  },
  CZ: {
    "Praha": "Hlavní město Praha", "Brno": "Jihomoravský kraj", "Ostrava": "Moravskoslezský kraj", "Plzeň": "Plzeňský kraj",
    "Liberec": "Liberecký kraj", "Olomouc": "Olomoucký kraj", "České Budějovice": "Jihočeský kraj", "Hradec Králové": "Královéhradecký kraj",
    "Ústí nad Labem": "Ústecký kraj", "Pardubice": "Pardubický kraj", "Zlín": "Zlínský kraj", "Jihlava": "Kraj Vysočina",
    "Karlovy Vary": "Karlovarský kraj", "Kladno": "Středočeský kraj",
  },
  HU: {
    "Budapest": "Budapest", "Debrecen": "Hajdú-Bihar megye", "Szeged": "Csongrád-Csanád megye", "Miskolc": "Borsod-Abaúj-Zemplén megye",
    "Pécs": "Baranya megye", "Győr": "Győr-Moson-Sopron megye", "Nyíregyháza": "Szabolcs-Szatmár-Bereg megye",
    "Kecskemét": "Bács-Kiskun megye", "Székesfehérvár": "Fejér megye", "Szombathely": "Vas megye", "Szolnok": "Jász-Nagykun-Szolnok megye",
    "Eger": "Heves megye", "Tatabánya": "Komárom-Esztergom megye", "Veszprém": "Veszprém megye", "Kaposvár": "Somogy megye",
    "Zalaegerszeg": "Zala megye", "Salgótarján": "Nógrád megye", "Szekszárd": "Tolna megye", "Békéscsaba": "Békés megye",
  },
  RO: {
    "București": "București", "Cluj-Napoca": "Cluj", "Timișoara": "Timiș", "Iași": "Iași", "Constanța": "Constanța",
    "Craiova": "Dolj", "Brașov": "Brașov", "Galați": "Galați", "Ploiești": "Prahova", "Oradea": "Bihor",
    "Brăila": "Brăila", "Arad": "Arad", "Pitești": "Argeș", "Sibiu": "Sibiu", "Bacău": "Bacău",
    "Târgu Mureș": "Mureș", "Baia Mare": "Maramureș", "Buzău": "Buzău", "Botoșani": "Botoșani", "Satu Mare": "Satu Mare",
    "Suceava": "Suceava", "Alba Iulia": "Alba", "Deva": "Hunedoara", "Bistrița": "Bistrița-Năsăud",
  },
  IT: {
    "Roma": "Lazio", "Milano": "Lombardia", "Napoli": "Campania", "Torino": "Piemonte", "Palermo": "Sicilia",
    "Genova": "Liguria", "Bologna": "Emilia-Romagna", "Firenze": "Toscana", "Bari": "Puglia", "Catania": "Sicilia",
    "Venezia": "Veneto", "Verona": "Veneto", "Messina": "Sicilia", "Padova": "Veneto", "Trieste": "Friuli Venezia Giulia",
    "Brescia": "Lombardia", "Parma": "Emilia-Romagna", "Taranto": "Puglia", "Modena": "Emilia-Romagna", "Reggio Calabria": "Calabria",
    "Perugia": "Umbria", "Cagliari": "Sardegna", "Ancona": "Marche", "L'Aquila": "Abruzzo", "Campobasso": "Molise",
    "Potenza": "Basilicata", "Trento": "Trentino-Alto Adige", "Aosta": "Valle d'Aosta",
  },
  DE: {
    "Berlin": "Berlin", "Hamburg": "Hamburg", "München": "Bayern", "Köln": "Nordrhein-Westfalen", "Frankfurt": "Hessen",
    "Stuttgart": "Baden-Württemberg", "Düsseldorf": "Nordrhein-Westfalen", "Leipzig": "Sachsen", "Dortmund": "Nordrhein-Westfalen",
    "Essen": "Nordrhein-Westfalen", "Bremen": "Bremen", "Dresden": "Sachsen", "Hannover": "Niedersachsen",
    "Nürnberg": "Bayern", "Duisburg": "Nordrhein-Westfalen", "Bochum": "Nordrhein-Westfalen", "Wuppertal": "Nordrhein-Westfalen",
    "Bielefeld": "Nordrhein-Westfalen", "Bonn": "Nordrhein-Westfalen", "Münster": "Nordrhein-Westfalen",
    "Mannheim": "Baden-Württemberg", "Karlsruhe": "Baden-Württemberg", "Augsburg": "Bayern", "Wiesbaden": "Hessen",
    "Mainz": "Rheinland-Pfalz", "Kiel": "Schleswig-Holstein", "Magdeburg": "Sachsen-Anhalt", "Erfurt": "Thüringen",
    "Schwerin": "Mecklenburg-Vorpommern", "Potsdam": "Brandenburg", "Saarbrücken": "Saarland",
  },
};

export const DISTRICTS_BY_REGION: Record<string, Record<string, string[]>> = {
  SK: {
    "Bratislavský kraj": ["Bratislava I", "Bratislava II", "Bratislava III", "Bratislava IV", "Bratislava V", "Malacky", "Pezinok", "Senec"],
    "Trnavský kraj": ["Dunajská Streda", "Galanta", "Hlohovec", "Piešťany", "Senica", "Skalica", "Trnava"],
    "Trenčiansky kraj": ["Bánovce nad Bebravou", "Ilava", "Myjava", "Nové Mesto nad Váhom", "Partizánske", "Považská Bystrica", "Prievidza", "Púchov", "Trenčín"],
    "Nitriansky kraj": ["Komárno", "Levice", "Nitra", "Nové Zámky", "Šaľa", "Topoľčany", "Zlaté Moravce"],
    "Žilinský kraj": ["Bytča", "Čadca", "Dolný Kubín", "Kysucké Nové Mesto", "Liptovský Mikuláš", "Martin", "Námestovo", "Ružomberok", "Turčianske Teplice", "Tvrdošín", "Žilina"],
    "Banskobystrický kraj": ["Banská Bystrica", "Banská Štiavnica", "Brezno", "Detva", "Krupina", "Lučenec", "Poltár", "Revúca", "Rimavská Sobota", "Veľký Krtíš", "Zvolen", "Žiar nad Hronom"],
    "Prešovský kraj": ["Bardejov", "Humenné", "Kežmarok", "Levoča", "Medzilaborce", "Poprad", "Prešov", "Sabinov", "Snina", "Stará Ľubovňa", "Stropkov", "Svidník", "Vranov nad Topľou"],
    "Košický kraj": ["Gelnica", "Košice I", "Košice II", "Košice III", "Košice IV", "Košice-okolie", "Michalovce", "Rožňava", "Sobrance", "Spišská Nová Ves", "Trebišov"],
  },
  CZ: {
    "Hlavní město Praha": ["Praha"],
    "Středočeský kraj": ["Benešov", "Beroun", "Kladno", "Kolín", "Kutná Hora", "Mělník", "Mladá Boleslav", "Nymburk", "Praha-východ", "Praha-západ", "Příbram", "Rakovník"],
    "Jihočeský kraj": ["České Budějovice", "Český Krumlov", "Jindřichův Hradec", "Písek", "Prachatice", "Strakonice", "Tábor"],
    "Plzeňský kraj": ["Domažlice", "Klatovy", "Plzeň-město", "Plzeň-jih", "Plzeň-sever", "Rokycany", "Tachov"],
    "Karlovarský kraj": ["Cheb", "Karlovy Vary", "Sokolov"],
    "Ústecký kraj": ["Děčín", "Chomutov", "Litoměřice", "Louny", "Most", "Teplice", "Ústí nad Labem"],
    "Liberecký kraj": ["Česká Lípa", "Jablonec nad Nisou", "Liberec", "Semily"],
    "Královéhradecký kraj": ["Hradec Králové", "Jičín", "Náchod", "Rychnov nad Kněžnou", "Trutnov"],
    "Pardubický kraj": ["Chrudim", "Pardubice", "Svitavy", "Ústí nad Orlicí"],
    "Kraj Vysočina": ["Havlíčkův Brod", "Jihlava", "Pelhřimov", "Třebíč", "Žďár nad Sázavou"],
    "Jihomoravský kraj": ["Blansko", "Brno-město", "Brno-venkov", "Břeclav", "Hodonín", "Vyškov", "Znojmo"],
    "Olomoucký kraj": ["Jeseník", "Olomouc", "Prostějov", "Přerov", "Šumperk"],
    "Moravskoslezský kraj": ["Bruntál", "Frýdek-Místek", "Karviná", "Nový Jičín", "Opava", "Ostrava-město"],
    "Zlínský kraj": ["Kroměříž", "Uherské Hradiště", "Vsetín", "Zlín"],
  },
  HU: {
    "Budapest": ["Budapest"],
    "Baranya megye": ["Pécs", "Komló", "Mohács", "Siklós", "Szigetvár"],
    "Bács-Kiskun megye": ["Kecskemét", "Baja", "Kalocsa", "Kiskunfélegyháza", "Kiskunhalas"],
    "Békés megye": ["Békéscsaba", "Gyula", "Orosháza", "Szarvas"],
    "Borsod-Abaúj-Zemplén megye": ["Miskolc", "Kazincbarcika", "Ózd", "Tiszaújváros", "Sárospatak"],
    "Csongrád-Csanád megye": ["Szeged", "Hódmezővásárhely", "Makó", "Szentes"],
    "Fejér megye": ["Székesfehérvár", "Dunaújváros", "Mór"],
    "Győr-Moson-Sopron megye": ["Győr", "Sopron", "Mosonmagyaróvár", "Csorna"],
    "Hajdú-Bihar megye": ["Debrecen", "Hajdúböszörmény", "Hajdúszoboszló", "Balmazújváros"],
    "Heves megye": ["Eger", "Gyöngyös", "Hatvan"],
    "Jász-Nagykun-Szolnok megye": ["Szolnok", "Jászberény", "Karcag", "Mezőtúr"],
    "Komárom-Esztergom megye": ["Tatabánya", "Esztergom", "Komárom", "Oroszlány"],
    "Nógrád megye": ["Salgótarján", "Balassagyarmat", "Pásztó"],
    "Pest megye": ["Budapest-agglomeráció", "Érd", "Gödöllő", "Szentendre", "Vác", "Cegléd", "Nagykőrös"],
    "Somogy megye": ["Kaposvár", "Siófok", "Marcali"],
    "Szabolcs-Szatmár-Bereg megye": ["Nyíregyháza", "Kisvárda", "Mátészalka", "Fehérgyarmat"],
    "Tolna megye": ["Szekszárd", "Dombóvár", "Paks", "Bonyhád"],
    "Vas megye": ["Szombathely", "Kőszeg", "Sárvár", "Celldömölk"],
    "Veszprém megye": ["Veszprém", "Ajka", "Pápa", "Balatonfüred"],
    "Zala megye": ["Zalaegerszeg", "Nagykanizsa", "Keszthely", "Lenti"],
  },
};

export const DISTRICT_MAP: Record<string, Record<string, string>> = {
  SK: {
    "Bratislava": "Bratislava I", "Pezinok": "Pezinok", "Senec": "Senec", "Malacky": "Malacky",
    "Trnava": "Trnava", "Piešťany": "Piešťany", "Dunajská Streda": "Dunajská Streda", "Galanta": "Galanta", "Hlohovec": "Hlohovec", "Senica": "Senica", "Skalica": "Skalica",
    "Trenčín": "Trenčín", "Považská Bystrica": "Považská Bystrica", "Púchov": "Púchov", "Prievidza": "Prievidza", "Nové Mesto nad Váhom": "Nové Mesto nad Váhom", "Partizánske": "Partizánske", "Bánovce nad Bebravou": "Bánovce nad Bebravou", "Ilava": "Ilava", "Myjava": "Myjava",
    "Nitra": "Nitra", "Komárno": "Komárno", "Levice": "Levice", "Nové Zámky": "Nové Zámky", "Šaľa": "Šaľa", "Topoľčany": "Topoľčany", "Zlaté Moravce": "Zlaté Moravce",
    "Žilina": "Žilina", "Martin": "Martin", "Čadca": "Čadca", "Dolný Kubín": "Dolný Kubín", "Liptovský Mikuláš": "Liptovský Mikuláš", "Námestovo": "Námestovo", "Ružomberok": "Ružomberok", "Tvrdošín": "Tvrdošín", "Turčianske Teplice": "Turčianske Teplice", "Bytča": "Bytča", "Kysucké Nové Mesto": "Kysucké Nové Mesto",
    "Banská Bystrica": "Banská Bystrica", "Zvolen": "Zvolen", "Lučenec": "Lučenec", "Rimavská Sobota": "Rimavská Sobota", "Žiar nad Hronom": "Žiar nad Hronom", "Brezno": "Brezno", "Detva": "Detva", "Krupina": "Krupina", "Revúca": "Revúca", "Veľký Krtíš": "Veľký Krtíš", "Banská Štiavnica": "Banská Štiavnica", "Poltár": "Poltár",
    "Prešov": "Prešov", "Poprad": "Poprad", "Bardejov": "Bardejov", "Humenné": "Humenné", "Kežmarok": "Kežmarok", "Levoča": "Levoča", "Medzilaborce": "Medzilaborce", "Sabinov": "Sabinov", "Snina": "Snina", "Stará Ľubovňa": "Stará Ľubovňa", "Stropkov": "Stropkov", "Svidník": "Svidník", "Vranov nad Topľou": "Vranov nad Topľou",
    "Košice": "Košice I", "Michalovce": "Michalovce", "Spišská Nová Ves": "Spišská Nová Ves", "Trebišov": "Trebišov", "Rožňava": "Rožňava", "Gelnica": "Gelnica", "Sobrance": "Sobrance", "Moldava nad Bodvou": "Košice-okolie",
  },
  CZ: {
    "Praha": "Praha", "Brno": "Brno-město", "Ostrava": "Ostrava-město", "Plzeň": "Plzeň-město",
    "Liberec": "Liberec", "Olomouc": "Olomouc", "České Budějovice": "České Budějovice", "Hradec Králové": "Hradec Králové",
    "Ústí nad Labem": "Ústí nad Labem", "Pardubice": "Pardubice", "Zlín": "Zlín", "Jihlava": "Jihlava",
    "Karlovy Vary": "Karlovy Vary", "Kladno": "Kladno",
  },
  HU: {
    "Budapest": "Budapest", "Debrecen": "Debrecen", "Szeged": "Szeged", "Miskolc": "Miskolc",
    "Pécs": "Pécs", "Győr": "Győr", "Nyíregyháza": "Nyíregyháza", "Kecskemét": "Kecskemét",
    "Székesfehérvár": "Székesfehérvár", "Szombathely": "Szombathely", "Szolnok": "Szolnok",
    "Eger": "Eger", "Tatabánya": "Tatabánya", "Veszprém": "Veszprém", "Kaposvár": "Kaposvár",
    "Zalaegerszeg": "Zalaegerszeg", "Salgótarján": "Salgótarján", "Szekszárd": "Szekszárd", "Békéscsaba": "Békéscsaba",
  },
};

export function getAutoRegion(countryCode: string, city: string): string | null {
  if (!countryCode || !city) return null;
  const countryMap = REGION_MAP[countryCode];
  if (!countryMap) return null;
  const trimmed = city.trim();
  if (countryMap[trimmed]) return countryMap[trimmed];
  const lower = trimmed.toLowerCase();
  for (const [key, region] of Object.entries(countryMap)) {
    if (key.toLowerCase() === lower) return region;
    if (lower.startsWith(key.toLowerCase())) return region;
  }
  return null;
}

export function getAutoDistrict(countryCode: string, city: string): string | null {
  if (!countryCode || !city) return null;
  const countryMap = DISTRICT_MAP[countryCode];
  if (!countryMap) return null;
  const trimmed = city.trim();
  if (countryMap[trimmed]) return countryMap[trimmed];
  const lower = trimmed.toLowerCase();
  for (const [key, district] of Object.entries(countryMap)) {
    if (key.toLowerCase() === lower) return district;
    if (lower.startsWith(key.toLowerCase())) return district;
  }
  return null;
}

export function getDistrictsForRegion(countryCode: string, region: string): string[] {
  const countryDistricts = DISTRICTS_BY_REGION[countryCode];
  if (!countryDistricts) return [];
  return countryDistricts[region] || [];
}
