// src/lib/pronunciation/diagrams.ts
//
// MOUTH_DIAGRAMS: one simple sagittal (side-view) line-art mouth/tongue
// diagram per TRAP_CATEGORY, per design/03 (neutral, non-photographic,
// abstract line-art). Each diagram carries `altFr`/`altEn` long text
// alternatives describing tongue/teeth/lips position, because the diagram
// itself is never the only carrier of the tip (design/05 §3).

import type { TrapCategory } from '../types.ts';

export interface MouthDiagram {
  viewBox: string;
  paths: readonly string[];
  altFr: string;
  altEn: string;
}

export const MOUTH_DIAGRAMS: Readonly<Record<TrapCategory, MouthDiagram>> = {
  aspirated_h: {
    viewBox: '0 0 120 100',
    paths: [
      // Head/jaw outline (sagittal silhouette).
      'M10,70 Q10,20 60,15 Q100,15 100,55 Q100,80 70,85 Q30,90 10,70 Z',
      // Open glottis / airway at the back of the throat.
      'M78,45 Q85,50 80,60',
      // Arrow showing the breath of air escaping outward.
      'M80,55 L105,58 M98,52 L105,58 L98,64',
    ],
    altFr:
      "Vue de côté de la tête : la gorge est ouverte et une flèche montre un souffle d'air léger qui sort, " +
      'sans vibration des cordes vocales, pour le H anglais aspiré.',
    altEn:
      'Side view of the head: the throat is open and an arrow shows a light puff of air escaping, with no ' +
      'vocal-cord vibration, for the aspirated English H.',
  },
  th: {
    viewBox: '0 0 120 100',
    paths: [
      'M10,70 Q10,20 60,15 Q100,15 100,55 Q100,80 70,85 Q30,90 10,70 Z',
      // Upper and lower teeth as two short parallel ticks.
      'M55,40 L65,40 M55,46 L65,46',
      // Tongue tip reaching forward between the teeth.
      'M40,55 Q50,42 62,43',
      // Small arrow marking the tongue's forward movement.
      'M44,52 L36,58 M40,51 L36,58 L42,60',
    ],
    altFr:
      "Vue de côté : la langue (flèche) avance jusqu'à toucher légèrement le bord des dents du haut et du bas, " +
      "position pour /θ/ et /ð/, au lieu de rester derrière les dents comme pour « s » ou « t ».",
    altEn:
      "Side view: the tongue (arrow) moves forward to lightly touch the edge of the upper and lower teeth — " +
      'the position for /θ/ and /ð/ — instead of staying behind the teeth as for "s" or "t".',
  },
  vowel_length: {
    viewBox: '0 0 120 100',
    paths: [
      'M10,70 Q10,20 60,15 Q100,15 100,55 Q100,80 70,85 Q30,90 10,70 Z',
      // Lips: a short, round shape (narrow, for the long tense vowel).
      'M72,58 Q80,55 86,58 Q80,62 72,58 Z',
      // Duration bars: short bar for /ɪ/ or /ʊ/, long bar for /iː/ or /uː/.
      'M20,88 L30,88',
      'M40,88 L65,88',
    ],
    altFr:
      "Vue de côté avec deux barres sous le menton : une courte pour la voyelle brève et détendue (/ɪ/ ou /ʊ/), " +
      'une longue pour la voyelle tenue et tendue (/iː/ ou /uː/), avec les lèvres étirées ou arrondies selon le son.',
    altEn:
      'Side view with two bars below the jaw: a short one for the brief, relaxed vowel (/ɪ/ or /ʊ/) and a long ' +
      'one for the held, tense vowel (/iː/ or /uː/), with lips stretched or rounded depending on the sound.',
  },
  stress_rhythm: {
    viewBox: '0 0 120 100',
    paths: [
      'M10,70 Q10,20 60,15 Q100,15 100,55 Q100,80 70,85 Q30,90 10,70 Z',
      // Beat dots: one large (stressed syllable), smaller ones (unstressed).
      'M30,88 a4,4 0 1,0 0.1,0',
      'M50,90 a7,7 0 1,0 0.1,0',
      'M75,88 a3,3 0 1,0 0.1,0',
    ],
    altFr:
      "Vue de côté avec des points sous le menton représentant les syllabes : un grand point pour la syllabe " +
      "accentuée (plus longue et plus forte), des points petits pour les syllabes non accentuées, contraste " +
      "absent du rythme régulier du français.",
    altEn:
      'Side view with dots below the jaw representing syllables: one large dot for the stressed syllable ' +
      '(longer and louder), smaller dots for the unstressed syllables — a contrast absent from the even ' +
      'rhythm of French.',
  },
} as const;
