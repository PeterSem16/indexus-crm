from pathlib import Path
from textwrap import wrap
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import A4
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.colors import HexColor, white, black

OUT = Path("outputs/NEXUS_Pulse_komplexny_testovaci_formular_SK.pdf")
OUT.parent.mkdir(parents=True, exist_ok=True)

W, H = A4
M = 42
RED = HexColor("#C8102E")
NAVY = HexColor("#132238")
BLUE = HexColor("#1E5AA8")
LIGHT = HexColor("#F3F6FA")
MID = HexColor("#D9E1EA")
GREEN = HexColor("#207A4A")
ORANGE = HexColor("#B96800")
GRAY = HexColor("#5E6875")

pdfmetrics.registerFont(TTFont("DejaVu", "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"))
pdfmetrics.registerFont(TTFont("DejaVu-Bold", "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"))

c = canvas.Canvas(str(OUT), pagesize=A4, pageCompression=1)
c.setTitle("NEXUS Pulse — komplexný testovací formulár")
c.setAuthor("INDEXUS")
form = c.acroForm
page_no = 0


def footer():
    c.setStrokeColor(MID)
    c.line(M, 28, W - M, 28)
    c.setFont("DejaVu", 7.5)
    c.setFillColor(GRAY)
    c.drawString(M, 16, "INDEXUS · NEXUS Pulse · komplexné opakovateľné testovanie")
    c.drawRightString(W - M, 16, f"Strana {page_no}")


def new_page(section=None):
    global page_no
    if page_no:
        footer()
        c.showPage()
    page_no += 1
    c.setFillColor(NAVY)
    c.rect(0, H - 34, W, 34, fill=1, stroke=0)
    c.setFont("DejaVu-Bold", 9)
    c.setFillColor(white)
    c.drawString(M, H - 22, "INDEXUS · NEXUS PULSE")
    if section:
        c.drawRightString(W - M, H - 22, section)


def text(text_value, x, y, size=9, color=black, bold=False, width=92, leading=None):
    c.setFont("DejaVu-Bold" if bold else "DejaVu", size)
    c.setFillColor(color)
    leading = leading or size * 1.35
    lines = []
    for paragraph in str(text_value).split("\n"):
        lines.extend(wrap(paragraph, width=width, break_long_words=False) or [""])
    for line in lines:
        c.drawString(x, y, line)
        y -= leading
    return y


def heading(title, subtitle=None):
    y = H - 63
    y = text(title, M, y, 18, NAVY, True, 52, 23)
    if subtitle:
        y = text(subtitle, M, y - 3, 9.5, GRAY, False, 94, 13)
    return y - 8


def field(name, label, x, y, width=210, height=20, multiline=False):
    text(label, x, y + height + 4, 7.5, GRAY, True, 60, 9)
    form.textfield(
        name=name,
        tooltip=label,
        x=x,
        y=y,
        width=width,
        height=height,
        borderColor=MID,
        fillColor=white,
        textColor=NAVY,
        borderWidth=1,
        forceBorder=True,
        fontName="Helvetica",
        fontSize=8,
        fieldFlags=4096 if multiline else 0,
    )


def checkbox(name, label, x, y, checked=False, size=11, label_width=78):
    form.checkbox(
        name=name,
        tooltip=label,
        x=x,
        y=y - 2,
        buttonStyle="check",
        borderColor=HexColor("#8B98A8"),
        fillColor=white,
        textColor=GREEN,
        checked=checked,
        size=size,
        forceBorder=True,
    )
    text(label, x + size + 5, y, 8, NAVY, False, label_width, 10)


def outcome(test_id, y):
    c.setFillColor(LIGHT)
    c.roundRect(M, y - 22, W - 2 * M, 36, 5, fill=1, stroke=0)
    text("CELKOVÝ VÝSLEDOK TESTU — označte iba jednu možnosť", M + 9, y + 5, 7.5, GRAY, True, 70, 9)
    choices = [
        ("PASS", "Prešiel", GREEN),
        ("FAIL", "Neprešiel", RED),
        ("CONDITIONAL", "S výhradami", ORANGE),
        ("NOT_TESTED", "Netestované", GRAY),
    ]
    x = M + 10
    for value, label, color in choices:
        form.radio(
            name=f"{test_id}_result",
            value=value,
            selected=False,
            x=x,
            y=y - 15,
            buttonStyle="circle",
            borderColor=color,
            fillColor=white,
            textColor=color,
            size=11,
            forceBorder=True,
        )
        text(label, x + 15, y - 7, 8, color, True, 22, 9)
        x += 119


def expected_checks(test_id, items, y):
    text("KONTROLNÉ BODY — zaškrtnite každý bod, ktorý prešiel", M, y, 8.5, NAVY, True, 90, 11)
    y -= 17
    for i, item in enumerate(items, 1):
        checkbox(f"{test_id}_check_{i}", item, M + 2, y, size=10, label_width=96)
        line_count = max(1, len(wrap(item, width=96, break_long_words=False)))
        y -= 10 * line_count + 5
    return y


def scenario(test):
    new_page(test["section"])
    y = heading(f'{test["id"]}  {test["title"]}', test.get("goal"))
    if test.get("history"):
        c.setFillColor(HexColor("#FFF6E5"))
        box_h = 48
        c.roundRect(M, y - box_h + 6, W - 2 * M, box_h, 5, fill=1, stroke=0)
        text("REGRESNÝ KONTEXT Z TESTOV 1. A 4. 9. 2026", M + 9, y - 5, 7.5, ORANGE, True, 80, 9)
        text(test["history"], M + 9, y - 18, 8, NAVY, False, 92, 10)
        y -= box_h + 5
    text("PREDPOKLADY", M, y, 8.5, NAVY, True, 80, 10)
    y = text(test.get("pre", "Tester je prihlásený správnym účtom a má dostupné testovacie prostredie."), M, y - 13, 8, GRAY, False, 96, 10) - 5
    text("KROKY", M, y, 8.5, NAVY, True, 80, 10)
    steps = test["steps"]
    y -= 14
    for index, step in enumerate(steps, 1):
        y = text(f"{index}. {step}", M + 2, y, 8, NAVY, False, 94, 10) - 2
    y -= 2
    y = expected_checks(test["id"], test["checks"], y)

    if test.get("call"):
        y -= 5
        if y < 305:
            footer()
            c.showPage()
            globals()["page_no"] += 1
            c.setFillColor(NAVY)
            c.rect(0, H - 34, W, 34, fill=1, stroke=0)
            c.setFont("DejaVu-Bold", 9)
            c.setFillColor(white)
            c.drawString(M, H - 22, "INDEXUS · NEXUS PULSE")
            c.drawRightString(W - M, H - 22, test["section"])
            y = H - 63
            text(f'{test["id"]} — záznam hovoru', M, y, 15, NAVY, True, 60, 20)
            y -= 30
        field(f'{test["id"]}_customer', "Meno karty zákazníka / kontaktu (povinné)", M, y - 22, 245)
        field(f'{test["id"]}_campaign', "Kampaň / Mission", M + 260, y - 22, 245)
        y -= 57
        field(f'{test["id"]}_number', "Testované číslo — iba posledné 4 číslice", M, y - 22, 155)
        field(f'{test["id"]}_start', "Čas začiatku", M + 170, y - 22, 100)
        field(f'{test["id"]}_end', "Čas ukončenia", M + 285, y - 22, 100)
        field(f'{test["id"]}_ended_by', "Ukončil", M + 400, y - 22, 105)
        y -= 57
        checkbox(f'{test["id"]}_audio_a2c', "Agent počul zákazníka", M, y, label_width=34)
        checkbox(f'{test["id"]}_audio_c2a', "Zákazník počul agenta", M + 175, y, label_width=34)
        checkbox(f'{test["id"]}_history', "História uložená", M + 350, y, label_width=24)
        y -= 24
        checkbox(f'{test["id"]}_recording', "Nahrávka dostupná podľa politiky", M, y, label_width=44)
        checkbox(f'{test["id"]}_ui_closed', "UI hovoru sa správne ukončilo", M + 260, y, label_width=42)
        y -= 38

    if test.get("reschedule"):
        field(f'{test["id"]}_resched_expected', "Očakávaný nový dátum a čas callbacku", M, y - 22, 245)
        field(f'{test["id"]}_resched_actual', "Skutočný dátum a čas vo fronte po uložení", M + 260, y - 22, 245)
        y -= 57
        field(f'{test["id"]}_resched_card', "Meno karty zákazníka / kontaktu (povinné)", M, y - 22, 245)
        field(f'{test["id"]}_resched_note', "Poznámka k preplánovaniu", M + 260, y - 22, 245)
        y -= 57

    if test.get("status_tasks"):
        if not test.get("call"):
            field(f'{test["id"]}_customer', "Meno karty zákazníka / kontaktu (povinné)", M, y - 22, 245)
            field(f'{test["id"]}_campaign', "Kampaň / Mission", M + 260, y - 22, 245)
            y -= 57
        text("STATUS LIST — výsledok každej úlohy", M, y, 8.5, NAVY, True, 80, 10)
        y -= 17
        for i in range(1, 13):
            if i == 7:
                footer()
                c.showPage()
                globals()["page_no"] += 1
                c.setFillColor(NAVY)
                c.rect(0, H - 34, W, 34, fill=1, stroke=0)
                c.setFont("DejaVu-Bold", 9)
                c.setFillColor(white)
                c.drawString(M, H - 22, "INDEXUS · NEXUS PULSE")
                c.drawRightString(W - M, H - 22, test["section"])
                y = H - 65
                text(f'{test["id"]} — Status List, pokračovanie', M, y, 14, NAVY, True, 62, 18)
                y -= 30
            field(f'{test["id"]}_task_{i}', f"Úloha {i} — názov / otázka", M, y - 16, 270, 16)
            checkbox(f'{test["id"]}_task_{i}_passed', "Passed", M + 285, y - 1, size=10, label_width=12)
            checkbox(f'{test["id"]}_task_{i}_failed', "Failed", M + 380, y - 1, size=10, label_width=12)
            checkbox(f'{test["id"]}_task_{i}_na', "N/A", M + 465, y - 1, size=10, label_width=8)
            y -= 37

    if y < 170:
        footer()
        c.showPage()
        globals()["page_no"] += 1
        c.setFillColor(NAVY)
        c.rect(0, H - 34, W, 34, fill=1, stroke=0)
        c.setFont("DejaVu-Bold", 9)
        c.setFillColor(white)
        c.drawString(M, H - 22, "INDEXUS · NEXUS PULSE")
        c.drawRightString(W - M, H - 22, test["section"])
        y = H - 70
        text(f'{test["id"]} — vyhodnotenie', M, y, 15, NAVY, True, 60, 20)
        y -= 35
    outcome(test["id"], y - 8)
    field(f'{test["id"]}_actual', "Skutočný výsledok / odchýlka", M, y - 92, W - 2 * M, 38, True)
    field(f'{test["id"]}_evidence', "Dôkaz: screenshot, čas, incident ID alebo odkaz", M, y - 145, W - 2 * M, 25)


