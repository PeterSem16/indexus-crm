from pathlib import Path
from textwrap import wrap

from reportlab.lib.colors import HexColor, white
from reportlab.lib.pagesizes import A4
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas


OUT = Path(".agents/outputs/nexus_pulse_test_results/NEXUS_Pulse_regresny_testovaci_formular_oprav_SK.pdf")

W, H = A4
M = 42
NAVY = HexColor("#273B42")
TEAL = HexColor("#197B78")
CREAM = HexColor("#FFFAF6")
PAPER = HexColor("#FBFAF8")
RED = HexColor("#B95446")
GREEN = HexColor("#40826B")
AMBER = HexColor("#A2732F")
BLUE = HexColor("#477F91")
LINE = HexColor("#E5DED8")
MUTED = HexColor("#697174")

pdfmetrics.registerFont(TTFont("DejaVu", "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"))
pdfmetrics.registerFont(TTFont("DejaVu-Bold", "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"))

OUT.parent.mkdir(parents=True, exist_ok=True)
c = canvas.Canvas(str(OUT), pagesize=A4, pageCompression=1)
c.setTitle("NEXUS Pulse — regresný testovací formulár opráv")
c.setAuthor("INDEXUS")
form = c.acroForm
page = 0


def wrapped(value, width):
    lines = []
    for paragraph in str(value).split("\n"):
        lines.extend(wrap(paragraph, width=width, break_long_words=False) or [""])
    return lines


def draw_text(value, x, y, size=9, color=NAVY, bold=False, width=90, leading=None):
    c.setFont("DejaVu-Bold" if bold else "DejaVu", size)
    c.setFillColor(color)
    leading = leading or size * 1.36
    for line in wrapped(value, width):
        c.drawString(x, y, line)
        y -= leading
    return y


def footer():
    c.setStrokeColor(LINE)
    c.line(M, 30, W - M, 30)
    c.setFont("DejaVu", 7.5)
    c.setFillColor(MUTED)
    c.drawString(M, 18, "INDEXUS · NEXUS Pulse · regresné testovanie vykonaných opráv")
    c.drawRightString(W - M, 18, f"Strana {page}")


def new_page(section):
    global page
    if page:
        footer()
        c.showPage()
    page += 1
    c.setFillColor(PAPER)
    c.rect(0, 0, W, H, fill=1, stroke=0)
    c.setFillColor(NAVY)
    c.rect(0, H - 38, W, 38, fill=1, stroke=0)
    c.setFont("DejaVu-Bold", 9)
    c.setFillColor(white)
    c.drawString(M, H - 24, "INDEXUS · NEXUS PULSE")
    c.setFont("DejaVu", 8)
    c.drawRightString(W - M, H - 24, section)


def label(value, x, y):
    c.setFont("DejaVu-Bold", 7.5)
    c.setFillColor(MUTED)
    c.drawString(x, y, value.upper())


def badge(value, x, y, color):
    c.setFillColor(color)
    c.roundRect(x, y - 11, 48, 16, 8, fill=1, stroke=0)
    c.setFillColor(white)
    c.setFont("DejaVu-Bold", 7)
    c.drawCentredString(x + 24, y - 5.5, value)


def info_card(title, body, y, accent=TEAL):
    height = max(64, 23 + len(wrapped(body, 82)) * 12)
    c.setFillColor(CREAM)
    c.roundRect(M, y - height, W - 2 * M, height, 8, fill=1, stroke=0)
    c.setFillColor(accent)
    c.roundRect(M, y - height, 4, height, 2, fill=1, stroke=0)
    draw_text(title, M + 15, y - 17, 9, NAVY, True, 80)
    draw_text(body, M + 15, y - 33, 8.5, MUTED, False, 86)
    return y - height - 12


