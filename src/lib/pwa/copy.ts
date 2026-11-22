// src/lib/pwa/copy.ts: French mic-permission microcopy (design 04 §7, §10; design 05 §7).
// No imports. Consumed by MicPermissionGate (H2) and the pwa module's own reducer.

export const MIC_PERMISSION_STATES = [
  'unknown',
  'prompt',
  'requesting',
  'granted',
  'denied',
  'unavailable',
  'in_use',
  'insecure',
] as const;
export type MicPermissionState = (typeof MIC_PERMISSION_STATES)[number];

export interface MicCopyEntry {
  titleFr: string;
  bodyFr: string;
  actionFr?: string;
}

// One entry per reducer state, plus the pre-prompt explainer shown before the
// browser's own permission dialog (design 05 §7: "explains why before the
// browser prompt"), and the recovery-steps sheet for a denied permission.
export const MIC_COPY: Record<MicPermissionState, MicCopyEntry> = {
  unknown: {
    titleFr: 'Vérification du micro…',
    bodyFr: "Un instant, on vérifie si le micro est disponible.",
  },
  prompt: {
    titleFr: "On a besoin de ton micro",
    bodyFr:
      "Pour parler avec Alex et t'entendre, Parle-to-Speak doit utiliser ton micro. Rien n'est enregistré sans ton accord.",
    actionFr: 'Activer le micro',
  },
  requesting: {
    titleFr: 'Demande en cours…',
    bodyFr: 'Réponds à la demande du navigateur pour continuer.',
  },
  granted: {
    titleFr: 'Micro activé',
    bodyFr: 'Le micro est prêt. Tu peux parler.',
  },
  denied: {
    titleFr: 'Le micro est bloqué.',
    bodyFr:
      "Tu peux continuer en tapant tes réponses, ou autoriser le micro dans les réglages du navigateur.",
    actionFr: 'Écrire à la place',
  },
  unavailable: {
    titleFr: 'Je ne trouve pas ton micro.',
    bodyFr: 'Vérifie qu’un micro est branché et autorisé, puis réessaie.',
    actionFr: 'Réessayer',
  },
  in_use: {
    titleFr: 'Le micro est déjà utilisé.',
    bodyFr: "Ferme l'autre application qui utilise le micro, puis réessaie.",
    actionFr: 'Réessayer',
  },
  insecure: {
    titleFr: 'Connexion non sécurisée',
    bodyFr: 'Le micro ne fonctionne que sur une connexion sécurisée (https).',
  },
};

export const MIC_DENIED_RECOVERY_STEPS_FR: readonly string[] = [
  'Ouvre les réglages du site dans ton navigateur (souvent une icône de cadenas ou "i" dans la barre d’adresse).',
  'Trouve l’autorisation "Microphone" et passe-la sur "Autoriser".',
  'Recharge la page.',
];

export const MIC_TEXT_MODE_OFFER_FR =
  'Tu peux aussi continuer sans micro : tape tes réponses.';
