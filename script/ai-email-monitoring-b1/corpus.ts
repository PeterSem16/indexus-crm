/** Synthetic only: no customer, mailbox, person or account identifiers. */
export const B1_EMAIL_CASES = [
  { id: "SYN-B1-RECEIPT-REQUEST", content: "Prosím, potvrďte prijatie tohto e-mailu. O ponuke sa rozhodnem neskôr.",
    expected: { wantsConsent: false, wantsToCancel: false, doesNotAcceptContract: false } },
  { id: "SYN-B1-RECEIPT-ACK", content: "Potvrdzujem prijatie vášho e-mailu. Ďakujem za doručené informácie.",
    expected: { wantsConsent: false, wantsToCancel: false, doesNotAcceptContract: false } },
  { id: "SYN-B1-CONSENT", content: "Súhlasím s navrhnutou zmluvou o uchovaní pupočníkovej krvi a prijímam jej podmienky.",
    expected: { wantsConsent: true, wantsToCancel: false, doesNotAcceptContract: false } },
  { id: "SYN-B1-CONTRACT-REJECT", content: "S navrhovanou zmluvou nesúhlasím a jej podmienky odmietam. Zmluvu som zatiaľ nepodpísal.",
    expected: { wantsConsent: false, doesNotAcceptContract: true } },
  { id: "SYN-B1-CANCEL", content: "Žiadam o zrušenie mojej existujúcej zmluvy. Neželám si pokračovať v službe.",
    expected: { wantsConsent: false, wantsToCancel: true } },
  { id: "SYN-B1-NOT-YET", content: "Zatiaľ nedávam súhlas. Najprv prosím potvrďte prijatie dokumentov, rozhodnem sa až neskôr.",
    expected: { wantsConsent: false, wantsToCancel: false } },
  { id: "SYN-B1-QUOTE", content: "Vo vašom vzore bolo slovo „súhlasím“. Ja však súhlas neudeľujem a o podmienkach sa ešte rozhodnem.",
    expected: { wantsConsent: false, wantsToCancel: false } },
  { id: "SYN-B1-THANKS", content: "Ďakujem za vysvetlenie. Konečné rozhodnutie vám oznámim budúci týždeň.",
    expected: { wantsConsent: false, wantsToCancel: false, doesNotAcceptContract: false } },
] as const;