def text_field(name, title, x, y, width, height=22, multiline=False):
    label(title, x, y + height + 5)
    form.textfield(
        name=name,
        tooltip=title,
        x=x,
        y=y,
        width=width,
        height=height,
        borderColor=LINE,
        fillColor=white,
        textColor=NAVY,
        borderWidth=1,
        forceBorder=True,
        fontName="Helvetica",
        fontSize=8,
        fieldFlags=4096 if multiline else 0,
    )


def checkbox(name, text, x, y, width=76):
    form.checkbox(
        name=name,
        tooltip=text,
        x=x,
        y=y - 2,
        buttonStyle="check",
        borderColor=HexColor("#9DA7A7"),
        fillColor=white,
        textColor=TEAL,
        borderWidth=1,
        forceBorder=True,
        size=11,
    )
    draw_text(text, x + 17, y + 1, 8.3, NAVY, False, width, 10)


def outcome(test_id, y):
    c.setFillColor(HexColor("#F2F6F5"))
    c.roundRect(M, y - 28, W - 2 * M, 39, 7, fill=1, stroke=0)
    label("Celkový výsledok — označte iba jednu možnosť", M + 10, y + 1)
    options = [
        ("PASS", "Passed", GREEN),
        ("FAIL", "Neprešiel", RED),
        ("CONDITIONAL", "S výhradami", AMBER),
        ("NOT_TESTED", "Netestované", MUTED),
    ]
    x = M + 10
    for value, text, color in options:
        form.radio(
            name=f"{test_id}_outcome",
            value=value,
            selected=False,
            x=x,
            y=y - 19,
            buttonStyle="circle",
            borderColor=color,
            fillColor=white,
            textColor=color,
            borderWidth=1,
            size=11,
        )
        draw_text(text, x + 16, y - 16, 8, NAVY, False, 20, 10)
        x += 122
    return y - 46


def test_page(test_id, title, prior, fix, steps, checks):
    new_page("NOVÉ REGRESNÉ OTÁZKY")
    y = H - 67
    badge(test_id, M, y, TEAL)
    y = draw_text(title, M + 60, y, 16, NAVY, True, 58, 20) - 8
    y = info_card("Pôvodné zistenie", prior, y, RED)
    y = info_card("Vykonaná oprava", fix, y, TEAL)
    label("Kroky testu", M, y)
    y -= 17
    for index, step in enumerate(steps, 1):
        c.setFillColor(TEAL)
        c.circle(M + 6, y + 2, 7, fill=1, stroke=0)
        c.setFillColor(white)
        c.setFont("DejaVu-Bold", 7)
        c.drawCentredString(M + 6, y - 0.4, str(index))
        y = draw_text(step, M + 20, y + 4, 8.7, NAVY, False, 83, 12) - 5
    y -= 2
    label("Kontrolné body — označte každý splnený bod", M, y)
    y -= 18
    for index, check in enumerate(checks, 1):
        checkbox(f"{test_id}_check_{index}", check, M, y, 82)
        y -= max(19, len(wrapped(check, 82)) * 10 + 9)
    y -= 2
    y = outcome(test_id, y)
    text_field(f"{test_id}_actual", "Skutočný výsledok alebo odchýlka", M, y - 42, W - 2 * M, 36, True)
    text_field(f"{test_id}_evidence", "Dôkaz: čas, posledné 4 číslice, screenshot alebo call ID", M, y - 90, W - 2 * M, 36, True)


# Page 1: purpose and short fixes
new_page("REGRESNÝ FORMULÁR · 11. 9. 2026")
c.setFillColor(TEAL)
c.roundRect(M, H - 143, 43, 43, 11, fill=1, stroke=0)
c.setFillColor(white)
c.setFont("DejaVu-Bold", 22)
c.drawCentredString(M + 21.5, H - 130, "✓")
draw_text("NEXUS Pulse", M + 58, H - 83, 11, TEAL, True, 70)
draw_text("Regresný testovací formulár opráv", M + 58, H - 108, 21, NAVY, True, 45, 25)
draw_text("Nové otázky overujú iba opravy potvrdené po testovaní testerov Seman a Melicha.", M + 58, H - 164, 9.5, MUTED, False, 69, 14)

