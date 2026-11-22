// src/lib/levels/shadowing.ts: A1-B1 shadowing sentences.
// Short survival sentences; targetTraps reference real TrapIds from unit B's
// catalog (src/lib/pronunciation). No sensitive words.

import type { ShadowingItem } from '../types.ts';

export const SHADOWING_ITEMS: readonly ShadowingItem[] = [
  { id: 'sh-a1-1', level: 'A1', textEn: 'Hello, how are you?', translationFr: 'Bonjour, comment vas-tu ?', targetTraps: ['h_dropped'] },
  { id: 'sh-a1-2', level: 'A1', textEn: 'I would like a coffee, please.', translationFr: 'Je voudrais un café, s\'il vous plaît.', targetTraps: ['ih_vs_iy'] },
  { id: 'sh-a1-3', level: 'A1', textEn: 'This is my house.', translationFr: "C'est ma maison.", targetTraps: ['dh_as_z', 'h_dropped'] },
  { id: 'sh-a1-4', level: 'A1', textEn: 'I am happy today.', translationFr: "Je suis content aujourd'hui.", targetTraps: ['h_dropped'] },
  { id: 'sh-a2-1', level: 'A2', textEn: 'I think this is a good idea.', translationFr: "Je pense que c'est une bonne idée.", targetTraps: ['th_as_s', 'dh_as_z'] },
  { id: 'sh-a2-2', level: 'A2', textEn: 'We live near the beach.', translationFr: 'Nous habitons près de la plage.', targetTraps: ['ih_vs_iy'] },
  { id: 'sh-a2-3', level: 'A2', textEn: 'He is hungry and thirsty.', translationFr: 'Il a faim et soif.', targetTraps: ['h_dropped', 'th_as_t'] },
  { id: 'sh-a2-4', level: 'A2', textEn: 'Can you help me with this?', translationFr: "Peux-tu m'aider avec ça ?", targetTraps: ['dh_as_z', 'weak_forms'] },
  { id: 'sh-b1-1', level: 'B1', textEn: "I've been living here for three years.", translationFr: "J'habite ici depuis trois ans.", targetTraps: ['th_as_f', 'weak_forms'] },
  { id: 'sh-b1-2', level: 'B1', textEn: 'Thank you for thinking of everything.', translationFr: "Merci d'avoir pensé à tout.", targetTraps: ['th_as_s', 'th_as_t'] },
  { id: 'sh-b1-3', level: 'B1', textEn: "I'm not sure I understood that correctly.", translationFr: "Je ne suis pas sûr d'avoir bien compris.", targetTraps: ['uh_vs_uw', 'stress_misplaced'] },
  { id: 'sh-b1-4', level: 'B1', textEn: 'She usually arrives an hour early.', translationFr: 'Elle arrive généralement une heure en avance.', targetTraps: ['h_inserted', 'h_dropped'] },
];

export function shadowingFor(level: ShadowingItem['level']): readonly ShadowingItem[] {
  return SHADOWING_ITEMS.filter((item) => item.level === level);
}
