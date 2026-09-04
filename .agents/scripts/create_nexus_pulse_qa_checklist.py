import fitz
from pathlib import Path

OUT = Path(".agents/outputs/NEXUS_Pulse_Checklist_pre_externeho_testera_SK.pdf")
FONT = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
FONT_BOLD = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"

tests = [
    ("Vstupná kontrola pripravenosti",
     "Pri vstupe cez menu aj hornú ikonu sa zobrazí diagnostika. Agent Workspace zostane neprístupný, kým neprejdú všetky povinné kontroly."),
    ("Blokovanie nepodporovaného alebo starého stavu",
     "Firefox, offline režim alebo nezabezpečené spojenie zobrazia blokovaný stav. Staré „Ready for calls“ zo sessionStorage nesmie umožniť vstup."),
    ("Mikrofón, zariadenia a testovací zvuk",
     "Kontrola rozpozná vstup aj výstup. Potvrdenie zvuku je možné až po jeho prehratí a samotné zaškrtnutie nesmie obísť ostatné kontroly."),
    ("Oznámenia a bezpečný návrat",
     "Povolenie oznámení sa správne vyhodnotí. Zamietnutie je upozornenie, nie tichý bypass. „Späť do INDEXUS“ vráti používateľa bez označenia kontroly za úspešnú."),
    ("Stavová ikona NEXUS Pulse",
     "Horná ikona správne mení stav/farbu (kontrola, pripravené, upozornenie, blokované) a po kliknutí otvorí diagnostiku."),
    ("SIP registrácia a automatické obnovenie",
     "Po prihlásení sa SIP zaregistruje. Po krátkom výpadku siete/WSS sa stav zmení a po obnovení sa registrácia vráti bez ručného refreshu."),
    ("Odchádzajúci hovor",
     "Overiť postup: pripájanie → zvonenie → aktívny hovor → ukončenie. Neúspešný alebo zrušený hovor nesmie zostať visieť v aktívnom stave."),
    ("Prichádzajúci hovor",
     "Zobrazí sa správne meno/číslo. Prijatie spojí zvuk, odmietnutie alebo zrušenie volajúcim odstráni okno zvonenia."),
    ("Kontrola kvality zvuku počas hovoru",
     "Obojsmerný zvuk je vyhodnotený ako funkčný. Jednosmerný alebo chýbajúci zvuk zobrazí zrozumiteľné upozornenie aj pri nadviazanom SIP hovore."),
    ("Naplánovanie a hromadné preplánovanie callbackov",
     "Naplánovať viac callbackov naraz. Nový dátum, čas a poznámka sa uložia; pôvodný termín sa nenachádza duplicitne."),
    ("Callback fronta, počty a časové filtre",
     "Počty súhlasia so zoznamom pre omeškané/dnes/tento týždeň/neskôr. Blízky termín je oranžový, omeškaný červený; callback sa zobrazí iba raz."),
    ("Okamžité obnovenie callbackov",
     "Po vytvorení, preplánovaní alebo zrušení sa fronta, badge a detail kontaktu aktualizujú bez odhlásenia alebo ručného obnovenia stránky."),
    ("E-mailové upozornenie",
     "Na kontrolnom kontakte vyvolať udalosť s e-mailovým upozornením. Správa príde práve raz, zo správnej schránky, so správnym predmetom a bez neočakávaných osobných údajov."),
    ("SMS upozornenie",
     "Na kontrolnom čísle vyvolať SMS upozornenie. SMS príde práve raz cez správneho poskytovateľa; chyba doručenia sa zobrazí zrozumiteľne."),
    ("Viackanálové upozornenie na prichádzajúci hovor",
     "Pri testovacom prichádzajúcom hovore overiť povolené kanály (webové oznámenie, mobilné push/SMS podľa konfigurácie) a skontrolovať, že nevznikajú duplicity."),
    ("Technické požiadavky v onboardingovom e-maile",
     "Nový onboardingový e-mail obsahuje Chrome/Edge, mikrofón a zvuk, oznámenia, USB headset, HTTPS/WSS, WebRTC/UDP, STUN a kroky pred začiatkom zmeny."),
    ("Verzia NEXUS Pulse v kampani",
     "V detaile kampane sa nastavenie verzie Pulse zobrazí, dá sa uložiť a po obnovení stránky zostane zachované."),
]

