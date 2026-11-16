import crypto from "node:crypto";
import { B13_CORPUS, type B13Expected } from "./b13-corpus";
const edge = (n: number, category: typeof B13_CORPUS[number]["category"], input: string, expected: B13Expected) =>
  Object.freeze({ id: `SYN-B14-${n}`, category, input, expected: Object.freeze({ ...expected }) });
/** Append only. Original objects, texts, IDs and all 240 labels remain byte-for-byte unchanged. */
export const B14_CORPUS = Object.freeze([...B13_CORPUS,
  edge(31, "receipt", "K zaslanému návrhu sa zatiaľ nevyjadrujem. Súhlas v tejto chvíli neudeľujem, ale zmluvu ani jej podmienky neodmietam.", B13_CORPUS[11].expected),
  edge(32, "rejection", "Nová ponuka mi nevyhovuje a neprijímam ju. Existujúcu službu neruším a chcem ju naďalej využívať.", B13_CORPUS[16].expected),
  edge(33, "cancellation", "Prosím o riadne ukončenie mojej existujúcej služby k najbližšiemu možnému termínu. Ďakujem za vybavenie.", B13_CORPUS[20].expected),
  edge(34, "complaint", "Podávam výslovnú sťažnosť na vyúčtovanie. Fakturovaná suma je nesprávna, žiadam preverenie a opravu chyby.", B13_CORPUS[25].expected),
  edge(35, "receipt", "Potvrdzujem len doručenie vašej správy. Toto potvrdenie nie je udelením súhlasu; rozhodnutie oznámim až po preštudovaní.", B13_CORPUS[10].expected),
]);
export const B14_CORPUS_SHA256 = crypto.createHash("sha256").update(JSON.stringify(B14_CORPUS)).digest("hex");
export const B14_PROBLEM_IDS = Object.freeze([12, 17, 21, 22, 23, 24, 25, 26].map(n => `SYN-B13-${n}`));