# Cover
new_page()
c.setFillColor(RED)
c.roundRect(M, H - 170, 64, 64, 10, fill=1, stroke=0)
c.setFont("DejaVu-Bold", 30)
c.setFillColor(white)
c.drawCentredString(M + 32, H - 147, "✓")
text("NEXUS Pulse", M, H - 220, 30, NAVY, True, 35, 36)
text("Komplexný testovací formulár", M, H - 260, 21, RED, True, 46, 28)
text("Opakovateľné funkčné, regresné a hovorové testovanie", M, H - 300, 12, GRAY, False, 65, 17)
c.setFillColor(LIGHT)
c.roundRect(M, H - 475, W - 2 * M, 125, 8, fill=1, stroke=0)
text("Dokument spája:", M + 18, H - 375, 10, NAVY, True, 70, 13)
text("• 17 testov z externého checklistu\n• výsledky a chyby z testovania 1. a 4. septembra 2026\n• kompletné inbound/outbound scenáre a všetky spôsoby ukončenia\n• callbacky, preplánovanie a jednotlivé úlohy Status Listu\n• onboarding, verzie Pulse, komunikáciu, históriu a nahrávky", M + 18, H - 395, 9.5, NAVY, False, 82, 15)
text("Verzia dokumentu: 1.0 · september 2026", M, 85, 9, GRAY, False, 60, 12)

# Identification
new_page("IDENTIFIKÁCIA TESTU")
y = heading("Identifikácia testovacieho cyklu", "Vyplňte pred začatím. Nepoužívajte reálne citlivé údaje mimo schválených testovacích kontaktov.")
fields = [
    ("cycle_tester", "Meno testera"),
    ("cycle_date", "Dátum testovania"),
    ("cycle_environment", "Prostredie / URL"),
    ("cycle_browser", "Prehliadač a presná verzia"),
    ("cycle_os", "Operačný systém"),
    ("cycle_device", "Počítač / zariadenie"),
    ("cycle_headset", "Headset / mikrofón / výstup"),
    ("cycle_network", "Sieť: Ethernet / Wi-Fi / VPN"),
    ("cycle_account", "Testovací účet"),
    ("cycle_role", "Rola a oprávnenia"),
    ("cycle_campaign", "Testovacia kampaň / Mission"),
    ("cycle_build", "Verzia / commit / čas nasadenia"),
]
for i, (name, label) in enumerate(fields):
    col = i % 2
    row = i // 2
    field(name, label, M + col * 260, y - 28 - row * 62, 245, 24)
field("cycle_scope", "Rozsah testovania a známe obmedzenia", M, y - 410, W - 2 * M, 72, True)

# Instructions
new_page("POKYNY")
y = heading("Ako dokument používať", "Každý test je navrhnutý tak, aby ho mohol iný tester vykonať znovu bez znalosti predchádzajúceho cyklu.")
instructions = [
    ("1", "Pred testom", "Použite schválenú testovaciu Mission, testovaciu kartu a čísla. Zapíšte presný prehliadač, rolu a headset."),
    ("2", "Počas testu", "Zaškrtnite každý kontrolný bod samostatne. Pri hovore je meno zákazníckej karty povinné; zapisujte iba posledné štyri číslice čísla."),
    ("3", "Status List", "Každú zobrazenú úlohu/otázku prepíšte do riadka a označte Passed, Failed alebo N/A. Celý scenár môže byť PASS iba ak prešli všetky povinné úlohy."),
    ("4", "Preplánovanie", "Vždy zapíšte očakávaný nový termín a skutočný termín z Queue po uložení. Skontrolujte kartu, Queue aj badge bez refreshu."),
    ("5", "Chyba", "Uveďte ID testu, presný čas, kroky, očakávaný a skutočný výsledok. Priložte screenshot; pri hovore čas, smer a zákaznícku kartu."),
    ("6", "Výsledok", "PASS = všetko prešlo; FAIL = kritická odchýlka; S výhradami = nekritická odchýlka; Netestované = scenár nebol vykonaný."),
]
for num, title, body in instructions:
    c.setFillColor(LIGHT)
    c.roundRect(M, y - 58, W - 2 * M, 52, 6, fill=1, stroke=0)
    c.setFillColor(BLUE)
    c.circle(M + 22, y - 32, 13, fill=1, stroke=0)
    c.setFont("DejaVu-Bold", 10)
    c.setFillColor(white)
    c.drawCentredString(M + 22, y - 36, num)
    text(title, M + 45, y - 20, 9, NAVY, True, 65, 11)
    text(body, M + 45, y - 34, 8, GRAY, False, 85, 10)
    y -= 65