y = H - 213
y = info_card(
    "Prečo vznikol tento formulár",
    "Po testovaní sme oddelili testy, ktoré prešli, od pozorovaní, pri ktorých bola potvrdená a vykonaná oprava. Tento dokument obsahuje iba nové otázky na overenie týchto opráv.",
    y,
)
label("Stručný prehľad vykonaných opráv", M, y)
y -= 18
for num, title, body in [
    ("1", "Po ring timeoute sa automaticky nevytočí ďalšie číslo.", "Agent môže vytočiť ďalšie číslo iba vlastným kliknutím. Ak ešte beží práca po hovore, najprv sa uloží."),
    ("2", "Obsadený alebo odmietnutý hovor má správny výsledok.", "Nezobrazuje sa ako zavesenie zákazníkom a neuvádza sa falošná dĺžka hovoru."),
    ("3", "Zmeškaný hovor otvorí správnu kartu.", "Pri jednej zhode sa otvorí konkrétny typ karty; pri viacerých zhodách si agent vyberie."),
]:
    c.setFillColor(TEAL)
    c.circle(M + 9, y - 1, 9, fill=1, stroke=0)
    c.setFillColor(white)
    c.setFont("DejaVu-Bold", 8)
    c.drawCentredString(M + 9, y - 4, num)
    draw_text(title, M + 27, y + 3, 9.5, NAVY, True, 80)
    y = draw_text(body, M + 27, y - 12, 8.5, MUTED, False, 82, 12) - 9

y -= 4
y = info_card(
    "Ako vyplniť nový formulár",
    "Pri každom teste označte Passed iba vtedy, ak prejdú všetky kontrolné body. Pri odchýlke zapíšte čas, posledné 4 číslice čísla a priložte screenshot alebo call ID.",
    y,
    BLUE,
)
draw_text("Rozsah: 3 cielené regresné testy · nejde o kompletné opakovanie pôvodného 69-stranového scenára.", M, y - 8, 8.5, MUTED, False, 90)

# Page 2: original results
new_page("VÝSLEDKY PÔVODNÉHO TESTOVANIA")
y = H - 68
y = draw_text("Vyhodnotenie Seman a Melicha", M, y, 18, NAVY, True, 58, 22) - 2
draw_text("Tieto výsledky sú z pôvodných vyplnených formulárov. Nové testy na ďalších stranách sú zatiaľ prázdne.", M, y, 9, MUTED, False, 89, 13)
y -= 39

label("Testy označené ako PASSED", M, y)
y -= 18
y = info_card(
    "Peter Seman",
    "PR-01 až PR-11, PR-13, ONB-01, VER-01; CALL-OUT-01, 02, 03, 04, 06, 08, 09; CALL-IN-01, 02, 03, 04, 06, 07, 08; MEDIA-01 až MEDIA-05; CB-01 až CB-05; SL-01 až SL-03; COM-01 až COM-05; ACC-01 až ACC-04; QUEUE-01; CARD-01, CARD-02 a UX-01.",
    y,
    GREEN,
)
y = info_card(
    "Melicha",
    "CALL-OUT-01, CALL-OUT-02, CALL-OUT-05, CALL-OUT-06, CALL-OUT-09; CALL-IN-01, CALL-IN-02 a CALL-IN-08.",
    y,
    GREEN,
)
label("Problémové alebo nejednoznačné výsledky", M, y)
y -= 18
for test_id, result, body, color in [
    ("CALL-OUT-03", "S výhradami", "Po 30-sekundovom ring timeoute sa objavilo ďalšie vytočenie. Opravené a zaradené do nového formulára.", AMBER),
    ("CALL-OUT-04", "S výhradami", "Obsadená linka sa ukázala ako „customer hung up“ a vznikla falošná dĺžka hovoru. Opravené a zaradené.", AMBER),
    ("CALL-IN-03 / 06", "S výhradami", "Missed call otvoril kartu „osoby“ namiesto správnej karty. Opravené a zaradené.", AMBER),
    ("PR-12", "S výhradami", "Zmena audio zariadenia nezneplatnila Ready. Bez potvrdenej novej opravy; mimo tohto formulára.", RED),
    ("CALL-IN-04", "Neprešiel", "Stará výzva mohla zostať pri timeout/odkazovke. Bez potvrdenej opravy; mimo tohto formulára.", RED),
    ("CALL-IN-05", "S výhradami", "Pri neznámom volajúcom bola hlásená kvalita na začiatku hovoru. Bez potvrdenej opravy; mimo tohto formulára.", RED),
]:
    badge(result.upper() if result != "S výhradami" else "VÝHRADA", M, y, color)
    draw_text(test_id, M + 58, y, 9, NAVY, True, 28)
    y = draw_text(body, M + 58, y - 13, 8.3, MUTED, False, 73, 11) - 8

