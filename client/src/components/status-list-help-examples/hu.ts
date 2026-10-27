import type { ExampleChapters } from "./types";

export const hu: ExampleChapters = {
  healthcareExamples: {
    title: "Példák: elérhetőségi állapotváltások",
    paragraphs: [
      "Az állapotok feltételként és műveleti eseményként is használhatók. Különböztesse meg az állapotváltozást — például sikeres hívás után Unreachable helyett Reachable — és az automatizálás válaszát: értesítés, feladat vagy másik kérdés megerősítése.",
      "Az AKKOR jelenleg nem írhatja át tetszőlegesen a rendszerállapotot Reachable értékre; azt híváseredménynek kell igazolnia. Ezek útmutatók, nem bekapcsolt szabályok. A súgó olvasása semmit nem hoz létre és nem küld el.",
      "Mission → Beállítások → Status List → Szabályok és műveletek → Szolgáltató elérhetősége. Nyissa le a közös konfigurációt, és a válasznál állítsa be a műveleteket. Másik kérdésre ható szabálynál a választ az AMIKOR, a feltételeket a HA részben válassza ki. A szükséges állapotok használatát engedélyezni kell.",
    ],
    examples: [
      { title: "1. Unreachable → Reachable sikeres hívás után", paragraphs: [
        "Helyzet: Öt kísérlet sikertelen. A következőt az orvos vagy a személyzet fogadja. A beszélgetés eléri a beállított minimumot — alapból 3 másodpercet. A rendszer Reachable állapotot állít be és nullázza a sikertelen kísérleteket.",
        "AMIKOR: a Reachable aktiválódik\nAKKOR: belső értesítés küldése\n„A kapcsolat ismét elérhető.”",
        "Az értesítést a Reachable válasz műveleteinél állítsa be, vagy a válasz alapján erősítse meg a „Telefonos kapcsolat ellenőrizve” normál lépést.",
        "Figyelem: Ez általában a Reachable állapotba lépésre reagál, nem kizárólag az Unreachable állapotból történő váltásra.",
      ] },
      { title: "2. Wrong number → feladat → megerősített hívás", paragraphs: [
        "Helyzet: A számot nem a megfelelő személy fogadja.",
        "FOLYAMAT:\nNyisd meg az Új feladatot, és válaszd a Hibás telefonszámot\n↓ válassz indokot és a klinikához vagy kórházhoz felkínált meglévő telefonmezőt\n↓ a feladat rögzíti az indokot és a jelentett számot; új szám megadása nem szükséges\n↓ a javítást a szokásos módon mentsd az egészségügyi rekordba, majd hívd a javított számot\n↓ a hívás lezárásakor csak akkor erősítsd meg, ha a megfelelő szolgáltatót vagy személyzetet érted el",
        "Az Ellenőrzés kérése csak kérés; önmagában nem változtatja meg az egészségügyi elérhetőségi állapotot. A megerősítés csak akkor jelenik meg, ha a szerver megfelelő hívást és számot kapcsolt a bejelentéshez vagy javításhoz. A hívásnak el kell érnie a beállított minimális beszélgetési időt. A technikai felvétel önmagában nem megerősítés.",
        "A kérés az aktuális Missionhöz, munkamenethez, egészségügyi entitáshoz, ügyhöz és telefonszámhoz kötött. Kapcsolatváltás után ne erősíts meg régi feladatot.",
        "A szám javítása önmagában nem bizonyít sikeres kapcsolatot. Az ellenőrzéshez megfelelő, kellő hosszúságú hívás és az ügynök kifejezett megerősítése szükséges.",
      ] },
      { title: "3. Öt sikertelen kísérlet → e-mail", paragraphs: [
        "Tartsa a küszöböt 5-ön, és adjon e-mail-műveletet az Unreachable válaszhoz.",
        "AMIKOR: az Unreachable aktiválódik\nHA: elérhetőség = Unreachable\nÉS: sikertelen kísérletek ≥ 5\nAKKOR: e-mail a kijelölt címzettnek",
        "Állítsa be a címzettet, tárgyat, tartalmat és az automatikus vagy ellenőrzés utáni végrehajtást. Az állapotváltozás indítja az e-mailt, nem minden kártyanyitás vagy további sikertelen kísérlet.",
      ] },
      { title: "4. Not working → a kiválasztott szám jelentése", paragraphs: [
        "Nyisd meg az Új feladatot, válaszd a Hibás telefonszámot, az „A szám nem működik” indokot, majd a vizsgálandó meglévő telefonmezőt.",
        "A feladat rögzíti a kiválasztott számot és az indokot. Nem módosítja észrevétlenül az elérhetőséget, és nem ad hozzá csere számot; az egészségügyi rekordot a szokásos javítási folyamatban frissítsd.",
        "Javítás után a hívás lezárásakor ellenőrizhető a megfelelő, minimális beszélgetési időt teljesítő hívás. Az ügynöknek kifejezetten meg kell erősítenie a megfelelő szolgáltatót vagy személyzetet; a technikai felvétel nem elég.",
      ] },
      { title: "5. Elérhetőség normál kérdés feltételeként", paragraphs: [
        "Nem szükséges, hogy közvetlenül a hét állapot egyike legyen az esemény.",
        "AMIKOR: az ügynök megerősíti a „Telefonos megkeresés folytatása” kérdést\nHA: elérhetőség = Reachable\nAKKOR: „Telefonos kapcsolat ellenőrizve” lépés megerősítése",
        "Vagy egy konkrét művelet korlátozása:\nCsak ha állapot = Unreachable\nÉS sikertelen kísérletek ≥ 5.",
        "Másik kérdés megerősítése nem feltétlenül indítja a műveleteit. Szükség esetén külön engedélyezze a cél automatizálásait, és ellenőrizze a hurkokat, ismétlődéseket.",
      ] },
      { title: "Jelenlegi korlátok", paragraphs: [
        "Beállítható a „Reachable állapotba lép” és a „jelenlegi állapot Reachable”. A pontos „előző állapot Wrong number, új állapot Reachable” szűrő még nem érhető el.",
        "A Reachable későbbi sikertelen kísérlet után is megmarad; a sikertelenséget külön rögzíti a rendszer. Ez nem jelent automatikus visszalépést Unreachable állapotba.",
        "Az állapot és számláló az adott Mission és kapcsolat közös konfigurációjából származik. Hiányzó vagy többértelmű forrás, szüneteltetés és tiltott eredmény nem számít teljesült feltételnek.",
      ] },
    ],
  },
  previousAutomationExamples: {
    title: "Példák: további automatizálások",
    paragraphs: [
      "Korábban előkészített lehetőségek részletes példái. A név, leírás vagy SYS jelölés önmagában semmit nem hajt végre; ellenőrizze a tényleges műveletet és paramétereit.",
      "Műveletenként válasszon automatikus vagy ellenőrzés és jóváhagyás utáni végrehajtást. A forrás elrejtése nem tiltja az értékelést. A meglévő állapot első észlelése alapállapot, nem visszamenőleges végrehajtás. Batch módban vegye figyelembe a Status List mentését.",
    ],
    examples: [
      { title: "1. Unreached → visszahívás hat munkanap múlva", paragraphs: [
        "Helyzet: Sikertelen kísérlet az Unreachable küszöbe alatt, megőrzött Reachable nélkül.",
        "AMIKOR: új sikertelen kísérlet aktiválja az Unreached állapotot\nAKKOR: visszahívás 6 munkanap múlva, 09:00-kor",
        "Az Unreached műveleteinél ellenőrizze a 6 napot, a munkanapokat, a 09:00 időt és a meglévő visszahívás kezelését. Az alapból létrehozott művelet megőrzi a meglévő időpontot, nem tolja el automatikusan.",
        "A koordinátor a Queue felületen módosíthatja. A kártya újbóli megnyitása nem hoz létre másik visszahívást.",
      ] },
      { title: "2. Kapcsolt hangposta → javítás Unreached állapotra", paragraphs: [
        "Helyzet: A hívás technikailag kapcsolódott, de hangposta jelentkezett az orvos vagy személyzet helyett.",
        "FOLYAMAT: állapotellenőrzés megnyitása\nJELÖLÉS: az utolsó kapcsolt hívás hangposta\nMENTÉS: ellenőrzés",
        "Ez a hívás nem bizonyít Reachable állapotot. Más sikeres hívás nélkül, a küszöb alatt Unreached, a küszöbnél esetleg Unreachable az eredmény. A műveletek a tényleges eredményt követik.",
        "A jelölés az adott utolsó híváshoz tartozik. Nem jelenti, hogy minden rövid hívás hangposta.",
      ] },
      { title: "3. Long-term absent → belső értesítés", paragraphs: [
        "A koordinátor ellenőrzi a tartós távollétet, és az állapotellenőrzésben menti a Long-term absent értéket.",
        "AMIKOR: a Long-term absent aktiválódik\nAKKOR: kijelölt felhasználó vagy csoport értesítése\n„A tartós távollét alatti további lépések ellenőrzése.”",
        "Állítsa be a címzettet és szöveget. Az állapot nem módosítja a számlálót és nincs automatikus időhatára. Az „egy hónap múlva hívni” szöveg nem hoz létre visszahívást; külön támogatott művelet szükséges.",
      ] },
      { title: "4. Kommunikációs előzmények → műveleti feltétel", paragraphs: [
        "Normál kérdés megerősítésekor vizsgálja meg, rögzítettek-e már elküldött e-mailt ebben a Missionben.",
        "AMIKOR: az ügynök megerősíti a kérdést\nHA: kommunikációs előzmények — e-mail elküldve = igen\nAKKOR: „E-mail már elküldve” lépés megerősítése",
        "Az előzménymezőt válassza, ne megjegyzést vagy telefonszámot. További műveletet a céllépésen állítson be, és külön engedélyezze a szabályból való indítását.",
        "Az elküldés nem bizonyít kézbesítést vagy választ. Ez nem „X napja nincs válasz” időzítő, és önmagában nem különít el sablont vagy üzenettartalmat.",
      ] },
    ],
  },
};