# Explanations
new_page("VYSVETLENIE OTÁZOK")
y = heading("Technické požiadavky v onboardingovom e-maile", "Čo presne má tester overiť — nejde iba o prítomnosť jednej vety v e-maile.")
onboarding = [
    ("Komu sa blok zobrazí", "Pulse technický blok má dostať používateľ hlasových služieb podľa roly/oddelenia alebo zapnutého SIP. Bežný používateľ bez Pulse ho nemá dostať."),
    ("Jazyk", "Obsah sa zvolí podľa priradenej krajiny; pri viacerých krajinách sa očakáva angličtina."),
    ("Počítač a prehliadač", "Windows 10/11 alebo aktuálny macOS; najnovší 64-bit Google Chrome alebo Microsoft Edge založený na Chromium s automatickými aktualizáciami."),
    ("Povolenia stránky", "Mikrofón, zvuk/automatické prehrávanie a oznámenia pre INDEXUS musia byť Allow. Headset musí byť dostupný ako vstup aj výstup."),
    ("Headset", "Odporúčaná je káblová USB súprava Plantronics/Poly Blackwire s ramienkovým mikrofónom a fyzickým Mute. Reproduktory notebooku sa neodporúčajú; Bluetooth iba výnimočne."),
    ("Sieť a firewall", "Preferovaný je Ethernet. Povolené musia byť HTTPS/WSS TCP 443, WebRTC/UDP médiá a STUN UDP 19302 pre stun.l.google.com a stun1.l.google.com. VPN/proxy nesmie spojenie blokovať."),
    ("Pred zmenou", "Pripojiť headset, overiť mikrofón a reproduktor, zavrieť Teams/Zoom, ponechať počítač na napájaní a zabrániť uspatiu."),
    ("Quick start", "E-mail má vysvetliť otvorenie Pulse, výber Mission, Start Shift/End Shift, prestávky a pravidlo presmerovania iba mimo počítača."),
]
for title, body in onboarding:
    text(title, M, y, 9, NAVY, True, 70, 11)
    y = text(body, M + 12, y - 14, 8, GRAY, False, 92, 10) - 8

new_page("VYSVETLENIE OTÁZOK")
y = heading("Verzia NEXUS Pulse v kampani", "Čo verzia znamená, kde sa nachádza a čo sa musí pri teste reálne overiť.")
version_points = [
    ("Nie je to edícia aplikácie", "Pole nevyberá „starý/nový Pulse“. Ide o automaticky číslovanú revíziu konfigurácie kampane: v1, v2, v3… Jedna revízia je Active, staršie sú Superseded."),
    ("Kde ju nájsť", "Campaign detail → Settings → Status list → panel verzií NEXUS Pulse. Panel je dostupný iba administrátorovi alebo manažérovi."),
    ("Čo snapshot obsahuje", "Vybrané Pulse nastavenia kampane, defaultný aktívny tab, položky Status Listu, otázky a automatizácie. Ostatné nesúvisiace campaign settings sa pri restore nemajú prepísať."),
    ("Vytvorenie verzie", "Po skutočnej zmene konfigurácie vytvorte novú verziu a voliteľnú poznámku. Bez zmeny obsahu sa duplicitná verzia nemá vytvoriť."),
    ("Uloženie a refresh", "Po obnovení stránky musí zostať rovnaké číslo Active verzie, poznámka aj konfigurácia Status Listu."),
    ("Vplyv na Agent Workspace", "Workspace nemá vlastný prepínač verzie. Používa obnovenú konfiguráciu kampane; tester preto musí otvoriť kontakt a overiť položky, otázky a defaultný tab."),
    ("Restore", "Obnova vyžaduje potvrdenie a je zakázaná pre aktívnu kampaň. Kampaň treba pozastaviť, obnoviť staršiu verziu a potom overiť konfiguráciu aj Agent Workspace."),
    ("Bezpečnosť dát", "Položky už použité pri kontaktoch sa pri restore nemajú deštruktívne odstrániť; systém ich môže skryť. Audit a číslovanie verzií musia zostať zachované."),
]
for title, body in version_points:
    c.setFillColor(LIGHT)
    c.roundRect(M, y - 48, W - 2 * M, 43, 5, fill=1, stroke=0)
    text(title, M + 10, y - 17, 8.5, BLUE, True, 72, 10)
    text(body, M + 10, y - 30, 7.8, NAVY, False, 95, 9.5)
    y -= 52


