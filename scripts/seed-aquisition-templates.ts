import { pool } from "../server/db";

async function seed() {
  const client = await pool.connect();
  try {
    const existing = await client.query(`SELECT id FROM template_categories WHERE name = 'Aquisition Mission SK'`);
    let categoryId: string;
    
    if (existing.rows.length > 0) {
      categoryId = existing.rows[0].id;
      console.log("Category already exists:", categoryId);
    } else {
      const catRes = await client.query(`
        INSERT INTO template_categories (id, name, description, department_code, icon, color, priority, is_active)
        VALUES (gen_random_uuid(), 'Aquisition Mission SK', 'Emailové predlohy pre akvizičnú misiu - Slovensko', 'sales', 'Target', 'blue', 10, true)
        RETURNING id
      `);
      categoryId = catRes.rows[0].id;
      console.log("Created category:", categoryId);
    }

    const tplCheck = await client.query(`SELECT id, name FROM message_templates WHERE category_id = $1`, [categoryId]);
    if (tplCheck.rows.length > 0) {
      console.log("Templates already exist in this category:");
      tplCheck.rows.forEach((r: any) => console.log("  -", r.name));
      console.log("Skipping seed. Delete them first if you want to re-seed.");
      return;
    }

    const email1Html = `<div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 680px; margin: 0 auto; color: #333333; line-height: 1.6;">
  <div style="background: linear-gradient(135deg, #1e3a5f 0%, #2c5282 100%); padding: 30px 40px; border-radius: 8px 8px 0 0;">
    <h2 style="color: #ffffff; margin: 0; font-size: 20px; font-weight: 600;">Cord Blood Center</h2>
    <p style="color: #a0c4ff; margin: 5px 0 0 0; font-size: 13px;">Laboratories</p>
  </div>
  <div style="padding: 35px 40px; background: #ffffff; border: 1px solid #e2e8f0; border-top: none;">
    <p style="margin-top: 0;">Vážený pán doktor / Vážená pani doktorka {{clinic.doctorLastName}},</p>
    <p>dovoľujem si Vás osloviť v mene spoločnosti <strong>Cord Blood Center</strong>. Naša spoločnosť má záujem o objednávanie si služieb Vašej ambulancie pre svojich klientov.</p>
    <p>Spoločnosť Cord Blood Center už 25 rokov poskytuje služby v oblasti uchovávania pupočníkovej krvi, tkaniva pupočníka a placenty pre možné budúce terapeutické využitie v krajinách Európskej únie a Švajčiarsku.</p>
    <p>V záujme zabezpečenia odbornej a presnej informovanosti našich klientok, považujeme spoluprácu s gynekológmi a pôrodníkmi za mimoriadne dôležitú. Informovanosť a sledovanie stavu darcov krvi, tkanív a buniek zdôrazňuje aj nová európska direktíva <strong>SoHO</strong>, ktorá bude účinná od <strong>7. augusta 2027</strong>.</p>
    <p>Radi by sme Vám preto navrhli spoluprácu, na základe ktorej by si spoločnosť Cord Blood Center pre svoje klientky u Vás objednávala odborné služby.</p>
    <p>Predmetom takto objednávaných služieb by bolo najmä:</p>
    <div style="background: #f7fafc; border-left: 4px solid #2c5282; padding: 15px 20px; margin: 20px 0; border-radius: 0 6px 6px 0;">
      <p style="margin: 0 0 10px 0;"><strong>1. Predpôrodná konzultácia</strong></p>
      <p style="margin: 0 0 15px 0; font-size: 14px; color: #555;">Poskytnutie informácií klientke spoločnosti Cord Blood Center o odbere pupočníkovej krvi, najmä o jeho priebehu, rizikách, kontraindikáciách prípadne význame a praktických náležitostiach.</p>
      <p style="margin: 0 0 10px 0;"><strong>2. Popôrodná konzultácia a vyšetrenie</strong></p>
      <p style="margin: 0; font-size: 14px; color: #555;">Kontrola zdravotného stavu po odbere a konzultácia výsledkov spracovania a testovania odobratej pupočníkovej krvi a ďalšieho odobratého biologického materiálu.</p>
    </div>
    <p>Sme presvedčení, že takáto spolupráca bude prínosom nielen pre obe zmluvné strany, ale predovšetkým pre naše klientky, Vaše pacientky.</p>
    <p>V najbližších dňoch si Vás dovolím telefonicky kontaktovať s cieľom poskytnúť Vám v prípade Vášho záujmu bližšie informácie o možnosti vzájomnej spolupráce.</p>
    <p style="margin-bottom: 0;">S úctou</p>
  </div>
  <div style="padding: 25px 40px; background: #f8fafc; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 8px 8px;">
    <p style="margin: 0; font-weight: 600; color: #1e3a5f;">{{user.fullName}}</p>
    <p style="margin: 3px 0; font-size: 13px; color: #666;">Koordinátor odberov pupočníkovej krvi a perinatálnych tkanív</p>
    <p style="margin: 3px 0; font-size: 13px; color: #666;">Cord Blood Center Laboratories</p>
    <p style="margin: 8px 0 0 0; font-size: 13px;">
      <span style="color: #2c5282;">✆</span> {{user.phone}} &nbsp;&nbsp;
      <span style="color: #2c5282;">✉</span> {{user.email}}
    </p>
  </div>
</div>`;

    const email1Text = `Vážený pán doktor / Vážená pani doktorka {{clinic.doctorLastName}},\n\ndovoľujem si Vás osloviť v mene spoločnosti Cord Blood Center. Naša spoločnosť má záujem o objednávanie si služieb Vašej ambulancie pre svojich klientov.\n\nSpoločnosť Cord Blood Center už 25 rokov poskytuje služby v oblasti uchovávania pupočníkovej krvi, tkaniva pupočníka a placenty pre možné budúce terapeutické využitie v krajinách Európskej únie a Švajčiarsku.\n\nV záujme zabezpečenia odbornej a presnej informovanosti našich klientok, považujeme spoluprácu s gynekológmi a pôrodníkmi za mimoriadne dôležitú. Informovanosť a sledovanie stavu darcov krvi, tkanív a buniek zdôrazňuje aj nová európska direktíva SoHO, ktorá bude účinná od 7. augusta 2027.\n\nRadi by sme Vám preto navrhli spoluprácu, na základe ktorej by si spoločnosť Cord Blood Center pre svoje klientky u Vás objednávala odborné služby.\n\nPredmetom takto objednávaných služieb by bolo najmä:\n\n1. Predpôrodná konzultácia. Poskytnutie informácií klientke spoločnosti Cord Blood Center o odbere pupočníkovej krvi, najmä o jeho priebehu, rizikách, kontraindikáciách prípadne význame a praktických náležitostiach.\n\n2. Popôrodná konzultácia a vyšetrenie. Kontrola zdravotného stavu po odbere a konzultácia výsledkov spracovania a testovania odobratej pupočníkovej krvi a ďalšieho odobratého biologického materiálu.\n\nSme presvedčení, že takáto spolupráca bude prínosom nielen pre obe zmluvné strany, ale predovšetkým pre naše klientky, Vaše pacientky.\n\nV najbližších dňoch si Vás dovolím telefonicky kontaktovať s cieľom poskytnúť Vám v prípade Vášho záujmu bližšie informácie o možnosti vzájomnej spolupráce.\n\nS úctou\n{{user.fullName}}\nKoordinátor odberov pupočníkovej krvi a perinatálnych tkanív\nCord Blood Center Laboratories\n{{user.phone}}\n{{user.email}}`;

    await client.query(`
      INSERT INTO message_templates (id, name, description, type, format, subject, content, content_html, category_id, language, is_default, priority, is_active, tags)
      VALUES (gen_random_uuid(), 'Objednávanie služieb - prvý kontakt', 'Úvodný email pre lekára/ambulanciu - predstavenie CBC a návrh spolupráce', 'email', 'html', 'Objednávanie služieb - Cord Blood Center', $1, $2, $3, 'sk', true, 1, true, ARRAY['aquisition', 'first-contact', 'sk'])
    `, [email1Text, email1Html, categoryId]);
    console.log("Created template 1: Objednávanie služieb - prvý kontakt");

    const pricingTable = `<table style="width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 14px;">
      <thead>
        <tr style="background: #1e3a5f; color: #ffffff;">
          <th style="padding: 12px 15px; text-align: left; border: 1px solid #2c5282;">Služba</th>
          <th style="padding: 12px 15px; text-align: right; border: 1px solid #2c5282; width: 80px;">Cena €</th>
        </tr>
      </thead>
      <tbody>
        <tr style="background: #f7fafc;"><td style="padding: 10px 15px; border: 1px solid #e2e8f0;">Medicínska odborná konzultácia odberu pupočníkovej krvi</td><td style="padding: 10px 15px; border: 1px solid #e2e8f0; text-align: right; font-weight: 600;">130</td></tr>
        <tr><td style="padding: 10px 15px; border: 1px solid #e2e8f0;">Medicínska odborná konzultácia odberu placentárnej krvi</td><td style="padding: 10px 15px; border: 1px solid #e2e8f0; text-align: right; font-weight: 600;">25</td></tr>
        <tr style="background: #f7fafc;"><td style="padding: 10px 15px; border: 1px solid #e2e8f0;">Medicínska odborná konzultácia odberu tkaniva pupočníka</td><td style="padding: 10px 15px; border: 1px solid #e2e8f0; text-align: right; font-weight: 600;">25</td></tr>
        <tr><td style="padding: 10px 15px; border: 1px solid #e2e8f0;">Medicínska odborná konzultácia odberu placenty</td><td style="padding: 10px 15px; border: 1px solid #e2e8f0; text-align: right; font-weight: 600;">25</td></tr>
        <tr style="background: #f7fafc;"><td style="padding: 10px 15px; border: 1px solid #e2e8f0;">Konzultačná odborná pohotovosť do odberu krvi a tkanív</td><td style="padding: 10px 15px; border: 1px solid #e2e8f0; text-align: right; font-weight: 600;">40</td></tr>
        <tr><td style="padding: 10px 15px; border: 1px solid #e2e8f0;">Medicínska odborná konzultácia s Klientkou o výsledkoch odberu, spracovania a vyšetrenia pupočníkovej krvi</td><td style="padding: 10px 15px; border: 1px solid #e2e8f0; text-align: right; font-weight: 600;">130</td></tr>
        <tr style="background: #f7fafc;"><td style="padding: 10px 15px; border: 1px solid #e2e8f0;">Medicínska odborná konzultácia s Klientkou o výsledkoch odberu, spracovania a vyšetrenia placentárnej krvi</td><td style="padding: 10px 15px; border: 1px solid #e2e8f0; text-align: right; font-weight: 600;">25</td></tr>
        <tr><td style="padding: 10px 15px; border: 1px solid #e2e8f0;">Medicínska odborná konzultácia s Klientkou o výsledkoch odberu, spracovania a vyšetrenia tkaniva pupočníka</td><td style="padding: 10px 15px; border: 1px solid #e2e8f0; text-align: right; font-weight: 600;">25</td></tr>
        <tr style="background: #f7fafc;"><td style="padding: 10px 15px; border: 1px solid #e2e8f0;">Medicínska odborná konzultácia s Klientkou o výsledkoch odberu, spracovania a vyšetrenia tkaniva placenty</td><td style="padding: 10px 15px; border: 1px solid #e2e8f0; text-align: right; font-weight: 600;">25</td></tr>
      </tbody>
    </table>`;

    const pricingText = `Služba / Cena\nMedicínska odborná konzultácia odberu pupočníkovej krvi - 130€\nMedicínska odborná konzultácia odberu placentárnej krvi - 25€\nMedicínska odborná konzultácia odberu tkaniva pupočníka - 25€\nMedicínska odborná konzultácia odberu placenty - 25€\nKonzultačná odborná pohotovosť do odberu krvi a tkanív - 40€\nMedicínska odborná konzultácia s Klientkou o výsledkoch odberu, spracovania a vyšetrenia pupočníkovej krvi - 130€\nMedicínska odborná konzultácia s Klientkou o výsledkoch odberu, spracovania a vyšetrenia placentárnej krvi - 25€\nMedicínska odborná konzultácia s Klientkou o výsledkoch odberu, spracovania a vyšetrenia tkaniva pupočníka - 25€\nMedicínska odborná konzultácia s Klientkou o výsledkoch odberu, spracovania a vyšetrenia tkaniva placenty - 25€`;

    const headerBlock = `<div style="background: linear-gradient(135deg, #1e3a5f 0%, #2c5282 100%); padding: 30px 40px; border-radius: 8px 8px 0 0;">
    <h2 style="color: #ffffff; margin: 0; font-size: 20px; font-weight: 600;">Cord Blood Center</h2>
    <p style="color: #a0c4ff; margin: 5px 0 0 0; font-size: 13px;">Laboratories</p>
  </div>`;

    const signatureBlock = `<div style="padding: 25px 40px; background: #f8fafc; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 8px 8px;">
    <p style="margin: 0; font-weight: 600; color: #1e3a5f;">{{user.fullName}}</p>
    <p style="margin: 3px 0; font-size: 13px; color: #666;">Koordinátor odberov pupočníkovej krvi a perinatálnych tkanív</p>
    <p style="margin: 3px 0; font-size: 13px; color: #666;">Cord Blood Center Laboratories</p>
    <p style="margin: 8px 0 0 0; font-size: 13px;">
      <span style="color: #2c5282;">✆</span> {{user.phone}} &nbsp;&nbsp;
      <span style="color: #2c5282;">✉</span> {{user.email}}
    </p>`;

    const email2aHtml = `<div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 680px; margin: 0 auto; color: #333333; line-height: 1.6;">
  ${headerBlock}
  <div style="padding: 35px 40px; background: #ffffff; border: 1px solid #e2e8f0; border-top: none;">
    <p style="margin-top: 0;">Vážený pán/pani {{clinic.doctorTitle}} {{clinic.doctorLastName}},</p>
    <p>Na základe nášho telefonického dohovoru Vám zasielam podrobnejšie informácie o službách, ktoré by sme si chceli pre naše klientky objednávať. V prílohe je odporúčaný postup k jednotlivým činnostiam.</p>
    <p>Jednotlivé služby pre jednu klientku by si naša spoločnosť objednávala v cene od <strong>300 €</strong> do <strong>450 €</strong>, podľa toho, ktoré služby si klientka u spoločnosti Cord Blood Center objednala (odber pupočníkovej krvi, placentárnej krvi, tkaniva pupočníka a tkaniva placenty).</p>
    ${pricingTable}
    <p>Takúto spoluprácu spoločnosť Cord Blood Center uzatvára s gynekologickými ambulanciami v krajinách Európskej únii v ktorých pôsobí, s cieľom zabezpečiť presné a odborné informovanie klientiek, ktoré sú v zmysle zákona darkyňami. Nová regulácia <strong>SoHO</strong> účinná od <strong>7. augusta 2027</strong>, okrem iného, kladie dôraz na správne a presné informovanie darcov krvi, tkanív a buniek.</p>
    <p>Veríme, že budeme môcť využiť Vaše služby a tešíme sa na spoluprácu.</p>
    <p style="margin-bottom: 0;">S pozdravom</p>
  </div>
  ${signatureBlock}
    <p style="margin: 10px 0 0 0; font-size: 12px; color: #999;">📎 Príloha: Manual for Medical Partner (PDF)</p>
  </div>
</div>`;

    const email2aText = `Vážený pán/pani {{clinic.doctorTitle}} {{clinic.doctorLastName}},\n\nNa základe nášho telefonického dohovoru Vám zasielam podrobnejšie informácie o službách, ktoré by sme si chceli pre naše klientky objednávať. V prílohe je odporúčaný postup k jednotlivým činnostiam.\n\nJednotlivé služby pre jednu klientku by si naša spoločnosť objednávala v cene od 300€ do 450€, podľa toho, ktoré služby si klientka u spoločnosti Cord Blood Center objednala (odber pupočníkovej krvi, placentárnej krvi, tkaniva pupočníka a tkaniva placenty).\n\n${pricingText}\n\nTakúto spoluprácu spoločnosť Cord Blood Center uzatvára s gynekologickými ambulanciami v krajinách Európskej únii v ktorých pôsobí, s cieľom zabezpečiť presné a odborné informovanie klientiek, ktoré sú v zmysle zákona darkyňami. Nová regulácia SoHO účinná od 7. augusta 2027, okrem iného, kladie dôraz na správne a presné informovanie darcov krvi, tkanív a buniek.\n\nVeríme, že budeme môcť využiť Vaše služby a tešíme sa na spoluprácu.\n\nS pozdravom\n{{user.fullName}}\nKoordinátor odberov pupočníkovej krvi a perinatálnych tkanív\nCord Blood Center Laboratories`;

    await client.query(`
      INSERT INTO message_templates (id, name, description, type, format, subject, content, content_html, category_id, language, is_default, priority, is_active, tags)
      VALUES (gen_random_uuid(), 'Informácie o službách - cenník s rozsahom', 'Follow-up email po telefonáte s cenníkom služieb (rozsah 300-450€). Príloha: Manual for Medical Partner', 'email', 'html', 'Informácie o službách - Cord Blood Center', $1, $2, $3, 'sk', false, 2, true, ARRAY['aquisition', 'follow-up', 'pricing', 'sk'])
    `, [email2aText, email2aHtml, categoryId]);
    console.log("Created template 2A: Informácie o službách - cenník s rozsahom");

    const email2bHtml = `<div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 680px; margin: 0 auto; color: #333333; line-height: 1.6;">
  ${headerBlock}
  <div style="padding: 35px 40px; background: #ffffff; border: 1px solid #e2e8f0; border-top: none;">
    <p style="margin-top: 0;">Vážený pán/pani {{clinic.doctorTitle}} {{clinic.doctorLastName}},</p>
    <p>Na základe nášho telefonického dohovoru Vám zasielam podrobnejšie informácie o službách ktoré by sme si chceli pre naše klientky objednávať. V prílohe je odporúčaný postup k jednotlivým činnostiam.</p>
    ${pricingTable}
    <p>Jednotlivé služby by si naša spoločnosť objednávala podľa toho ktoré služby si klientka u spoločnosti Cord Blood Center objednala.</p>
    <p>Takúto spoluprácu spoločnosť Cord Blood Center uzatvára so všetkými gynekologickými ambulanciami v krajinách Európskej únii v ktorých pôsobí, s cieľom zabezpečiť presné a odborné informovanie klientiek, ktoré sú v zmysle zákona darkyňami. Nová regulácia <strong>SoHO</strong>, okrem iného, kladie dôraz na správne a presné informovanie darcov krvi, tkanív a buniek.</p>
    <p>Veríme, že budeme môcť využiť Vaše služby a tešíme sa na spoluprácu.</p>
    <p style="margin-bottom: 0;">S pozdravom</p>
  </div>
  ${signatureBlock}
    <p style="margin: 10px 0 0 0; font-size: 12px; color: #999;">📎 Príloha: Manual for Medical Partner (PDF)</p>
  </div>
</div>`;

    const email2bText = `Vážený pán/pani {{clinic.doctorTitle}} {{clinic.doctorLastName}},\n\nNa základe nášho telefonického dohovoru Vám zasielam podrobnejšie informácie o službách ktoré by sme si chceli pre naše klientky objednávať. V prílohe je odporúčaný postup k jednotlivým činnostiam.\n\n${pricingText}\n\nJednotlivé služby by si naša spoločnosť objednávala podľa toho ktoré služby si klientka u spoločnosti Cord Blood Center objednala.\n\nTakúto spoluprácu spoločnosť Cord Blood Center uzatvára so všetkými gynekologickými ambulanciami v krajinách Európskej únii v ktorých pôsobí, s cieľom zabezpečiť presné a odborné informovanie klientiek, ktoré sú v zmysle zákona darkyňami. Nová regulácia SoHO, okrem iného, kladie dôraz na správne a presné informovanie darcov krvi, tkanív a buniek.\n\nVeríme, že budeme môcť využiť Vaše služby a tešíme sa na spoluprácu.\n\nS pozdravom\n{{user.fullName}}\nKoordinátor odberov pupočníkovej krvi a perinatálnych tkanív\nCord Blood Center Laboratories`;

    await client.query(`
      INSERT INTO message_templates (id, name, description, type, format, subject, content, content_html, category_id, language, is_default, priority, is_active, tags)
      VALUES (gen_random_uuid(), 'Informácie o službách - cenník podľa objednávky', 'Follow-up email po telefonáte s cenníkom služieb (bez celkovej sumy). Príloha: Manual for Medical Partner', 'email', 'html', 'Informácie o službách - Cord Blood Center', $1, $2, $3, 'sk', false, 3, true, ARRAY['aquisition', 'follow-up', 'pricing-simple', 'sk'])
    `, [email2bText, email2bHtml, categoryId]);
    console.log("Created template 2B: Informácie o službách - cenník podľa objednávky");

    const email3Html = `<div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 680px; margin: 0 auto; color: #333333; line-height: 1.6;">
  ${headerBlock}
  <div style="padding: 35px 40px; background: #ffffff; border: 1px solid #e2e8f0; border-top: none;">
    <p style="margin-top: 0;">Vážený pán/pani {{clinic.doctorTitle}} {{clinic.doctorLastName}},</p>
    <p>zasielame Vám <strong>zmluvu o spolupráci</strong>. Súčasťou zmluvy sú dve prílohy — <em>Cenník poskytovaných služieb</em> a <em>Manuál služieb medicínskeho spolupracovníka</em>.</p>
    <div style="background: #f0f7ff; border: 1px solid #bee3f8; padding: 20px 25px; margin: 20px 0; border-radius: 8px;">
      <p style="margin: 0 0 10px 0; font-weight: 600; color: #1e3a5f;">📋 Ďalší postup:</p>
      <p style="margin: 0; font-size: 14px;">V prípade, že máte záujem podpísať s nami rámcovú zmluvu, prosíme o vyplnenie a podpis priložených zmlúv. Jednu kópiu zašlite späť v <strong>návratovej obálke</strong>.</p>
    </div>
    <p>V prípade otázok k zneniu zmluvy nás neváhajte kontaktovať.</p>
    <p style="margin-bottom: 0;">S pozdravom</p>
  </div>
  ${signatureBlock}
    <p style="margin: 10px 0 0 0; font-size: 12px; color: #999;">📎 Prílohy: Zmluva o spolupráci (2x), Cenník, Manuál, Návratová obálka</p>
  </div>
</div>`;

    const email3Text = `Vážený pán/pani {{clinic.doctorTitle}} {{clinic.doctorLastName}},\n\nzasielame Vám zmluvu o spolupráci. Súčasťou zmluvy sú dve prílohy Cenník poskytovaných služieb a Manuál služieb medicínskeho spolupracovníka.\n\nV prípade, že máte záujem podpísať s nami rámcovú zmluvu, prosíme o vyplnenie a podpis priložených zmlúv. Jednu kópiu zašlite späť v návratovej obálke.\n\nV prípade otázok k zneniu zmluvy nás neváhajte kontaktovať.\n\nS pozdravom\n{{user.fullName}}\nKoordinátor odberov pupočníkovej krvi a perinatálnych tkanív\nCord Blood Center Laboratories\n{{user.phone}}\n{{user.email}}`;

    await client.query(`
      INSERT INTO message_templates (id, name, description, type, format, subject, content, content_html, category_id, language, is_default, priority, is_active, tags)
      VALUES (gen_random_uuid(), 'Zmluva o spolupráci - zaslanie zmluvy', 'Email so zmluvou o spolupráci, cenníkom a manuálom. Prílohy: zmluva (2x), cenník, manuál, návratová obálka', 'email', 'html', 'Zmluva o spolupráci - Cord Blood Center', $1, $2, $3, 'sk', false, 4, true, ARRAY['aquisition', 'contract', 'sk'])
    `, [email3Text, email3Html, categoryId]);
    console.log("Created template 3: Zmluva o spolupráci");

    console.log("\n✅ All 4 templates created in category 'Aquisition Mission SK'");
  } catch (err) {
    console.error("Error seeding templates:", err);
  } finally {
    client.release();
    await pool.end();
  }
}

seed();
