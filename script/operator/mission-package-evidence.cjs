// Pure, anonymized diagnosis of package holders. No database or filesystem I/O.
const groups = ["agreed", "proposalAccepted", "proposalOther", "proposalUnaccepted", "validated"];
const fail = reason => { throw Error(reason); };
function packageEvidence(input, engine, now) {
  const config = input.config;
  const packageIds = config.materials?.packageSent ?? [];
  if (!packageIds.length) fail("DETAIL_PACKAGE_MAPPING_MISSING");
  const byItem = new Map(input.items.map(i => [i.id, i.stepId]));
  const clinicFor = new Map(input.enrollments.map(e => [e.id, e.clinicId]));
  const aliases = new Map(input.clinics.map(c => c.id).sort().map((id, i) => [id, `K${String(i + 1).padStart(4, "0")}`]));
  const candidates = new Set([...input.states, ...input.events.filter(e => e.confirmed)]
    .filter(e => packageIds.includes(e.itemId)).map(e => clinicFor.get(e.contactId)).filter(Boolean));
  if (candidates.size > 20) fail("DETAIL_CANDIDATE_LIMIT");
  const standalone = input.items.filter(i => i.stepId === "MPN-06a");
  const standaloneIds = standalone.length === 1 && config.sources.proposalOther.includes(standalone[0].id) ? [standalone[0].id] : [];
  const roleIds = { ...Object.fromEntries(groups.map(g => [g, config.sources[g]])),
    standalone: standaloneIds, packageSent: packageIds };
  const relevant = new Set([...Object.values(roleIds).flat(),
    ...["materials17","materials18","materials19"].flatMap(g => [...config.sources[g], ...(config.materials?.excluded[g] ?? [])])]);
  const codes = ids => [...new Set(ids.map(id => byItem.get(id) ?? "[nedostupná položka]"))].sort();
  const condition = active => {
    const yes = key => config.sources[key].some(id => active.has(id));
    const agreed = yes("agreed"), validated = yes("validated");
    const proposal = yes("proposalAccepted") || yes("proposalOther");
    const contract = agreed && validated && proposal;
    const without = agreed && yes("proposalUnaccepted");
    const standaloneProof = standaloneIds.some(id => active.has(id));
    const parts = ["materials17","materials18","materials19"];
    return {
      suhlas: agreed, prijataPonuka: yes("proposalAccepted"), ostatnaPonuka: yes("proposalOther"),
      neprijataPonuka: yes("proposalUnaccepted"), overenaZmluva: validated,
      samostatneMPN06a: standaloneProof, balik: packageIds.some(id => active.has(id)),
      zmluvnaSpolupraca: contract, bezZmluvySpolupraca: without, spolupraca: contract || without || standaloneProof,
      povodnaSpolupraca: contract || without,
      komponentovyDokaz: parts.some(key => yes(key)) && parts.every(key =>
        yes(key) || config.materials?.excluded[key].some(id => active.has(id))),
      chybaPreZmluvnuVetvu: [!agreed && "súhlas", !validated && "overená zmluva", !proposal && "príslušná ponuka"].filter(Boolean),
      chybaPreBezZmluvnuVetvu: [!agreed && "súhlas", !yes("proposalUnaccepted") && "neprijatá ponuka MPN-06e"].filter(Boolean),
    };
  };
  function enrollmentDetail(enrollment) {
    const events = input.events.filter(e => e.contactId === enrollment.id);
    const states = input.states.filter(s => s.contactId === enrollment.id);
    const current = new Set(states.map(s => s.itemId)), active = new Set();
    const sorted = events.filter(e => relevant.has(e.itemId)).sort((a, b) =>
      a.atExact.localeCompare(b.atExact) || a.id.localeCompare(b.id));
    const first = { zmluvnaSpolupraca: null, bezZmluvySpolupraca: null, samostatneMPN06a: null,
      spolupraca: null, materialyPodlaPovodnehoPravidla: null };
    let legacyReached = false, ambiguous = false;
    const timeline = [];
    for (let i = 0; i < sorted.length;) {
      const at = sorted[i].atExact;
      if (!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{6}$/.test(at)) fail("DETAIL_TIMESTAMP_MISSING");
      const batch = new Map();
      while (i < sorted.length && sorted[i].atExact === at) {
        const event = sorted[i++];
        if (typeof event.confirmed !== "boolean") fail("DETAIL_CONFIRMATION_INVALID");
        const values = batch.get(event.itemId) ?? new Set();
        values.add(event.confirmed); batch.set(event.itemId, values);
      }
      const conflicts = [];
      for (const [id, values] of batch) {
        if (values.size > 1) { conflicts.push(id); active.delete(id); ambiguous = true; }
        else if (values.has(true)) active.add(id); else active.delete(id);
      }
      const proof = condition(active);
      legacyReached ||= proof.povodnaSpolupraca;
      for (const key of ["zmluvnaSpolupraca","bezZmluvySpolupraca","samostatneMPN06a","spolupraca"])
        if (proof[key] && first[key] === null) first[key] = at;
      if (legacyReached && (proof.balik || proof.komponentovyDokaz) &&
          first.materialyPodlaPovodnehoPravidla === null) first.materialyPodlaPovodnehoPravidla = at;
      timeline.push({ casUTCdb: at,
        potvrdene: codes([...batch].filter(([,v]) => v.size === 1 && v.has(true)).map(([id]) => id)),
        odobrate: codes([...batch].filter(([,v]) => v.size === 1 && v.has(false)).map(([id]) => id)),
        rozporne: codes(conflicts), aktivne: codes([...active]),
        spolupraca: proof.spolupraca, povodnaSpolupraca: proof.povodnaSpolupraca,
      });
    }
    const nativeInput = { ...input, clinics: input.clinics.filter(c => c.id === enrollment.clinicId),
      enrollments: [enrollment], events, states, calls: [] };
    const native = engine.computeMissionFunnel(nativeInput, {}, now, { allMilestones: true });
    const result = Object.fromEntries(["cooperating","materials","wantsContract"].map(key => [key,
      native.rows.find(r => r.key === key).members.length > 0]));
    const fallback = states.some(s => !events.some(e => e.itemId === s.itemId));
    return {
      aktualne: condition(current), vysledokNasadenehoVypoctu: result,
      nativnyVypocetPouzivaAjStavBezHistorie: fallback,
      dokazyPodlaUlozenehoMapovania: Object.fromEntries(Object.entries(roleIds).map(([role, ids]) => {
        const history = sorted.filter(e => ids.includes(e.itemId));
        return [role, { kody: codes(ids), aktualne: ids.some(id => current.has(id)),
          potvrdeneVHistorii: history.some(e => e.confirmed), odobrateVHistorii: history.some(e => !e.confirmed),
          prvePotvrdenieUTCdb: history.find(e => e.confirmed)?.atExact ?? null,
          poslednaZmenaUTCdb: history.at(-1)?.atExact ?? null,
          stavBezAkejKolvekHistorie: ids.some(id => current.has(id) && !events.some(e => e.itemId === id)) }];
      })),
      prveHistorickeSubehyUTCdb: first, rozporVPresnomCase: ambiguous,
      aktualnyStavOprotiKoncuRelevantnejHistorie: {
        ibaVAktualnomStave: codes([...current].filter(id => relevant.has(id) && !active.has(id))),
        ibaVRekonstruovanejHistorii: codes([...active].filter(id => !current.has(id))),
      },
      pocetHistorickychDavok: timeline.length, zobrazeneHistorickeDavky: timeline.slice(0, 80),
      historiaVoVystupeSkratena: timeline.length > 80,
    };
  }
  const clinics = [...candidates].sort().map(id => {
    const enrollments = input.enrollments.filter(e => e.clinicId === id).sort((a,b) => a.id.localeCompare(b.id));
    const rows = enrollments.map(enrollmentDetail);
    return {
      kod: aliases.get(id), pocetZapisov: rows.length,
      spolupracaPodlaNasadenehoVypoctu: rows.some(r => r.vysledokNasadenehoVypoctu.cooperating),
      materialyPodlaNasadenehoVypoctu: rows.some(r => r.vysledokNasadenehoVypoctu.materials),
      zapisy: rows.map((r, i) => ({ zapis: i + 1, ...r,
        suhlasExistujeIbaNaInomZapise: !r.aktualne.suhlas && rows.some((other,j) => j !== i && other.aktualne.suhlas),
        validaciaExistujeIbaNaInomZapise: !r.aktualne.overenaZmluva && rows.some((other,j) => j !== i && other.aktualne.overenaZmluva),
      })),
    };
  });
  return {
    mission: "Medical Partner Cooperation", rezim: "READ ONLY; ROLLBACK; iba diagnostika existujúcich dôkazov",
    casAudituUTC: now.toISOString(), pocetAmbulanciiMission: input.clinics.length,
    pocetAmbulanciiSDokazomBalika: clinics.length, mapovanieBalika: codes(packageIds),
    obmedzenia: [
      "Kandidáti majú aktuálny alebo historicky potvrdený zdroj celého balíka; bez filtra obdobia či kohorty.",
      "Anonymné kódy z aktuálneho zoradeného zoznamu Mission nie sú trvalé identifikátory.",
      "Historický súbeh je rekonštruovaný na jednom zápise s presnosťou mikrosekúnd; stavové dátumy sa za históriu nevydávajú.",
      "Výsledok nasadeného výpočtu zachováva jeho existujúce správanie vrátane milisekundovej presnosti a stavového fallbacku.",
      "Rozporné potvrdenie a odobratie toho istého zdroja v presne rovnakom čase sa v presnej rekonštrukcii nepovažuje za dôkaz.",
      "Aktuálne chýbajúca podmienka sama nedokazuje, že chýbala počas celej histórie; pozrite prvé súbehy a udalosti.",
      "Časy sú časy evidovaných potvrdení v databáze, nie nezávisle overené časy odoslania zásielok.",
    ],
    ambulancie: clinics,
  };
}
module.exports = { packageEvidence };