doc = fitz.open()
margin = 42
page_w, page_h = fitz.paper_size("a4")
teal = (0.08, 0.34, 0.38)
navy = (0.06, 0.20, 0.34)
green = (0.10, 0.56, 0.38)
light = (0.95, 0.98, 0.97)
grey = (0.35, 0.39, 0.42)

def add_text(page, rect, text, size=9, bold=False, color=(0, 0, 0), align=0):
    fontname = "DVB" if bold else "DV"
    return page.insert_textbox(rect, text, fontsize=size, fontname=fontname,
                               fontfile=FONT_BOLD if bold else FONT,
                               color=color, align=align, lineheight=1.15)

def add_text_widget(page, name, rect, multiline=False, fontsize=9):
    page.draw_rect(rect, color=(0.65, 0.72, 0.72), fill=(1, 1, 1), width=0.8)
    w = fitz.Widget()
    w.field_name = name
    w.field_type = fitz.PDF_WIDGET_TYPE_TEXT
    w.rect = rect
    w.text_font = "Helv"
    w.text_fontsize = fontsize
    w.field_value = ""
    w.field_flags = fitz.PDF_TX_FIELD_IS_MULTILINE if multiline else 0
    w.field_label = name
    w.field_fill_color = (1, 1, 1)
    w.field_border_color = (0.65, 0.72, 0.72)
    w.field_border_width = 0.8
    page.add_widget(w)

def add_checkbox(page, name, x, y):
    page.draw_rect(fitz.Rect(x, y, x + 13, y + 13), color=teal, fill=(1, 1, 1), width=1)
    w = fitz.Widget()
    w.field_name = name
    w.field_type = fitz.PDF_WIDGET_TYPE_CHECKBOX
    w.rect = fitz.Rect(x, y, x + 13, y + 13)
    w.field_value = "Off"
    w.field_label = name
    w.field_border_color = teal
    w.field_fill_color = (1, 1, 1)
    w.field_border_width = 1
    page.add_widget(w)

def header(page, page_no):
    page.insert_font(fontname="DV", fontfile=FONT)
    page.insert_font(fontname="DVB", fontfile=FONT_BOLD)
    page.draw_rect(fitz.Rect(0, 0, page_w, 54), color=navy, fill=navy)
    add_text(page, fitz.Rect(margin, 16, page_w-margin, 42),
             "NEXUS Pulse — checklist pre externého testera", 15, True, (1, 1, 1))
    add_text(page, fitz.Rect(page_w-100, page_h-25, page_w-margin, page_h-10),
             f"Strana {page_no}", 7.5, False, grey, 2)

def add_test(page, number, title, instruction, y):
    h = 181
    page.draw_rect(fitz.Rect(margin, y, page_w-margin, y+h), color=(0.78, 0.84, 0.84),
                   fill=light, width=0.8)
    page.draw_circle((margin+18, y+20), 11, color=green, fill=green)
    add_text(page, fitz.Rect(margin+8, y+12, margin+28, y+29), str(number), 9, True, (1,1,1), 1)
    add_text(page, fitz.Rect(margin+36, y+10, page_w-margin-8, y+31), title, 11, True, navy)
    add_text(page, fitz.Rect(margin+15, y+37, page_w-margin-15, y+72), instruction, 8.5, False, grey)
    labels = [("Prešiel", 0), ("Neprešiel", 1), ("S výhradami", 2), ("Netestované", 3)]
    x = margin + 15
    for label, idx in labels:
        add_checkbox(page, f"test_{number}_status_{idx}", x, y+82)
        add_text(page, fitz.Rect(x+18, y+81, x+91, y+98), label, 8, False, navy)
        x += 112 if idx < 2 else 122
    add_text(page, fitz.Rect(margin+15, y+106, page_w-margin-15, y+121), "Poznámka testera:", 8, True, navy)
    add_text_widget(page, f"test_{number}_poznamka", fitz.Rect(margin+15, y+123, page_w-margin-15, y+169), True, 8)

