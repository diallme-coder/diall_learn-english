// src/lib/codeswitch/enFalseFriends.ts
//
// ENGLISH words that French speakers commonly misuse because of a French
// word that looks similar but means something else. Consumed by F's tutor
// and debate-feedback prompts (Unit F/E) to warn the model, and by the UI
// to show a short correcting cue. Exported shape matches §6 of the plan:
// `EN_FALSE_FRIENDS: readonly { en: string; frMeaning: string; noteFr: string }[]`.

export interface EnFalseFriend {
  en: string;
  // The French meaning a learner might mistakenly intend when using this
  // English word (the "false" sense, borrowed from the French look-alike).
  frMeaning: string;
  // Short correcting cue, in French.
  noteFr: string;
}

export const EN_FALSE_FRIENDS: readonly EnFalseFriend[] = [
  { en: 'actually', frMeaning: 'actuellement (= currently)', noteFr: "'Actually' veut dire « en fait », pas « actuellement »." },
  { en: 'eventually', frMeaning: 'éventuellement (= possibly)', noteFr: "'Eventually' veut dire « finalement », pas « éventuellement »." },
  { en: 'assist', frMeaning: 'assister à (= to attend)', noteFr: "'To assist' veut dire « aider », pas « assister à » (= to attend)." },
  { en: 'library', frMeaning: 'librairie (= bookshop)', noteFr: "'Library' veut dire « bibliothèque », pas « librairie » (= bookshop)." },
  { en: 'sensible', frMeaning: 'sensible (= sensitive)', noteFr: "'Sensible' veut dire « raisonnable », pas « sensible » (émotionnellement)." },
  { en: 'achieve', frMeaning: 'achever (= to finish)', noteFr: "'To achieve' veut dire « atteindre/réussir », pas « achever » (= to finish)." },
  { en: 'attend', frMeaning: 'attendre (= to wait for)', noteFr: "'To attend' veut dire « assister à », pas « attendre » (= to wait for)." },
  { en: 'rest', frMeaning: 'rester (= to stay)', noteFr: "'To rest' veut dire « se reposer », pas « rester » (= to stay)." },
  { en: 'bless', frMeaning: 'blesser (= to hurt)', noteFr: "'To bless' veut dire « bénir », pas « blesser » (= to hurt)." },
  { en: 'chair', frMeaning: 'chair (= flesh)', noteFr: "'Chair' veut dire « chaise », pas « chair » (= flesh)." },
  { en: 'deception', frMeaning: 'déception (= disappointment)', noteFr: "'Deception' veut dire « tromperie », pas « déception » (= disappointment)." },
  { en: 'affair', frMeaning: 'affaire (= deal/business matter)', noteFr: "'Affair' veut dire « liaison », pas « affaire » (= business matter)." },
  { en: 'ignore', frMeaning: 'ignorer (= to not know)', noteFr: "'To ignore' veut dire « faire exprès de ne pas remarquer », pas « ignorer » (= to not know)." },
];