tests = [
    # Readiness
    dict(id="PR-01", section="A · KONTROLA PRIPRAVENOSTI", title="Vstup cez menu a hornú ikonu", goal="Diagnostika sa zobrazí oboma vstupmi a nepustí používateľa do pracoviska pred dokončením.", steps=["Odhláste sa/prihláste sa a otvorte NEXUS Pulse cez ľavé menu.", "Vráťte sa do INDEXUS a otvorte diagnostiku hornou stavovou ikonou.", "Bez dokončenia povinných kontrol skúste pokračovať."], checks=["Diagnostika sa otvorila z menu.", "Diagnostika sa otvorila z hornej ikony.", "Agent Workspace zostal pred úspechom zablokovaný.", "Späť do INDEXUS nevytvorilo úspešný stav."]),
    dict(id="PR-02", section="A · KONTROLA PRIPRAVENOSTI", title="Nepodporovaný prehliadač a starý Ready stav", goal="Firefox/Opera/mobilný prehliadač nesmie použiť starý úspešný session stav.", steps=["V podporovanom prehliadači dokončite kontrolu.", "Otvorte rovnaký účet v nepodporovanom prehliadači alebo simulujte nepodporované prostredie.", "Skontrolujte blokovanie a stavovú ikonu."], checks=["Nepodporovaný prehliadač je jasne označený.", "Starý Ready stav nepovolil vstup.", "Používateľ dostal návod použiť Chrome/Edge.", "Ostatné časti INDEXUS zostali dostupné."]),
    dict(id="PR-03", section="A · KONTROLA PRIPRAVENOSTI", title="HTTPS a bezpečné prostredie", goal="Nezabezpečené spojenie zablokuje hlasové funkcie a zruší použitie uloženého Ready stavu.", steps=["Otvorte produkčné prostredie cez HTTPS a spustite kontrolu.", "V kontrolovanom prostredí otestujte stav bez secure contextu.", "Skúste použiť predchádzajúci Ready stav."], checks=["HTTPS bolo vyhodnotené ako bezpečné.", "Nezabezpečené prostredie bolo blokované.", "Uložená pripravenosť sa nepoužila.", "Chybové vysvetlenie bolo zrozumiteľné."]),
    dict(id="PR-04", section="A · KONTROLA PRIPRAVENOSTI", title="Offline režim a návrat online", goal="Offline stav zruší pripravenosť; návrat online neobíde nové overenie.", steps=["Po úspešnej kontrole prepnite prehliadač/počítač offline.", "Sledujte stavovú ikonu a prístup do Pulse.", "Obnovte internet a spustite kontrolu znova."], checks=["Offline stav bol detegovaný.", "Pripravenosť sa zrušila.", "Po návrate sa spojenia obnovili.", "Pred vstupom sa vykonalo nové overenie."]),
    dict(id="PR-05", section="A · KONTROLA PRIPRAVENOSTI", title="Povolenie mikrofónu", goal="Allow prejde; Deny zablokuje a po oprave sa dá test úspešne zopakovať.", steps=["Spustite kontrolu s povoleným mikrofónom.", "Zmeňte povolenie stránky na Block a spustite znova.", "Povoľte mikrofón v nastavení stránky a zopakujte."], checks=["Allow stav prešiel.", "Deny stav zablokoval vstup.", "Zobrazený návod smeroval do povolení stránky.", "Testovací stream sa po kontrole ukončil."]),
    dict(id="PR-06", section="A · KONTROLA PRIPRAVENOSTI", title="Zvukový vstup, výstup a viac zariadení", goal="Systém nájde mikrofón aj výstup a upozorní pri viacerých zariadeniach.", steps=["Spustite test s pripojeným USB headsetom.", "Odpojte vstup alebo výstup a zopakujte.", "Pripojte viac audio zariadení."], checks=["Headset bol nájdený ako vstup.", "Headset bol nájdený ako výstup.", "Chýbajúce zariadenie zablokovalo kontrolu.", "Viac zariadení vytvorilo upozornenie, nie tichý výber."]),
    dict(id="PR-07", section="A · KONTROLA PRIPRAVENOSTI", title="Testovací zvuk bez bypassu", goal="Potvrdenie je možné až po prehratí a neobíde žiadnu inú povinnú kontrolu.", steps=["Skúste potvrdiť zvuk pred kliknutím na Prehrať testovací zvuk.", "Prehrajte tón, potvrďte počutie.", "Nechajte inú povinnú kontrolu v stave FAIL a skúste pokračovať."], checks=["Potvrdenie bolo pred prehratím nedostupné.", "Tón sa prehral lokálne.", "Potvrdenie zvuku sa uložilo.", "Iná chyba stále blokovala vstup."]),
    dict(id="PR-08", section="A · KONTROLA PRIPRAVENOSTI", title="Oznámenia", goal="Allow sa uloží; Deny je upozornenie, nie kritický bypass ani blok hovoru.", steps=["Kliknite Povoliť oznámenia a povoľte ich.", "Zopakujte s Deny/Block.", "Dokončite ostatné povinné kontroly."], checks=["Allow bol rozpoznaný.", "Deny zobrazil upozornenie.", "Deny neoznačil všetko bezdôvodne ako PASS.", "Pri splnení povinných kontrol bolo možné pokračovať."]),
    dict(id="PR-09", section="A · KONTROLA PRIPRAVENOSTI", title="Stavová ikona", goal="Farba a tooltip zodpovedajú kontrole, Ready, warning a blocked stavu.", steps=["Pozorujte ikonu počas kontroly.", "Vyvolajte úspech, upozornenie a kritickú chybu.", "Kliknite na ikonu v každom stave."], checks=["Sivá = kontrola/neukončené.", "Zelená = pripravené.", "Oranžová = upozornenie/tolerancia.", "Červená = blokované.", "Klik otvoril diagnostiku."]),
    dict(id="PR-10", section="A · KONTROLA PRIPRAVENOSTI", title="SIP/WSS registrácia a 14-sekundová tolerancia", goal="Krátky výpadok sa obnoví automaticky; dlhší zruší pripravenosť.", steps=["Dokončite kontrolu so SIP Registered.", "Prerušte WSS/internet na menej než 14 sekúnd a obnovte.", "Zopakujte s výpadkom dlhším než 14 sekúnd."], checks=["SIP sa pôvodne zaregistroval.", "Krátky výpadok zobrazil tolerančný stav.", "Registrácia sa obnovila bez refreshu.", "Dlhý výpadok zrušil Ready stav."]),
    dict(id="PR-11", section="A · KONTROLA PRIPRAVENOSTI", title="ICE/STUN a typ siete", goal="ICE je informačné; SIP je rozhodujúce. Wi-Fi je warning, Ethernet odporúčaný.", steps=["Spustite kontrolu na Ethernet.", "Zopakujte na Wi-Fi alebo s neznámym typom siete.", "Pozorujte ICE/STUN pri funkčnej SIP registrácii."], checks=["Ethernet bol odporúčaný.", "Wi-Fi vytvorila iba upozornenie.", "ICE výsledok bol zobrazený.", "Samotný informačný ICE warning neblokoval funkčné SIP."]),
    dict(id="PR-12", section="A · KONTROLA PRIPRAVENOSTI", title="Zmena siete, headsetu a uspatie", goal="Zmena prevádzkového prostredia zruší starú pripravenosť.", steps=["Po úspechu zmeňte sieť.", "Zmeňte/pripojte/odpojte audio zariadenie.", "Uspite a prebuďte počítač alebo simulujte dlhé pozastavenie."], checks=["Zmena siete zneplatnila Ready.", "Zmena audio zariadenia zneplatnila Ready.", "Dlhé uspatie vyžiadalo nové overenie.", "Nová kontrola použila aktuálne zariadenia."]),
    dict(id="PR-13", section="A · KONTROLA PRIPRAVENOSTI", title="Bezpečný návrat do INDEXUS", goal="Používateľ nikdy nezostane uväznený v povinnej diagnostike ani v redirect slučke.", steps=["Vyvolajte povinnú chybu.", "Kliknite Späť do INDEXUS.", "Znova otvorte Pulse.", "Otestujte účet, ktorého landing page je Agent Workspace."], checks=["Návrat otvoril vhodnú INDEXUS stránku.", "Nevznikla redirect slučka.", "Návrat nevytvoril Ready stav.", "Pri ďalšom vstupe sa diagnostika ukázala znova."]),
    # Onboarding/version
    dict(id="ONB-01", section="B · ONBOARDING A VERZIE", title="Technické požiadavky v onboardingovom e-maile", goal="Overiť správne publikum, jazyk a celý technický Pulse blok.", steps=["Vytvorte/otvorte Pulse používateľa a preview onboarding e-mailu.", "Porovnajte obsah s vysvetlením v tomto dokumente.", "Zopakujte pre používateľa bez Pulse a pre jednu/viac krajín.", "Odošlite na kontrolnú schránku a overte zobrazenie."], checks=["Pulse používateľ dostal technický blok.", "Používateľ bez Pulse ho nedostal.", "Jazyk zodpovedal krajine/pravidlu viacerých krajín.", "OS, Chrome/Edge a povolenia boli uvedené.", "USB headset a sieť/firewall/STUN boli uvedené.", "Kroky pred zmenou a quick start boli uvedené."]),
    dict(id="VER-01", section="B · ONBOARDING A VERZIE", title="Vytvorenie a zachovanie verzie Pulse", goal="Po zmene vznikne nová Active revízia a prežije refresh.", steps=["Ako admin/manager otvorte Campaign → Settings → Status list.", "Zmeňte jednu testovaciu Pulse položku a vytvorte verziu s poznámkou.", "Zapíšte číslo verzie a obnovte stránku.", "Otvorte kontakt v Agent Workspace."], checks=["Panel verzií bol dostupný iba oprávnenej role.", "Vzniklo nasledujúce číslo vN.", "Nová verzia bola Active.", "Poznámka a Active stav prežili refresh.", "Agent Workspace použil novú konfiguráciu."]),
    dict(id="VER-02", section="B · ONBOARDING A VERZIE", title="Bez duplicitnej verzie bez zmeny", goal="Rovnaký obsah nesmie vytvoriť ďalšiu revíziu.", steps=["Zapíšte aktuálne číslo Active verzie.", "Bez zmeny konfigurácie skúste vytvoriť ďalšiu verziu.", "Obnovte stránku."], checks=["Systém oznámil, že obsah je nezmenený.", "Nevzniklo nové číslo verzie.", "Pôvodná Active verzia zostala aktívna.", "Konfigurácia sa nezmenila."]),
    dict(id="VER-03", section="B · ONBOARDING A VERZIE", title="Restore staršej verzie", goal="Restore je bezpečný, auditovateľný a ovplyvní reálny Status List.", steps=["Na aktívnej kampani skúste restore a potvrďte očakávané odmietnutie.", "Kampaň pozastavte.", "Obnovte staršiu verziu s confirmáciou.", "Overte campaign settings, Status List a Agent Workspace."], checks=["Aktívna kampaň restore odmietla.", "Pozastavená kampaň restore dovolila.", "Vznikla správna Active revízia/audit.", "Nesúvisiace campaign settings zostali zachované.", "Použité položky neboli deštruktívne stratené.", "Workspace zobrazil obnovenú konfiguráciu."]),
    # Calls
    dict(id="CALL-OUT-01", section="C · ODCHÁDZAJÚCE HOVORY", title="Odchádzajúci hovor — zákazník ukončí", goal="Celý tok dialing → ringing → active → remote hangup sa správne finalizuje.", call=True, steps=["Otvorte kartu zákazníka a zavolajte.", "Overte oba smery zvuku.", "Požiadajte zákazníka, aby ukončil hovor.", "Overte UI, History a nahrávku podľa politiky."], checks=["Zobrazené stavy mali správne poradie.", "Remote hangup okamžite ukončil UI.", "História obsahovala smer, čas a trvanie.", "Nahrávka zodpovedala Mission politike."]),
    dict(id="CALL-OUT-02", section="C · ODCHÁDZAJÚCE HOVORY", title="Odchádzajúci hovor — agent ukončí", goal="End call odošle BYE a finalizuje UI, históriu aj nahrávku.", call=True, steps=["Začnite úspešný odchádzajúci hovor.", "Po overení zvuku kliknite End call.", "Sledujte ukončenie na oboch stranách.", "Skontrolujte History a recording."], checks=["End call reagovalo na prvé kliknutie.", "Zákazníkovi sa hovor ukončil.", "UI nezostalo aktívne/zvoniace.", "História a recording sa finalizovali."]),
    dict(id="CALL-OUT-03", section="C · ODCHÁDZAJÚCE HOVORY", title="Odchádzajúci hovor — bez odpovede/zrušenie", goal="Agent môže zrušiť ringing a neúspešný hovor nezostane visieť.", call=True, history="Predchádzajúca chyba: pri nedovolaní agent nevedel zložiť; telefonát sa ukončil na druhej strane, ale UI ďalej zvonilo. Neskôr označené OK.", steps=["Volajte na číslo, ktoré nezdvihne.", "Počas ringing kliknite zrušiť/End.", "Zopakujte a nechajte timeout."], checks=["Agent mohol ringing zrušiť.", "Timeout ukončil UI.", "Nevznikol aktívny ghost call.", "History zaznamenala správny výsledok."]),
    dict(id="CALL-OUT-04", section="C · ODCHÁDZAJÚCE HOVORY", title="Odchádzajúci hovor — busy/rejected/invalid", goal="Každý neúspešný SIP výsledok má zrozumiteľný stav a čisté ukončenie.", call=True, steps=["Otestujte obsadené číslo.", "Otestujte odmietnutie zákazníkom.", "Otestujte neplatné/nedostupné číslo."], checks=["Busy bol rozpoznaný.", "Rejected bol rozpoznaný.", "Invalid/unavailable zobrazil zrozumiteľnú chybu.", "Žiadny variant nezostal aktívny."]),
    dict(id="CALL-OUT-05", section="C · ODCHÁDZAJÚCE HOVORY", title="Opakované outbound hovory — stabilita zvuku", goal="Päť po sebe idúcich hovorov musí mať konzistentný obojsmerný zvuk.", call=True, history="FAIL 4. 9. 2026: 14:02 a 14:06 nebolo počuť ani jeden smer; 14:28 hovor fungoval. Od 14:49 boli hovory bez zvuku, od 15:15 opäť fungovali; nahrávky pritom vznikli.", steps=["Na tú istú kartu uskutočnite najmenej 5 hovorov.", "Pri každom potvrďte oba smery zvuku.", "Zapíšte presný čas každého pokusu.", "Porovnajte History a recordings."], checks=["Všetkých 5 hovorov malo obojsmerný zvuk.", "Nebola potrebná zmena nastavení medzi pokusmi.", "Každý pokus bol v History.", "Recording stav zodpovedal realite."]),
    dict(id="CALL-OUT-06", section="C · ODCHÁDZAJÚCE HOVORY", title="Sekundárne telefónne číslo", goal="Volanie na sekundárne číslo sa priradí ku karte a objaví v histórii.", call=True, history="Predchádzajúca chyba: volanie na sekundárne číslo nebolo v histórii; neskôr označené OK.", steps=["Na karte vyberte sekundárne číslo.", "Uskutočnite a ukončite hovor.", "Otvorte History a vyhľadajte záznam."], checks=["Vytočilo sa zvolené sekundárne číslo.", "Hovor bol priradený správnej karte.", "History obsahovala záznam.", "Vyhľadávanie podľa sekundárneho čísla našlo kartu."]),
    dict(id="CALL-OUT-07", section="C · ODCHÁDZAJÚCE HOVORY", title="Volanie na neznáme číslo", goal="Dialpad jasne zobrazí cieľ, umožní ukončiť hovor a uloží korektný záznam.", call=True, history="FAIL 18. 8. 2026: pri neznámom čísle nebolo jasné, kam sa volá, a tester počul tri vyzváňacie tóny.", steps=["Zadajte číslo, ktoré nie je v databáze.", "Spustite hovor a sledujte zobrazený cieľ.", "Ukončite agentom aj vzdialenou stranou v dvoch pokusoch."], checks=["UI zobrazilo volané číslo/cieľ.", "Nevzniklo viacnásobné zvonenie.", "End call fungovalo.", "History nezobrazila nesprávnu kartu."]),
    dict(id="CALL-OUT-08", section="C · ODCHÁDZAJÚCE HOVORY", title="Správna identita volajúceho", goal="Zobrazený CLI patrí aktuálnemu agentovi/Mission, nie inému koordinátorovi.", call=True, history="FAIL 4. 9. 2026: hovor zo svojho INDEXUS účtu sa na druhej strane zobrazil ako „Patin Indexus“.", steps=["Zapíšte očakávanú identitu Mission/agenta.", "Uskutočnite outbound hovor na kontrolný telefón.", "Porovnajte zobrazenú identitu."], checks=["Zobrazený CLI bol autorizovaný pre Mission.", "Nezobrazila sa identita iného agenta.", "Opakovaný hovor mal rovnakú správnu identitu.", "History bola priradená skutočnému agentovi."]),
    dict(id="CALL-OUT-09", section="C · ODCHÁDZAJÚCE HOVORY", title="Systém nesmie samovoľne ukončiť aktívny hovor", goal="Stabilný aktívny hovor zostane spojený až do vedomého ukončenia.", call=True, history="FAIL 4. 9. 2026 o 13:59: systém sám ukončil hovor; druhá strana ho vnímala, akoby zložil volaný partner.", steps=["Nadviažte outbound hovor.", "Nechajte ho aktívny aspoň 5 minút bez kliknutí.", "Sledujte SIP, audio a UI.", "Ukončite riadeným spôsobom."], checks=["Hovor sa samovoľne neukončil.", "Audio zostalo obojsmerné.", "UI zostalo aktívne.", "Ukončenie bolo v History správne klasifikované."]),
    dict(id="CALL-IN-01", section="D · PRICHÁDZAJÚCE HOVORY", title="Prichádzajúci hovor — agent prijme a ukončí", goal="Popup, prijatie, audio, End call, History a recording fungujú ako jeden tok.", call=True, steps=["Z testovacieho čísla zavolajte na agenta.", "Prijmite hovor.", "Overte oba smery zvuku.", "Ukončite tlačidlom End call."], checks=["Popup zobrazil správnu identitu.", "Prijatie spojilo audio.", "End call ukončilo obe strany.", "History a recording sa finalizovali."]),
    dict(id="CALL-IN-02", section="D · PRICHÁDZAJÚCE HOVORY", title="Prichádzajúci hovor — zákazník ukončí", goal="Vzdialené BYE okamžite odstráni aktívny stav a dokončí záznam.", call=True, steps=["Prijmite inbound hovor.", "Po overení zvuku nech zákazník zloží.", "Bez ďalšej akcie sledujte UI a History."], checks=["UI sa okamžite ukončilo.", "Agent nezostal v busy/active stave.", "History obsahovala čas a trvanie.", "Recording sa finalizoval podľa politiky."]),
    dict(id="CALL-IN-03", section="D · PRICHÁDZAJÚCE HOVORY", title="Volajúci zruší pred prijatím", goal="Ringing popup sa odstráni a vznikne správny missed/cancelled výsledok.", call=True, steps=["Nechajte inbound hovor zvoniť.", "Pred prijatím nech volajúci zloží.", "Skontrolujte popup, Missed a History."], checks=["Popup zmizol bez zásahu agenta.", "Zvonenie sa zastavilo.", "Missed/History nevytvorili duplicitu.", "Klik na záznam otvoril správnu kartu."]),
    dict(id="CALL-IN-04", section="D · PRICHÁDZAJÚCE HOVORY", title="Agent odmietne prichádzajúci hovor", goal="Odmietnutie ukončí ringing a správne klasifikuje výsledok.", call=True, steps=["Vyvolajte inbound hovor.", "Kliknite odmietnuť.", "Skontrolujte stav volajúceho, popup a History."], checks=["Odmietnutie reagovalo na prvé kliknutie.", "Popup a zvonenie skončili.", "Agent sa vrátil do správneho stavu.", "History mala správny výsledok."]),
    dict(id="CALL-IN-05", section="D · PRICHÁDZAJÚCE HOVORY", title="Neznámy volajúci — vytvorenie a uloženie karty počas hovoru", goal="Číslo je predvyplnené, hovor pokračuje po uložení a ovládanie hovoru zostane dostupné.", call=True, history="FAIL 18. 8. 2026: po uložení novej karty sa karta zavrela, hovor pokračoval, ale tester už nemohol hovor ukončiť; uložený kontakt následne nenašiel.", steps=["Z neznámeho čísla zavolajte na Pulse.", "Prijmite a zvoľte typ kontaktu.", "Počas hovoru vyplňte a uložte novú kartu.", "Pokračujte v hovore a ukončite ho."], checks=["Číslo volajúceho bolo predvyplnené.", "Kontakt sa dal uložiť a neskôr nájsť.", "Uloženie nezakrylo ovládanie hovoru.", "Hovor pokračoval a End call fungovalo.", "History sa priradila novej karte."]),
    dict(id="CALL-IN-06", section="D · PRICHÁDZAJÚCE HOVORY", title="Zmeškaný hovor otvorí správnu kartu", goal="Kliknutie na missed záznam otvorí existujúcu kartu bez broken linku.", call=True, history="Predchádzajúca požiadavka: po kliknutí na zmeškaný hovor otvoriť kartu HP; neskôr správanie fungovalo priamym volaním.", steps=["Nechajte známy kontakt vytvoriť missed hovor.", "Kliknite na záznam v Missed.", "Porovnajte otvorenú kartu s volajúcim."], checks=["Missed obsahoval iba jeden záznam.", "Otvorila sa správna karta.", "Karta existovala a nevrátila 404.", "Callback/volanie bolo možné spustiť."]),
    dict(id="CALL-IN-07", section="D · PRICHÁDZAJÚCE HOVORY", title="Presmerovanie pri odhlásenom agentovi", goal="Hovor ide na mobil iba keď agent nie je prítomný; mobil vidí použiteľnú identitu.", call=True, history="Predchádzajúce výsledky: presmerovanie pri neprihlásenom KO označené OK; dlhé zvonenie desktopu po zrušení a text Private boli neskôr označené OK.", steps=["Nastavte standing forwarding číslo.", "Úplne zatvorte/odhláste Pulse.", "Zavolajte na agenta a prijmite/odmietnite na mobile.", "Zopakujte s otvoreným Pulse."], checks=["Odhlásený agent bol presmerovaný na mobil.", "Desktop súčasne dlho nezvonil.", "Mobil zobrazil číslo/identitu, nie Private.", "Pri online agentovi mal prioritu desk podľa konfigurácie."]),
    dict(id="CALL-IN-08", section="D · PRICHÁDZAJÚCE HOVORY", title="Viackanálové upozornenie bez duplicít", goal="Web/push/SMS podľa konfigurácie upozornia práve raz a bez citlivého obsahu.", call=True, steps=["Povoľte konfigurované notifikačné kanály.", "Vyvolajte jeden inbound hovor.", "Spočítajte webové, push a SMS upozornenia.", "Skontrolujte obsah a redakciu."], checks=["Každý povolený kanál upozornil práve raz.", "Zakázaný kanál neupozornil.", "Obsah neobsahoval neočakávané osobné údaje.", "Notifikácia smerovala správnemu agentovi."]),
    dict(id="MEDIA-01", section="E · MÉDIÁ, HISTÓRIA A NAHRÁVKY", title="Výmena headsetu počas aktívneho hovoru", goal="Zmena zariadenia nahradí stopu alebo zobrazí incident; hovor a ovládanie ostanú funkčné.", call=True, steps=["Začnite aktívny obojsmerný hovor.", "Odpojte pôvodný headset a pripojte druhý.", "Pokračujte v hovore a overte zvuk.", "Skontrolujte Voice & network incidents pri chybe prepnutia."], checks=["Systém detegoval device change.", "Nový mikrofón bol použitý alebo sa zobrazila jasná chyba.", "Pri chybe vznikol audio_device_change_failed incident.", "Hovor sa dal ukončiť a zapísal do History."]),
    dict(id="MEDIA-02", section="E · MÉDIÁ, HISTÓRIA A NAHRÁVKY", title="Jednosmerný alebo chýbajúci zvuk", goal="Aktívny SIP hovor bez médií vytvorí zrozumiteľné upozornenie a incident.", call=True, steps=["V kontrolovanom prostredí zablokujte jeden smer audia.", "Zopakujte bez toku v oboch smeroch.", "Sledujte upozornenie a incidenty."], checks=["Jednosmerný zvuk bol rozpoznaný.", "Žiadny tok zvuku bol rozpoznaný.", "Upozornenie bolo zrozumiteľné.", "Incident bol viazaný na správny hovor."]),
    dict(id="MEDIA-03", section="E · MÉDIÁ, HISTÓRIA A NAHRÁVKY", title="History sa obnoví bez oneskorenia", goal="Nový hovor sa zobrazí po finalizácii bez refreshu a bez minútového čakania.", call=True, history="Predchádzajúca chyba: posledné volanie sa niekedy zobrazilo okamžite a inokedy až po neurčitom čase.", steps=["Otvorte History pred hovorom.", "Uskutočnite a ukončite testovací hovor.", "Sledujte zoznam bez refreshu.", "Obnovte stránku a porovnajte."], checks=["Záznam sa objavil okamžite.", "Nevznikla duplicita.", "Dátum, čas, smer a trvanie sedeli.", "Po refreshi zostal rovnaký záznam."]),
    dict(id="MEDIA-04", section="E · MÉDIÁ, HISTÓRIA A NAHRÁVKY", title="Nahrávanie režimu both", goal="Pri aktívnej politike both sa uloží prehrateľná nahrávka a je viazaná na správny hovor.", call=True, steps=["V Mission nastavte a snapshotujte recording policy both.", "Uskutočnite inbound aj outbound hovor.", "Ukončite raz agentom a raz zákazníkom.", "Overte prehratie z History."], checks=["Oba smery vytvorili nahrávku.", "Oba spôsoby ukončenia ju finalizovali.", "Nahrávka patrila správnej karte/hovoru.", "Prehratie obsahovalo očakávané kanály."]),
    dict(id="MEDIA-05", section="E · MÉDIÁ, HISTÓRIA A NAHRÁVKY", title="Nahrávanie režimu agent_only a vypnuté", goal="Agent-only zachytí iba povolený smer; inactive nevytvorí recording.", call=True, steps=["Otestujte inbound/outbound v Mission s agent_only.", "Overte výslednú zvukovú stopu.", "Zopakujte s recording inactive.", "Skontrolujte History a serverové výsledky."], checks=["Agent-only vytvoril nahrávku iba podľa politiky.", "Inbound aj outbound sa finalizovali.", "Inactive nevytvorilo nahrávku.", "Zmena politiky počas hovoru nezmenila snapshot rozbehnutého hovoru."]),
    # Callback/status
    dict(id="CB-01", section="F · CALLBACKY A PREPLÁNOVANIE", title="Preplánovanie počas hovoru bez zmeny Status Listu", goal="Agent vie naplánovať ďalší kontakt aj keď sa status nezmenil.", call=True, reschedule=True, steps=["Počas hovoru otvorte plánovanie callbacku.", "Nemeňte odpovede Status Listu.", "Zadajte nový dátum, čas a poznámku.", "Uložte a skontrolujte Queue, badge a kartu."], checks=["Preplánovanie bolo dostupné počas hovoru.", "Status sa nemusel meniť.", "Nový termín sa uložil.", "Queue sa obnovila bez refreshu.", "Pôvodný termín nezostal duplicitne."]),
    dict(id="CB-02", section="F · CALLBACKY A PREPLÁNOVANIE", title="Preplánovanie z Queue", goal="Úprava vo fronte sa okamžite prejaví vo všetkých zobrazeniach.", reschedule=True, history="FAIL 4. 9. 2026: partner bol preplánovaný, ale zmena sa nie vždy premietla do Queue.", steps=["V Queue vyberte callback.", "Zmeňte dátum, čas a poznámku.", "Uložte bez refreshu.", "Porovnajte Queue, badge a detail karty."], checks=["Nový termín sa zobrazil v Queue.", "Badge sa aktualizoval.", "Detail karty ukázal rovnaký termín.", "Po refreshi termín zostal.", "Nevznikla duplicita."]),
    dict(id="CB-03", section="F · CALLBACKY A PREPLÁNOVANIE", title="Hromadné preplánovanie", goal="Viac callbackov dostane správny termín a poznámku bez duplicít.", reschedule=True, steps=["Vyberte najmenej tri callbacky.", "Nastavte spoločný nový dátum/čas a poznámku.", "Uložte.", "Overte každý kontakt samostatne."], checks=["Všetky vybrané callbacky sa zmenili.", "Nevybrané zostali bez zmeny.", "Každý termín bol vo fronte iba raz.", "Po refreshi sa výsledok zachoval."]),
    dict(id="CB-04", section="F · CALLBACKY A PREPLÁNOVANIE", title="Queue počty, farby a časové filtre", goal="Omeškané/dnes/tento týždeň/neskôr sú konzistentné so zoznamom.", reschedule=True, steps=["Pripravte callback v každej časovej skupine.", "Prepnite všetky filtre.", "Porovnajte badge s počtom riadkov.", "Skontrolujte farby blízkeho a omeškaného termínu."], checks=["Počty súhlasili so zoznamom.", "Omeškané bolo červené.", "Blízky termín bol oranžový.", "Každý callback bol iba raz.", "Časová zóna Europe/Bratislava bola správna."]),
    dict(id="CB-05", section="F · CALLBACKY A PREPLÁNOVANIE", title="Vytvorenie, zrušenie a okamžité obnovenie", goal="Každá callback mutácia invaliduje Queue, badge aj detail.", reschedule=True, steps=["Vytvorte callback.", "Preplánujte ho.", "Zrušte ho.", "Po každom kroku sledujte tri zobrazenia bez refreshu."], checks=["Vytvorenie sa prejavilo okamžite.", "Preplánovanie sa prejavilo okamžite.", "Zrušenie sa prejavilo okamžite.", "Queue, badge a detail boli konzistentné."]),
    dict(id="SL-01", section="G · STATUS LIST", title="Uloženie a potvrdenie Status Listu", goal="Confirm funguje stabilne a každá úloha má samostatne overiteľný výsledok.", call=True, status_tasks=True, history="FAIL v skoršom teste: Status List sa neuložil a „Yes, confirm“ nefungovalo v Chrome, Edge ani Firefox; po približne hodine začalo fungovať bez známej príčiny.", steps=["Otvorte testovaciu kartu a Status List.", "Vyplňte všetky zobrazené povinné úlohy.", "Kliknite uložiť/confirm a potom Yes, confirm.", "Znovu otvorte kartu a porovnajte odpovede."], checks=["Confirm reagoval na prvé kliknutie.", "Všetky odpovede sa uložili.", "Povinné úlohy boli jasne označené.", "Po znovuotvorení zostali výsledky.", "Nevznikla neočakávaná automatizácia."]),
    dict(id="SL-02", section="G · STATUS LIST", title="Status List a callback v jednom toku", goal="Uloženie odpovedí a preplánovanie sa navzájom nestratia.", call=True, reschedule=True, status_tasks=True, steps=["Počas hovoru vyplňte Status List.", "Zadajte callback.", "Potvrďte Status List.", "Ukončite hovor a overte kartu aj Queue."], checks=["Status List sa uložil.", "Callback sa uložil.", "Queue zobrazila správny termín.", "History obsahovala hovor.", "Každá úloha mala správny výsledok."]),
    dict(id="SL-03", section="G · STATUS LIST", title="Viac možností a podotázky", goal="Konfigurácia otázok zodpovedá Mission a odpovede sa uložia bez straty.", status_tasks=True, history="Predchádzajúca požiadavka: jeden status potreboval viac zvolených možností; v pôvodnej fáze to bolo evidované ako možná fáza 2.", steps=["Vyberte položku s viac možnosťami/podotázkami.", "Označte všetky povolené kombinácie.", "Uložte a znovu otvorte.", "Porovnajte s konfiguráciou Active Pulse verzie."], checks=["UI dovolilo iba nakonfigurované kombinácie.", "Všetky vybrané odpovede sa uložili.", "Podotázky sa zobrazili podľa pravidiel.", "Výsledok prežil refresh."]),
    # Communication and regressions
    dict(id="COM-01", section="H · E-MAIL, SMS A NOTIFIKÁCIE", title="Odoslanie e-mailu a platná M365 relácia", goal="E-mail sa odošle práve raz bez Session Expired pri platnom účte.", history="FAIL 4. 9. 2026 o 14:15: odoslanie hlásilo „Session Expired. Please refresh the page and log in again“ aj po odhlásení a novej kontrole.", steps=["Pripojte platný M365 účet.", "Z testovacej karty odošlite e-mail.", "Zopakujte po refreshi a novom prihlásení.", "Skontrolujte odoslanú poštu a CRM históriu."], checks=["M365 readiness bola úspešná.", "E-mail sa odoslal.", "Nevznikla Session Expired chyba.", "Správa bola práve raz v odoslanej pošte.", "CRM zobrazilo iba jednu notifikáciu/záznam."]),
    dict(id="COM-02", section="H · E-MAIL, SMS A NOTIFIKÁCIE", title="Oslovenie, personalizácia a podpis", goal="Šablóna používa aktuálne údaje a správny osobný/campaign podpis.", history="Predchádzajúce výsledky: oslovenie „Vážený pán“ a KO job position boli neskôr označené OK; po zmene Personnel sa nové dáta v template nepoužili; reply podpis chýbal.", steps=["Zmeňte testovací údaj Personnel/job position oprávneným spôsobom.", "Aplikujte šablónu s oslovením a podpisom.", "Odošlite nový e-mail.", "Odpovedzte na prijatý e-mail."], checks=["Oslovenie zodpovedalo kontaktu.", "Šablóna použila aktuálne údaje.", "Nový e-mail mal správny podpis a telefón.", "Reply mal správny podpis.", "Nevznikli nevyplnené premenné."]),
    dict(id="COM-03", section="H · E-MAIL, SMS A NOTIFIKÁCIE", title="E-mailové upozornenie z automatizácie", goal="Udalosť odošle práve jeden e-mail zo správnej country schránky bez PII v externom upozornení.", steps=["Na kontrolnom kontakte vyvolajte nakonfigurovanú udalosť.", "Skontrolujte príjemcu a odosielateľa.", "Porovnajte predmet a počet správ.", "Skontrolujte CRM audit."], checks=["Prišiel práve jeden e-mail.", "Odosielateľ bol správna country schránka.", "Predmet a obsah zodpovedali konfigurácii.", "Externá notifikácia neobsahovala neočakávané PII."]),
    dict(id="COM-04", section="H · E-MAIL, SMS A NOTIFIKÁCIE", title="SMS upozornenie a poskytovateľ", goal="SMS ide práve raz cez Mission provider a chyba doručenia je zrozumiteľná.", steps=["Použite schválené kontrolné číslo.", "Vyvolajte SMS udalosť.", "Overte poskytovateľa a doručenie.", "Zopakujte s kontrolovanou chybou."], checks=["SMS prišla práve raz.", "Použil sa správny Mission provider.", "Odosielateľ zodpovedal konfigurácii.", "Chyba bola zrozumiteľná bez úniku raw vendor údajov."]),
    dict(id="ACC-01", section="I · PRÍSTUP A REGRESIE", title="KO sa po prihlásení ani refreshi nedostane na Dashboard", goal="Landing page a oprávnenia neukážu reportovací Dashboard neoprávnenej role.", history="Predchádzajúca chyba: KO videl Dashboard; refresh ho tam opakovane pustil. Neskôr refresh scenár označený OK, ale v zápise zostalo aj „Nevyriešené“ pre dashboard.", steps=["Prihláste sa ako KO.", "Skontrolujte landing page.", "Skúste priamu URL Dashboard.", "Obnovte stránku v Pulse aj mimo Pulse."], checks=["KO skončil na povolenej landing page.", "Dashboard nebol v menu.", "Priama URL bola odmietnutá/presmerovaná.", "Refresh oprávnenie neobišiel."]),
    dict(id="ACC-02", section="I · PRÍSTUP A REGRESIE", title="Úprava osobných údajov iba oprávnenou rolou", goal="KO a KO manager nemôžu meniť DB dáta, ale dostanú zrozumiteľný read-only/escalation stav.", history="Predchádzajúca chyba: KO mohol meniť údaje; inokedy zákaz pôsobil ako generická chyba. Tester neskôr pochopil obmedzenie, no požadoval jasnejšie správanie.", steps=["Ako KO otvorte osobné údaje.", "Skúste editáciu a uloženie.", "Zopakujte ako KO manager a DB manager.", "Skontrolujte audit/escalation."], checks=["KO nemohol priamo meniť DB dáta.", "KO manager dodržal nakonfigurované oprávnenie.", "DB manager mohol oprávnenú zmenu.", "Neoprávnený používateľ dostal jasné vysvetlenie."]),
    dict(id="ACC-03", section="I · PRÍSTUP A REGRESIE", title="Denný limit a počítadlá aktivity", goal="Počítadlo započíta iba dovolané hovory a správne odlíši ostatné aktivity.", history="Predchádzajúci výsledok: tester mal viac telefonátov, ale počítadlo sa zvýšilo iba dvakrát; pri e-mailoch počítadlo fungovalo.", steps=["Zapíšte počiatočný stav počítadiel.", "Urobte answered, unanswered a rejected hovor.", "Odošlite testovací e-mail.", "Porovnajte zmenu s pravidlom denného limitu."], checks=["Answered hovor sa započítal.", "Unanswered/rejected sa nezapočítal ako dovolaný.", "E-mail sa započítal iba do správnej metriky.", "Počty sa obnovili bez duplicít."]),
    dict(id="ACC-04", section="I · PRÍSTUP A REGRESIE", title="Mobilný prístup a podporované prostredie", goal="Mobil dostane jasný podporovaný/nepodporovaný stav a nesmie obísť role ani readiness.", history="Predchádzajúce výsledky na Android Samsung Galaxy: INDEXUS sa v Edge/Chrome/Firefox nepodarilo otvoriť, inokedy sa používateľ dostal na Dashboard a aplikácia sa zasekávala. Mobilný Pulse však nie je podporovaný pre hovory.", steps=["Otvorte INDEXUS na schválenom mobilnom zariadení.", "Prihláste sa ako KO.", "Skúste otvoriť Pulse a Dashboard.", "Porovnajte správanie s deklarovanou podporou."], checks=["Bežný INDEXUS zobrazil definované správanie.", "Mobilný Pulse jasne oznámil nepodporované hovory.", "Dashboard oprávnenie sa neobišlo.", "Nevznikla nekonečná slučka alebo zamrznutie."]),
    dict(id="QUEUE-01", section="I · PRÍSTUP A REGRESIE", title="Poradie kontaktov v dennej Queue", goal="Callbacky a nové kontakty s referenciou majú definovanú prioritu.", history="Požiadavka z 18. 8. 2026: poradie volania má byť Callback → HP s referenciou → HP bez referencie; nové referencie sa majú pravidelne dostať vyššie.", steps=["Pripravte kontakt v každej z troch skupín.", "Otvorte/obnovte dennú Queue.", "Porovnajte poradie s pravidlom.", "Pridajte referenciu existujúcemu kontaktu a spustite dostupné preusporiadanie."], checks=["Callbacky boli prvé.", "Kontakty s referenciou boli pred kontaktmi bez referencie.", "Nová referencia ovplyvnila poradie.", "Nevznikli duplicity ani strata kontaktu."]),
    dict(id="COM-05", section="H · E-MAIL, SMS A NOTIFIKÁCIE", title="Iba schválené e-mailové šablóny", goal="Agent vidí iba dohodnuté produkčné šablóny a žiadne testovacie zvyšky.", history="Požadované názvy: „Medical Partner email 01 SK v01 2026_05_26“ a „Medical partner email with information materials attached SK V01 2026_05_26“.", steps=["Otvorte výber šablón v testovacej Mission.", "Vyhľadajte oba schválené názvy.", "Skontrolujte celý zoznam na testovacie/duplicitné šablóny.", "Aplikujte obe schválené šablóny."], checks=["Obe schválené šablóny boli dostupné.", "Nezostali nežiaduce testovacie šablóny.", "Obsah a prílohy zodpovedali názvu.", "Aplikovanie nevytvorilo nevyplnené premenné."]),
    dict(id="CARD-01", section="I · PRÍSTUP A REGRESIE", title="Zmena mena a e-mailu sa prejaví okamžite a v histórii", goal="Uložená karta, šablóny aj história používajú čerstvé údaje bez refreshu.", history="Predchádzajúce výsledky: po zmene mena a e-mailu história ukázala iba meno; e-mail sa inokedy zmenil až po refreshi. Neskôr bola zmena e-mailu označená OK.", steps=["Oprávnenou rolou zmeňte testovacie meno a e-mail.", "Uložte kartu a bez refreshu ju znovu otvorte.", "Skontrolujte History.", "Aplikujte e-mailovú šablónu."], checks=["Karta okamžite ukázala nové meno.", "Karta okamžite ukázala nový e-mail.", "History zaznamenala obe zmeny.", "Šablóna použila aktuálne údaje.", "Po refreshi zostal rovnaký stav."]),
    dict(id="CARD-02", section="I · PRÍSTUP A REGRESIE", title="Úprava poznámky na karte", goal="Existujúcu poznámku možno oprávnene upraviť a zmena sa zachová.", history="Predchádzajúca chyba: chýbala možnosť upraviť poznámku; neskôr označené OK.", steps=["Na testovacej karte vytvorte poznámku.", "Upravte jej text.", "Uložte a znovu otvorte kartu.", "Skontrolujte audit/autora a čas."], checks=["Editácia bola dostupná oprávnenej role.", "Nový text sa uložil.", "Po znovuotvorení zostal aktuálny.", "Audit neukázal nesprávneho autora."]),
    dict(id="UX-01", section="I · PRÍSTUP A REGRESIE", title="Počítadlo aktivity a číslo za lomkou", goal="Tester rozumie obom hodnotám a čísla zodpovedajú nakonfigurovanému dennému cieľu.", history="Otázka z Wordu: „Čo znamená číslo za /?“ Na pôvodnom Pulse screenshote bolo zobrazenie podobné 1/50 bez vysvetlenia.", steps=["Nájdite počítadlo v hornej lište Pulse.", "Otvorte tooltip/pomocný text.", "Urobte aktivitu, ktorá sa má započítať.", "Porovnajte prvé číslo a denný cieľ za lomkou."], checks=["Aktuálna hodnota mala zrozumiteľný názov.", "Hodnota za lomkou bola vysvetlená ako cieľ/limit podľa konfigurácie.", "Po započítateľnej aktivite sa zmenilo správne číslo.", "Tooltip/label nevyžadoval hádanie významu."]),
]

