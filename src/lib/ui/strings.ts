// src/lib/ui/strings.ts: UI copy table. Every key has a non-empty `fr`; `bi`/`en` are
// progressive enhancements for B1-B2 (bilingual) and C1 (English-only) screens.
// No imports from src/lib/types.ts here: this module is pure data + a tiny picker.

export type UiLangMode = 'fr' | 'bi' | 'en';

export interface StringVariant {
  fr: string;
  bi?: string;
  en?: string;
}

const STRINGS_DATA = {
  // ───────── Onboarding ─────────
  onboardingWelcome: { fr: 'Bienvenue sur Parle-to-Speak', bi: 'Bienvenue · Welcome', en: 'Welcome' },
  onboardingMicAsk: { fr: 'On a besoin du micro', bi: 'On a besoin du micro · We need the microphone', en: 'We need your microphone' },
  onboardingMicExplain: {
    fr: "Le micro sert à t'entendre parler anglais, pour te corriger. Rien n'est gardé sur cet appareil.",
    bi: "Le micro sert à t'entendre parler anglais · Used to hear your English and give feedback.",
    en: 'Used to hear your spoken English and give feedback.',
  },
  ageGateTitle: { fr: 'Quel âge as-tu ?', bi: 'Quel âge as-tu ? · How old are you?', en: 'How old are you?' },
  ageGateUnder15: { fr: "Cette application n'est pas pour les moins de 15 ans.", en: 'This app is not for under-15s.' },
  consentTitle: { fr: 'Avant de commencer', bi: 'Avant de commencer · Before we start', en: 'Before we start' },
  consentBody: {
    fr: "Ton audio et tes transcriptions sont envoyés à OpenAI (transcription, voix) et à Anthropic ou OpenAI (conversation) pour être traités. Rien n'est « jamais gardé » par ces prestataires.",
    en: 'Your audio and transcripts are sent to OpenAI (transcription, voice) and Anthropic or OpenAI (conversation) for processing.',
  },
  consentAccept: { fr: "J'accepte", bi: "J'accepte · I accept", en: 'I accept' },

  // ───────── CEFR level names (unit H2) ─────────
  levelNameA1: { fr: 'Débutant', en: 'Beginner' },
  levelNameA2: { fr: 'Élémentaire', en: 'Elementary' },
  levelNameB1: { fr: 'Intermédiaire', en: 'Intermediate' },
  levelNameB2: { fr: 'Intermédiaire avancé', en: 'Upper intermediate' },
  levelNameC1: { fr: 'Avancé', en: 'Advanced' },

  // ───────── Practice mode labels (design 02 §6) ─────────
  modeShadowing: { fr: 'Répète après moi', bi: 'Répète après moi · Shadowing', en: 'Shadowing' },
  modeRoleplay: { fr: 'Jeu de rôle', bi: 'Jeu de rôle · Roleplay', en: 'Roleplay' },
  modeDebate: { fr: 'Débat libre', bi: 'Débat libre · Debate', en: 'Debate' },

  // ───────── Nav labels ─────────
  navHome: { fr: 'Accueil', bi: 'Accueil · Home', en: 'Home' },
  navPractice: { fr: 'Pratiquer', bi: 'Pratiquer · Practice', en: 'Practice' },
  navPronounce: { fr: 'Prononcer', bi: 'Prononcer · Pronounce', en: 'Pronounce' },
  navProgress: { fr: 'Progrès', bi: 'Progrès · Progress', en: 'Progress' },

  // ───────── Session states (one per sessionMachine state) ─────────
  stateIdle: { fr: 'Appuie pour parler', bi: 'Appuie pour parler · Tap to talk', en: 'Tap to talk' },
  stateListening: { fr: "Je t'écoute", bi: "Je t'écoute · Listening", en: 'Listening' },
  stateThinking: { fr: 'Je réfléchis…', bi: 'Je réfléchis… · Thinking', en: 'Thinking…' },
  stateSpeaking: { fr: 'Alex parle', bi: 'Alex parle · Alex is talking', en: 'Alex is speaking' },
  stateError: { fr: 'Oups, un souci', bi: 'Oups, un souci · Something went wrong', en: 'Something went wrong' },
  stateOffline: { fr: 'Tu es hors ligne', bi: 'Hors ligne · Offline', en: "You're offline" },
  stateMicDenied: { fr: 'Le micro est bloqué', bi: 'Micro bloqué · Mic blocked', en: 'Microphone blocked' },

  // ───────── Error ladder (design 04 §7) ─────────
  speechLadder1: { fr: "Je n'ai pas bien entendu. Tu peux répéter ?", en: "Sorry, I didn't catch that. Could you say it again?" },
  speechLadder2: { fr: "Essaie avec l'une de ces phrases.", en: 'Try one of these.' },
  speechLadder3: { fr: 'On essaie autrement ?', en: 'Shall we try another way?' },
  speechLadderFrenchOnly: {
    fr: "J'aimerais t'entendre en anglais ! Essaie juste les premiers mots.",
    en: "I'd love to hear that in English! Try just the first few words.",
  },
  micDenied: { fr: 'Le micro est bloqué.', en: 'The microphone is blocked.' },
  micNotFound: { fr: 'Je ne trouve pas ton micro.', en: "I can't find your microphone." },
  noisyEnvironment: { fr: 'Il y a beaucoup de bruit.', en: "It's quite noisy here." },
  networkSlow: { fr: 'Un instant…', en: 'One moment…' },
  networkSlowDetail: { fr: 'La connexion est lente.', en: 'The connection is slow.' },
  offlineError: { fr: 'Tu es hors ligne.', en: "You're offline." },
  serverError: { fr: 'Oups, un souci de notre côté.', en: 'Something went wrong on our side.' },
  rateLimited: { fr: "Un peu trop vite ! On fait une courte pause.", en: "A little too fast! Let's take a short pause." },
  asrLowConfidence: { fr: 'Pas sûr de ce mot.', en: 'Not sure about that word.' },
  ladderTextMode: { fr: 'Écrire la réponse', bi: 'Écrire · Type instead', en: 'Type instead' },

  // ───────── Side-card microcopy (Franglais) ─────────
  sideCardTitlePrefix: { fr: 'Tu as dit', bi: 'Tu as dit · You said', en: 'You said' },
  sideCardBodyPrefix: { fr: 'En anglais, dis', bi: 'En anglais · In English, say', en: 'In English, say' },
  sideCardHear: { fr: 'Écouter', bi: 'Écouter · Hear', en: 'Hear' },
  sideCardSave: { fr: 'Garder', bi: 'Garder · Save', en: 'Save' },
  sideCardDismiss: { fr: 'Fermer', bi: 'Fermer · Dismiss', en: 'Dismiss' },
  sideCardNotFrench: { fr: "Ce n'est pas du français", en: 'This is not French' },
  sideCardCollapsedPill: { fr: '1 mot', en: '1 word' },

  // ───────── Settings labels ─────────
  settingsSpeed06: { fr: 'Vitesse 0,6×', en: 'Speed 0.6×' },
  settingsSpeed085: { fr: 'Vitesse 0,85×', en: 'Speed 0.85×' },
  settingsSpeed1: { fr: 'Vitesse normale', en: 'Normal speed' },
  settingsTextAnswerMode: { fr: 'Mode réponse écrite', bi: 'Mode écrit · Text-answer mode', en: 'Text-answer mode' },
  settingsSideCardTimeout: {
    fr: 'Fermer automatiquement les cartes Franglais',
    en: 'Auto-collapse Franglais side-cards',
  },
  settingsSilenceAnnouncements: {
    fr: "Annoncer le silence pendant l'enregistrement",
    en: 'Announce silence while recording',
  },
  settingsCaptions: { fr: 'Sous-titres', bi: 'Sous-titres · Captions', en: 'Captions' },
  settingsSignOut: { fr: 'Se déconnecter', en: 'Sign out' },

  // ───────── Privacy page labels ─────────
  privacyTitle: { fr: 'Confidentialité', bi: 'Confidentialité · Privacy', en: 'Privacy' },
  privacyDisclosure: {
    fr: "L'application ne garde pas l'audio dans sa propre base de données.",
    en: "The app does not keep audio in its own database.",
  },
  privacyExport: { fr: 'Exporter mes données', en: 'Export my data' },
  privacyDelete: { fr: 'Supprimer mon compte', en: 'Delete my account' },
  privacyDeleteConfirm: { fr: 'Tape SUPPRIMER pour confirmer', en: 'Type SUPPRIMER to confirm' },

  // ───────── Highlight legend (design 04 §6) ─────────
  highlightOk: { fr: 'Bien', en: 'Good' },
  highlightWarn: { fr: 'Presque', en: 'Almost' },
  highlightError: { fr: 'À retravailler', en: 'Needs work' },
  highlightUnsure: { fr: 'Pas sûr', en: 'Not sure' },

  // ───────── Misc shared microcopy ─────────
  retry: { fr: 'Réessayer', bi: 'Réessayer · Try again', en: 'Try again' },
  interrupt: { fr: 'Interrompre', bi: 'Interrompre · Interrupt', en: 'Interrupt' },
  silenceNudge: { fr: 'Prends ton temps', bi: 'Prends ton temps · Take your time', en: 'Take your time.' },
  endSession: { fr: 'Terminer', bi: 'Terminer · End', en: 'End' },

  // ───────── Shared chrome / buttons (unit H2) ─────────
  back: { fr: 'Retour', bi: 'Retour · Back', en: 'Back' },
  next: { fr: 'Suivant', bi: 'Suivant · Next', en: 'Next' },
  skip: { fr: 'Passer', bi: 'Passer · Skip', en: 'Skip' },
  continueLabel: { fr: 'Continuer', bi: 'Continuer · Continue', en: 'Continue' },
  save: { fr: 'Enregistrer', en: 'Save' },
  cancel: { fr: 'Annuler', en: 'Cancel' },
  loading: { fr: 'Chargement…', en: 'Loading…' },
  updateAvailable: { fr: 'Une nouvelle version est prête.', en: 'A new version is ready.' },
  updateReload: { fr: 'Recharger', en: 'Reload' },
  navSettings: { fr: 'Réglages', bi: 'Réglages · Settings', en: 'Settings' },

  // ───────── Home (unit H2) ─────────
  homeGreeting: { fr: 'Bonjour', en: 'Hello' },
  homeStreakSuffix: { fr: 'jours', en: 'days' },
  homeContinueLabel: { fr: 'CONTINUER', en: 'CONTINUE' },
  homeResume: { fr: 'Reprendre', bi: 'Reprendre · Resume', en: 'Resume' },
  homeDrillCardTitle: { fr: 'Défi du jour · 2 min', en: 'Daily challenge · 2 min' },
  homeDrillStart: { fr: 'Commencer', en: 'Start' },
  homeWeakPhonemePrefix: { fr: 'Ton point faible :', en: 'Your weak point:' },
  homeWorkOn: { fr: 'Travailler', en: 'Work on it' },
  homeEmptyTitle: { fr: 'Ta première conversation, 3 minutes', en: 'Your first conversation, 3 minutes' },
  homeOfflineHero: {
    fr: 'Hors ligne : le défi du jour est disponible.',
    en: 'Offline: the daily challenge is still available.',
  },
  homeMicDeniedCta: { fr: 'Autoriser le micro', en: 'Allow the microphone' },

  // ───────── Onboarding (unit H2) ─────────
  onboardingWelcomeBody: {
    fr: 'Parle anglais sans avoir peur de te tromper.',
    en: 'Speak English without fear of making mistakes.',
  },
  onboardingStart: { fr: 'Commencer', en: 'Start' },
  onboardingMicAllow: { fr: 'Autoriser', en: 'Allow' },
  onboardingMicLater: { fr: 'Plus tard', en: 'Later' },
  ageGateBand1517: { fr: '15-17 ans', en: '15-17 years old' },
  ageGateBand18: { fr: '18 ans et plus', en: '18 and over' },
  ageGateUnder15Option: { fr: 'Moins de 15 ans', en: 'Under 15' },
  ageGateContinue: { fr: 'Continuer', en: 'Continue' },
  consentPrivacyLink: { fr: 'En savoir plus sur la confidentialité', en: 'Learn more about privacy' },
  consentDecline: { fr: 'Pas maintenant', en: 'Not now' },
  goalTitle: { fr: "Pourquoi l'anglais ?", en: 'Why English?' },
  goalWork: { fr: 'Travail', en: 'Work' },
  goalTravel: { fr: 'Voyage', en: 'Travel' },
  goalExam: { fr: 'Examen', en: 'Exam' },
  goalFun: { fr: 'Plaisir', en: 'Fun' },
  placementTitle: { fr: 'Test de niveau', en: 'Placement quiz' },
  placementQuestionCounterPrefix: { fr: 'Question', en: 'Question' },
  placementDontKnow: { fr: 'Je ne sais pas', en: "I don't know" },
  placementSelfSelectCta: { fr: 'Choisir mon niveau moi-même', en: 'Pick my own level' },
  placementSelfSelectTitle: { fr: 'Choisis ton niveau', en: 'Choose your level' },
  placementResultTitle: { fr: 'Ton niveau de départ', en: 'Your starting level' },
  placementResultStartWith: { fr: 'On commence par :', en: "We'll start with:" },
  placementResultCta: { fr: "C'est parti", en: "Let's go" },
  placementResultChange: { fr: 'Changer de niveau', en: 'Change level' },
  signInTitle: { fr: 'Garder ta progression', en: 'Keep your progress' },
  signInBody: {
    fr: 'Crée un compte pour sauvegarder ton niveau et parler avec Alex.',
    en: 'Create an account to save your level and talk with Alex.',
  },
  signInEmailLabel: { fr: 'Adresse e-mail', en: 'Email address' },
  signInSendCode: { fr: 'Recevoir le code', en: 'Send code' },
  signInCodeLabel: { fr: 'Code reçu par e-mail', en: 'Code from your email' },
  signInVerify: { fr: 'Valider', en: 'Verify' },
  signInSkip: { fr: 'Continuer sans compte', en: 'Continue without an account' },
  signInError: { fr: "Une erreur s'est produite. Réessaie.", en: 'Something went wrong. Try again.' },
  signInCodeSentNotice: { fr: 'Code envoyé. Vérifie ta boîte mail.', en: 'Code sent. Check your inbox.' },

  // ───────── Shadowing (unit H2) ─────────
  shadowingPhraseCounterPrefix: { fr: 'Phrase', en: 'Sentence' },
  shadowingYourTry: { fr: 'Ton essai :', en: 'Your try:' },
  shadowingListen: { fr: 'Écoute', en: 'Listen' },
  shadowingLegend: {
    fr: 'Souligné ondulé = presque ; souligné double = à travailler.',
    en: 'Wavy underline = almost; double underline = needs work.',
  },
  shadowingSeeTip: { fr: 'Voir l’astuce de bouche', en: 'See the mouth tip' },
  shadowingIntelligibilityLabel: {
    fr: 'Vérification de compréhension',
    bi: 'Vérification de compréhension · Intelligibility check',
    en: 'Intelligibility check',
  },
  shadowingOfflineNotice: { fr: 'Mode écoute seule : pas de score hors ligne.', en: 'Listen-only mode: no score offline.' },
  shadowingNoSpeech: { fr: "Je n'ai pas bien entendu.", en: "I didn't catch that." },

  // ───────── Drills (unit H2) ─────────
  drillsCounterPrefix: { fr: 'Défi du jour', en: 'Daily challenge' },
  drillsPromptLabel: { fr: 'En français :', en: 'In French:' },
  drillsAnswerLabel: { fr: "Dis-le en anglais.", en: 'Say it in English.' },
  drillsTypeAnswer: { fr: 'Écris ta réponse', en: 'Type your answer' },
  drillsSubmit: { fr: 'Valider', en: 'Submit' },
  drillsDontKnow: { fr: 'Je ne sais pas', en: "I don't know" },
  drillsCorrectLabel: { fr: 'Bien joué !', en: 'Well done!' },
  drillsTrapLabel: { fr: 'Piège', en: 'Trap' },
  drillsListenNative: { fr: 'Écouter', en: 'Listen' },
  drillsConfirmQuestion: { fr: 'Tu as dit :', en: 'You said:' },
  drillsConfirmYes: { fr: 'Oui, c’est ça', en: 'Yes, that’s right' },
  drillsConfirmNo: { fr: 'Non, pas tout à fait', en: 'No, not quite' },
  drillsSelfCheckYes: { fr: 'Je l’ai dit', en: 'I said it' },
  drillsSelfCheckNo: { fr: 'Pas sûr', en: 'Not sure' },
  drillsEndTitle: { fr: 'Terminé', en: 'Done' },
  drillsKeepPhrases: { fr: 'Garder ces phrases', en: 'Keep these phrases' },
  drillsOfflineNotice: { fr: 'Mode hors ligne : auto-évaluation sans score.', en: 'Offline mode: self-check, no score.' },
  drillsTextModeNotice: { fr: 'Mode écrit activé.', en: 'Text mode enabled.' },

  // ───────── Pronunciation (unit H2) ─────────
  pronunciationListTitle: { fr: 'Les pièges français', en: 'French-speaker traps' },
  pronunciationTryCta: { fr: 'Essaie', en: 'Try it' },
  pronunciationResultLabel: { fr: 'Résultat :', en: 'Result:' },
  pronunciationRevealCta: { fr: 'Entendre la différence', en: 'Hear the difference' },
  pronunciationNeedsMic: { fr: 'Nécessite le micro', en: 'Needs the microphone' },
  pronunciationDiagramLabel: { fr: 'Schéma de la bouche', en: 'Mouth diagram' },

  // ───────── Progress (unit H2) ─────────
  progressRange7: { fr: '7 j', en: '7 d' },
  progressRange30: { fr: '30 j', en: '30 d' },
  progressStreakPrefix: { fr: 'Série', en: 'Streak' },
  progressTimeSpokenPrefix: { fr: 'min parlées', en: 'min spoken' },
  progressPhonemesTitle: { fr: 'Phonèmes à travailler', en: 'Phonemes to work on' },
  progressNotEnoughData: { fr: 'Pas encore assez de données.', en: 'Not enough data yet.' },
  progressPhraseBankTitle: { fr: 'Mes phrases Franglais', en: 'My Franglais phrases' },
  progressReview: { fr: 'Réviser', en: 'Review' },
  progressEmpty: { fr: 'Parle un peu et tes points faibles apparaîtront ici.', en: 'Speak a little and your weak points will show up here.' },
  progressLastSync: { fr: 'Dernière synchro :', en: 'Last synced:' },
  progressLoadError: { fr: 'Impossible de charger.', en: 'Could not load.' },
  progressFragile: { fr: 'fragile', en: 'fragile' },
  progressInProgress: { fr: 'en progrès', en: 'in progress' },
  progressSolid: { fr: 'solide', en: 'solid' },
  progressRecentSessions: { fr: 'Séances récentes', en: 'Recent sessions' },
  progressSrsDue: { fr: 'révisions dues', en: 'reviews due' },

  // ───────── Settings (unit H2) ─────────
  settingsTitle: { fr: 'Réglages', bi: 'Réglages · Settings', en: 'Settings' },
  settingsLevelLabel: { fr: 'Niveau', en: 'Level' },
  settingsPlaybackRateLabel: { fr: 'Vitesse de lecture', en: 'Playback speed' },
  settingsSavedNotice: { fr: 'Réglages enregistrés.', en: 'Settings saved.' },

  // ───────── Privacy (unit H2) ─────────
  privacyProcessorDisclosure: {
    fr: 'Ton audio et tes transcriptions sont envoyés à OpenAI (transcription, voix) et à Anthropic ou OpenAI (conversation) pour être traités. Ce ne sont pas des données « jamais gardées » par ces prestataires.',
    en: 'Your audio and transcripts are sent to OpenAI (transcription, voice) and Anthropic or OpenAI (conversation) to be processed. This is not data that is "never kept" by those processors.',
  },
  privacyRetentionFacts: {
    fr: "L'application ne garde pas ton audio dans sa propre base de données. Les transcriptions et tes données de progression restent sur le serveur jusqu'à ce que tu supprimes ton compte.",
    en: 'The app does not keep your audio in its own database. Transcripts and progress data stay on the server until you delete your account.',
  },
  privacyExportDescription: {
    fr: 'Télécharge une copie de ton profil, de tes séances et de ton vocabulaire.',
    en: 'Download a copy of your profile, sessions and vocabulary.',
  },
  privacyDeleteWarning: {
    fr: 'Cette action supprime définitivement ton compte et tes données. Elle ne peut pas être annulée.',
    en: 'This permanently deletes your account and data. It cannot be undone.',
  },
  privacyDeleteSubmit: { fr: 'Supprimer définitivement', en: 'Delete permanently' },
  privacyExportDone: { fr: 'Export prêt.', en: 'Export ready.' },
  privacyDeleteDone: { fr: 'Compte supprimé.', en: 'Account deleted.' },
  privacySignInRequired: {
    fr: 'Connecte-toi pour gérer tes données.',
    en: 'Sign in to manage your data.',
  },

  // ───────── Roleplay / debate chrome (unit H3). Additive only: every key above this
  // comment is untouched. Added because design 04 §10 defines this copy but it hadn't
  // been ported into this table yet (see the H3 handback report for details); kept to
  // only what H2's existing keys (Start/Hear/Loading/…) don't already cover. ─────────
  hintButton: { fr: "Besoin d'aide ?", bi: "Besoin d'aide ? · Need a hint?", en: 'Hint' },
  hintExplanationLabel: { fr: 'Explication en français', en: 'Explanation' },
  sideCardRepeat: { fr: 'Répéter', bi: 'Répéter · Repeat', en: 'Repeat' },
  conversationOfflineMidCall: {
    fr: 'Connexion perdue. On reprend dès que tu es en ligne.',
    en: "Connection lost. We'll continue once you're back online.",
  },
  reviewTitle: { fr: 'Ton bilan', bi: 'Ton bilan · Your review', en: 'Call review' },
  nativePhrasing: { fr: 'Un natif dirait', bi: 'Un natif dirait · A native might say', en: 'A native might say' },
  debateDeviceNotice: {
    fr: 'Tes réponses sont gardées sur cet appareil.',
    en: 'Your answers are kept on this device.',
  },
  reviewTabRephrase: { fr: 'Reformulation', en: 'Rephrase' },
  reviewTabIdioms: { fr: 'Expressions', en: 'Idioms' },
  reviewTabFranglais: { fr: 'Franglais', en: 'Franglais' },
  reviewIdiomsUsed: { fr: 'Expressions utilisées', en: 'Phrasal verbs you used' },
  reviewTryNextTime: { fr: 'À essayer la prochaine fois', en: 'Try next time' },
  reviewSayIt: { fr: 'Le dire', en: 'Say it' },
  reviewWhy: { fr: 'Pourquoi', en: 'Why' },
  reviewSeeAll: { fr: 'Voir tout', en: 'See all' },
} as const satisfies Record<string, StringVariant>;

export type StringKey = keyof typeof STRINGS_DATA;
export const STRINGS: Record<StringKey, StringVariant> = STRINGS_DATA;

/** Picks the best copy for a UI language mode, falling back toward `fr`. */
export function t(key: StringKey, mode: UiLangMode): string {
  const variant = STRINGS[key];
  if (mode === 'fr') return variant.fr;
  if (mode === 'bi') return variant.bi ?? variant.fr;
  return variant.en ?? variant.bi ?? variant.fr;
}