# Page 3: test identity
new_page("IDENTIFIKÁCIA TESTU")
y = H - 68
y = draw_text("Identifikácia regresného testu", M, y, 18, NAVY, True, 58, 22) - 4
draw_text("Vyplňte pred začatím. Použite len schválené testovacie kontakty a čísla.", M, y, 9, MUTED, False, 84, 13)
y -= 42
text_field("tester", "Meno testera", M, y - 22, 245)
text_field("date", "Dátum a čas testu", M + 265, y - 22, 245)
y -= 70
text_field("environment", "Prostredie / URL", M, y - 22, 245)
text_field("browser", "Prehliadač a verzia", M + 265, y - 22, 245)
y -= 70
text_field("device", "Zariadenie a headset", M, y - 22, 245)
text_field("network", "Sieť (Ethernet / Wi-Fi / VPN)", M + 265, y - 22, 245)
y -= 70
text_field("account", "Testovací účet a rola", M, y - 22, 245)
text_field("mission", "Testovacia Mission / kampaň", M + 265, y - 22, 245)
y -= 76
y = info_card(
    "Pred začatím",
    "Overte, že poznáte dve testovacie čísla A a B, máte dostupnú kartu kliniky alebo nemocnice a viete vyvolať obsadenú linku. Nezadávajte do formulára celé osobné telefónne čísla.",
    y,
    BLUE,
)
text_field("notes", "Poznámka k prostrediu alebo známemu obmedzeniu", M, y - 48, W - 2 * M, 48, True)

test_page(
    "FIX-01",
    "Po ring timeoute sa nevytočí ďalšie číslo automaticky",
    "Melicha videl po ukončení nezodpovedaného hovoru nové vytočenie ďalšieho čísla. Seman potvrdil správny 30-sekundový limit.",
    "Čakajúca požiadavka na ďalší hovor sa spracuje iba v stave idle. Kliknutie agenta počas práce po hovore najprv uloží túto prácu a až potom vytočí zvolené číslo.",
    [
        "Začnite hovor na číslo A a nechajte ho zvoniť až do automatického ukončenia.",
        "Počas zvonenia skúste vybrať alebo požiadať o hovor na číslo B.",
        "Po ukončení čísla A sledujte aspoň 10 sekúnd, či systém sám nezačne volať číslo B.",
        "Až potom kliknite na hovor na číslo B. Ak sa zobrazí práca po hovore, počkajte na jej uloženie.",
    ],
    [
        "Číslo A sa ukončilo po nastavenom ring limite.",
        "Číslo B sa po ukončení A nezačalo vytáčať samo.",
        "Pri vlastnom kliknutí sa zobrazila informácia o dokončení práce po hovore, ak bola aktívna.",
        "Číslo B sa vytáčalo až po vlastnom kliknutí agenta.",
    ],
)