for item in tests:
    scenario(item)

# Summary
new_page("ZÁVEREČNÝ PROTOKOL")
y = heading("Celkové vyhodnotenie testovacieho cyklu", "Testovanie môže byť označené ako úspešné iba vtedy, keď neexistuje otvorený kritický FAIL.")
outcome("cycle", y)
y -= 70
field("cycle_pass_count", "Počet PASS", M, y - 20, 105)
field("cycle_fail_count", "Počet FAIL", M + 120, y - 20, 105)
field("cycle_conditional_count", "Počet s výhradami", M + 240, y - 20, 125)
field("cycle_not_tested_count", "Počet netestovaných", M + 380, y - 20, 125)
y -= 65
field("cycle_blockers", "Kritické blokery — ID testu a stručný popis", M, y - 90, W - 2 * M, 82, True)
y -= 120
field("cycle_summary", "Súhrnná poznámka a odporúčanie k nasadeniu", M, y - 100, W - 2 * M, 92, True)
y -= 135
field("cycle_retest", "Požadované retesty / zodpovedná osoba / termín", M, y - 75, W - 2 * M, 67, True)
y -= 105
field("cycle_signature", "Meno a iniciály testera", M, y - 22, 240)
field("cycle_signed_date", "Dátum uzavretia", M + 265, y - 22, 180)

footer()
c.save()
print(f"created={OUT} pages={page_no} tests={len(tests)}")