# Cover / tester data
p = doc.new_page(width=page_w, height=page_h)
header(p, 1)
add_text(p, fitz.Rect(margin, 82, page_w-margin, 118), "Kontrola hlavných úprav NEXUS Pulse", 21, True, teal)
add_text(p, fitz.Rect(margin, 126, page_w-margin, 174),
         "Vyplniteľný formulár pre funkčné overenie zmien. Pri každom teste označte iba jeden výsledok a doplňte poznámku, najmä pri chybe alebo výhrade.",
         10, False, grey)
p.draw_rect(fitz.Rect(margin, 200, page_w-margin, 390), color=(0.75,0.82,0.82), fill=light)
fields = [("Meno testera", "tester_meno"), ("Dátum testovania", "tester_datum"),
          ("Prostredie / URL", "tester_prostredie"), ("Prehliadač a verzia", "tester_prehliadac"),
          ("Testovací účet / rola", "tester_ucet")]
y = 220
for label, name in fields:
    add_text(p, fitz.Rect(margin+18, y, margin+175, y+18), label, 9, True, navy)
    add_text_widget(p, name, fitz.Rect(margin+180, y-3, page_w-margin-18, y+21), False, 9)
    y += 32
add_text(p, fitz.Rect(margin, 425, page_w-margin, 448), "Odporúčaný spôsob hlásenia chyby", 12, True, teal)
add_text(p, fitz.Rect(margin, 455, page_w-margin, 535),
         "Uveďte číslo testu, presný čas, použitý účet a rolu, kroky vedúce k chybe, očakávaný a skutočný výsledok. Priložte snímku obrazovky; pri probléme s hovorom aj volané číslo a približný čas hovoru.",
         9.5, False, grey)

for idx in range(0, len(tests), 3):
    p = doc.new_page(width=page_w, height=page_h)
    header(p, 2 + idx // 3)
    y = 72
    for n in range(idx, min(idx+3, len(tests))):
        add_test(p, n+1, tests[n][0], tests[n][1], y)
        y += 194

# Final summary
p = doc.new_page(width=page_w, height=page_h)
header(p, doc.page_count)
add_text(p, fitz.Rect(margin, 82, page_w-margin, 112), "Celkové vyhodnotenie", 18, True, teal)
for i, label in enumerate(["Testovanie prešlo", "Testovanie neprešlo", "Prešlo s výhradami"]):
    add_checkbox(p, f"celkovy_vysledok_{i}", margin+5, 130+i*30)
    add_text(p, fitz.Rect(margin+25, 128+i*30, page_w-margin, 149+i*30), label, 10, True, navy)
add_text(p, fitz.Rect(margin, 235, page_w-margin, 255), "Súhrnná poznámka:", 10, True, navy)
add_text_widget(p, "celkova_poznamka", fitz.Rect(margin, 262, page_w-margin, 430), True, 9)
add_text(p, fitz.Rect(margin, 462, margin+175, 482), "Podpis / iniciály testera:", 9, True, navy)
add_text_widget(p, "tester_podpis", fitz.Rect(margin+180, 455, page_w-margin, 485), False, 9)

OUT.parent.mkdir(parents=True, exist_ok=True)
doc.set_metadata({
    "title": "NEXUS Pulse — checklist pre externého testera",
    "subject": "Vyplniteľný kontrolný formulár NEXUS Pulse",
    "author": "INDEXUS",
})
doc.save(OUT, garbage=4, deflate=True)
print(f"Created {OUT} ({doc.page_count} pages)")