test_page(
    "FIX-02",
    "Obsadený alebo odmietnutý hovor má správny výsledok a nulové trvanie",
    "Pri obsadenej linke sa zobrazilo „customer hung up“ a neuskutočnený hovor mal falošnú dĺžku 10:41.",
    "Systém odlišuje obsadenie, odmietnutie, bez odpovede a technickú chybu. Ak hovor nebol prijatý, neuvádza sa dĺžka hovoru ani zavinenie zákazníkom.",
    [
        "Vytočte kontrolované číslo, ktoré vráti obsadené alebo odmietnuté spojenie.",
        "Počkajte na ukončenie a prečítajte stav zobrazený v Pulse.",
        "Otvorte históriu hovoru pre tento pokus.",
    ],
    [
        "Stav jasne uvádza obsadené, odmietnuté alebo neúspešné spojenie.",
        "Systém nezobrazil text, že hovor ukončil zákazník, ak k spojeniu nedošlo.",
        "História neuvádza nenulovú dĺžku hovoru bez prijatia.",
        "Hovor nie je prezentovaný ako úspešne dokončený.",
    ],
)

test_page(
    "FIX-03",
    "Zmeškaný hovor otvorí správnu kartu",
    "Pri Missed call sa otvorila karta „osoby“, z ktorej nebolo možné volať ani prepnúť na správny typ karty.",
    "Pri jednej zhode sa otvorí konkrétna karta kontaktu. Pri viacerých zhodách systém najprv ponúkne výber a historický zmeškaný hovor nepreberá stav živého hovoru.",
    [
        "Vytvorte alebo vyberte zmeškaný hovor s jednou známou zhodou (napr. klinika alebo nemocnica).",
        "Otvorte ho zo zoznamu Missed calls a overte typ a dostupnosť karty.",
        "Ak máte testovacie číslo priradené viacerým kartám, zopakujte postup a vyberte správnu kartu zo zoznamu.",
    ],
    [
        "Pri jednej zhode sa otvorila správna klinika, nemocnica, osoba alebo spolupracovník.",
        "Karta sa otvorila v bežnom režime a umožňuje dostupné akcie kontaktu.",
        "Pri viacerých zhodách systém nevybral prvú kartu sám, ale zobrazil výber.",
        "Po otvorení sa zmeškaný hovor označil ako vybavený bez vytvorenia živého call stavu.",
    ],
)

# Final page
new_page("ZÁVEREČNÉ VYHODNOTENIE")
y = H - 68
y = draw_text("Záver regresného cyklu", M, y, 18, NAVY, True, 58, 22) - 4
draw_text("Túto stranu vyplňte po dokončení troch nových otázok.", M, y, 9, MUTED, False, 84, 13)
y -= 38
for identifier, label_text in [
    ("FIX-01", "Po ring timeoute sa nevytočí ďalšie číslo automaticky"),
    ("FIX-02", "Obsadený alebo odmietnutý hovor má správny výsledok"),
    ("FIX-03", "Zmeškaný hovor otvorí správnu kartu"),
]:
    c.setFillColor(CREAM)
    c.roundRect(M, y - 34, W - 2 * M, 42, 7, fill=1, stroke=0)
    draw_text(identifier, M + 12, y - 8, 8.5, TEAL, True, 12)
    draw_text(label_text, M + 70, y - 8, 8.6, NAVY, False, 60)
    form.textfield(
        name=f"{identifier}_summary",
        tooltip=f"Zhrnutie {identifier}",
        x=W - M - 102,
        y=y - 24,
        width=90,
        height=20,
        borderColor=LINE,
        fillColor=white,
        textColor=NAVY,
        borderWidth=1,
        forceBorder=True,
        fontName="Helvetica",
        fontSize=8,
    )
    y -= 55
y -= 6
text_field("overall_result", "Celkový výsledok regresného cyklu", M, y - 22, W - 2 * M)
y -= 70
text_field("followup", "Otvorené odchýlky alebo ďalší krok", M, y - 52, W - 2 * M, 52, True)
y -= 88
text_field("approval", "Meno a potvrdenie testera", M, y - 22, 245)
text_field("approval_date", "Dátum potvrdenia", M + 265, y - 22, 245)

footer()
c.save()
print(OUT)