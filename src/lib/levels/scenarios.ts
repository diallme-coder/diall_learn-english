// src/lib/levels/scenarios.ts: the 4 B1-B2 guided-roleplay scenarios.
// Each hint triple gives exactly 3 realistic starter phrases (HintTriple is a
// 3-tuple in types.ts) with a French explanation shown on tap.

import type { Hint, Scenario } from '../types.ts';

export const SCENARIOS: readonly Scenario[] = [
  {
    id: 'cafe',
    titleEn: 'At the Café',
    titleFr: 'Au café',
    levels: ['A2', 'B1', 'B2'],
    aiRoleEn: 'Alex, a friendly barista at a busy café',
    settingFr: "Tu es au comptoir d'un café et tu commandes une boisson.",
    userGoalFr: "Commande une boisson et réponds aux questions d'Alex sans te bloquer.",
    openingLineEn: 'Hi there! What can I get you today?',
    hints: [
      {
        level: 'B1',
        hints: [
          { id: 'cafe-b1-1', en: 'Can I have a flat white, please?', fr: 'Je peux avoir un café crème, s\'il vous plaît ?', explanationFr: '« Can I have... » est une façon polie et très courante de commander.' },
          { id: 'cafe-b1-2', en: 'Could I get that to go?', fr: "Je peux l'avoir à emporter ?", explanationFr: '« To go » = à emporter ; très utilisé dans les cafés anglophones.' },
          { id: 'cafe-b1-3', en: 'Do you have any oat milk?', fr: "Avez-vous du lait d'avoine ?", explanationFr: 'Utile pour préciser une option sans bloquer la commande.' },
        ],
      },
      {
        level: 'B2',
        hints: [
          { id: 'cafe-b2-1', en: 'Could I get a flat white with an extra shot, please?', fr: 'Je peux avoir un café crème avec une dose supplémentaire ?', explanationFr: '« An extra shot » = une dose de café supplémentaire.' },
          { id: 'cafe-b2-2', en: "I'll have whatever you'd recommend.", fr: 'Je prendrai ce que vous recommandez.', explanationFr: 'Une façon naturelle de laisser le barista choisir pour toi.' },
          { id: 'cafe-b2-3', en: 'Is there a loyalty card I could sign up for?', fr: "Y a-t-il une carte de fidélité à laquelle je pourrais m'inscrire ?", explanationFr: '« Sign up for » = s\'inscrire à quelque chose.' },
        ],
      },
    ],
  },
  {
    id: 'job_interview',
    titleEn: 'Job Interview',
    titleFr: "Entretien d'embauche",
    levels: ['B1', 'B2'],
    aiRoleEn: 'Jordan, a hiring manager interviewing you for a marketing role',
    settingFr: "Tu passes un entretien d'embauche en anglais pour un poste de marketing.",
    userGoalFr: 'Présente-toi et réponds aux questions de Jordan avec assurance.',
    openingLineEn: 'Thanks for coming in. So, tell me a bit about yourself.',
    hints: [
      {
        level: 'B1',
        hints: [
          { id: 'job-b1-1', en: "I've worked in marketing for three years.", fr: "Je travaille dans le marketing depuis trois ans.", explanationFr: 'Structure utile : « I\'ve worked for + durée » pour une expérience qui continue.' },
          { id: 'job-b1-2', en: "I'm a quick learner and I enjoy teamwork.", fr: "J'apprends vite et j'aime le travail d'équipe.", explanationFr: 'Une phrase simple et sûre pour décrire tes qualités.' },
          { id: 'job-b1-3', en: 'Could you tell me more about the team?', fr: 'Pourriez-vous m\'en dire plus sur l\'équipe ?', explanationFr: 'Poser une question montre de l\'intérêt sans te mettre en difficulté.' },
        ],
      },
      {
        level: 'B2',
        hints: [
          { id: 'job-b2-1', en: "What drew me to this role is the chance to lead campaigns end to end.", fr: "Ce qui m'a attiré vers ce poste, c'est la possibilité de gérer des campagnes de bout en bout.", explanationFr: '« What drew me to… » = ce qui m\'a attiré vers…' },
          { id: 'job-b2-2', en: "I'd say my biggest strength is turning data into a clear story.", fr: 'Je dirais que ma plus grande force est de transformer des données en un récit clair.', explanationFr: 'Une réponse structurée pour « What is your biggest strength? ».' },
          { id: 'job-b2-3', en: 'Could you walk me through what success looks like in this role?', fr: 'Pourriez-vous m\'expliquer à quoi ressemble le succès dans ce poste ?', explanationFr: '« Walk me through » = expliquer étape par étape.' },
        ],
      },
    ],
  },
  {
    id: 'customer_service',
    titleEn: 'Customer Service Call',
    titleFr: 'Appel au service client',
    levels: ['B1', 'B2'],
    aiRoleEn: 'Sam, a customer service agent for an online shop',
    settingFr: 'Tu appelles le service client pour un problème de livraison.',
    userGoalFr: 'Explique le problème et obtiens une solution.',
    openingLineEn: 'Hello, thanks for calling. How can I help you today?',
    hints: [
      {
        level: 'B1',
        hints: [
          { id: 'cs-b1-1', en: "My order hasn't arrived yet.", fr: "Ma commande n'est pas encore arrivée.", explanationFr: 'Phrase simple pour signaler le problème dès le début.' },
          { id: 'cs-b1-2', en: 'Could you check the status for me?', fr: 'Pourriez-vous vérifier le statut pour moi ?', explanationFr: 'Une demande polie pour obtenir une mise à jour.' },
          { id: 'cs-b1-3', en: 'What are my options?', fr: 'Quelles sont mes options ?', explanationFr: 'Utile quand tu veux connaître les solutions possibles.' },
        ],
      },
      {
        level: 'B2',
        hints: [
          { id: 'cs-b2-1', en: "I was expecting this to arrive three days ago, so I'd like an update.", fr: "Je m'attendais à ce que ça arrive il y a trois jours, donc j'aimerais une mise à jour.", explanationFr: 'Donne le contexte avant la demande, un ton plus naturel.' },
          { id: 'cs-b2-2', en: 'Would it be possible to get a refund instead of a replacement?', fr: 'Serait-il possible d\'obtenir un remboursement plutôt qu\'un remplacement ?', explanationFr: '« Would it be possible to… » adoucit une demande.' },
          { id: 'cs-b2-3', en: 'Could you confirm that in an email, just so I have it in writing?', fr: 'Pourriez-vous confirmer cela par email, pour que je l\'aie par écrit ?', explanationFr: 'Utile pour garder une trace écrite d\'un accord.' },
        ],
      },
    ],
  },
  {
    id: 'small_talk',
    titleEn: 'Small Talk',
    titleFr: 'Discussion informelle',
    levels: ['A2', 'B1', 'B2'],
    aiRoleEn: 'Robin, a neighbour you run into in the hallway',
    settingFr: 'Tu croises ton voisin Robin dans le couloir et vous discutez un peu.',
    userGoalFr: "Fais la conversation sur la météo, le week-end ou l'actualité légère.",
    openingLineEn: "Oh hey! Good to see you. How's it going?",
    hints: [
      {
        level: 'B1',
        hints: [
          { id: 'small-b1-1', en: "Not bad, thanks! How about you?", fr: 'Pas mal, merci ! Et toi ?', explanationFr: 'Réponse courte et naturelle qui relance la conversation.' },
          { id: 'small-b1-2', en: 'Did you have a good weekend?', fr: 'Tu as passé un bon week-end ?', explanationFr: 'Un sujet sûr pour relancer une discussion informelle.' },
          { id: 'small-b1-3', en: "This weather is crazy, isn't it?", fr: 'Ce temps est fou, non ?', explanationFr: '« isn\'t it? » est une façon courante de chercher l\'accord de l\'autre.' },
        ],
      },
      {
        level: 'B2',
        hints: [
          { id: 'small-b2-1', en: "I've been pretty busy, but can't complain.", fr: "J'ai été assez occupé, mais je ne peux pas me plaindre.", explanationFr: 'Une réponse idiomatique courante à « How are you? ».' },
          { id: 'small-b2-2', en: 'Any plans for the long weekend coming up?', fr: 'Des projets pour le long week-end qui arrive ?', explanationFr: 'Montre de l\'intérêt tout en restant léger.' },
          { id: 'small-b2-3', en: "I keep meaning to try that new place down the street.", fr: "J'ai toujours l'intention d'essayer ce nouvel endroit au bout de la rue.", explanationFr: '« I keep meaning to… » = j\'ai toujours l\'intention de, sans jamais le faire.' },
        ],
      },
    ],
  },
];

export function getScenario(id: Scenario['id']): Scenario | undefined {
  return SCENARIOS.find((s) => s.id === id);
}

export function hintsFor(id: Scenario['id'], level: Scenario['levels'][number]): Scenario['hints'][number]['hints'] | undefined {
  const scenario = getScenario(id);
  if (!scenario) return undefined;
  // B1/B2 only have explicit tiers; a C1 (or A1) request falls back to the
  // closest tier below it so callers never get undefined for a level the
  // scenario happens to also run at.
  const exact = scenario.hints.find((h) => h.level === level);
  if (exact) return exact.hints;
  const fallbackOrder = ['B2', 'B1'] as const;
  for (const tier of fallbackOrder) {
    const found = scenario.hints.find((h) => h.level === tier);
    if (found) return found.hints;
  }
  return undefined;
}

export function getHint(id: string): Hint | undefined {
  for (const scenario of SCENARIOS) {
    for (const tier of scenario.hints) {
      const found = tier.hints.find((h) => h.id === id);
      if (found) return found;
    }
  }
  return undefined;
}
