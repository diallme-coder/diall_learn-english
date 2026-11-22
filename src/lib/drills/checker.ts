// src/lib/drills/checker.ts: checkAnswer(item, answer, inputMode) grades a single drill attempt.
import type { DrillItem, DrillCheckResult, DrillVerdict, InputMode } from '../types.ts';
import { normalizeAnswer, tokenize } from './normalize.ts';

// Function words ignored by the spoken-mode core-token overlap heuristic. Not exhaustive —
// just enough to strip the scaffolding so content words (verbs, nouns, numbers) carry the match.
const STOP_WORDS = new Set([
  'i', "i'm", "i've", "i'll", "i'd", 'you', 'he', 'she', 'it', 'we', 'they', 'me', 'him', 'her', 'us', 'them',
  'a', 'an', 'the', 'to', 'of', 'in', 'on', 'at', 'for', 'with', 'and', 'or', 'that', 'this', 'so',
  'am', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'do', 'does', 'did', 'have', 'has', 'had',
  'yeah', 'yes', 'well', 'um', 'uh', 'really', 'just',
]);

// Crude suffix stripping so "lived"/"living", "informations"/"information" etc. compare equal.
function stem(word: string): string {
  if (word.length > 5 && word.endsWith('ing')) return word.slice(0, -3);
  if (word.length > 4 && word.endsWith('ed')) return word.slice(0, -2);
  if (word.length > 3 && word.endsWith('s')) return word.slice(0, -1);
  return word;
}

function coreTokens(normalizedText: string): string[] {
  return tokenize(normalizedText)
    .filter((t) => !STOP_WORDS.has(t))
    .map(stem);
}

// Partial-credit overlap: most of the expected sentence's content words show up in the answer,
// ignoring exact morphology/number-word spelling. Used only to decide typed-unreachable ambiguity
// for spoken input, never to grant a hard "correct".
function hasCoreOverlap(normalizedAnswer: string, correctEn: string): boolean {
  const expected = coreTokens(normalizeAnswer(correctEn));
  if (expected.length === 0) return false;
  const answerStems = new Set(coreTokens(normalizedAnswer));
  const matched = expected.filter((t) => answerStems.has(t)).length;
  return matched / expected.length >= 0.6;
}

function matchesTrapPattern(pattern: string, normalizedAnswer: string): boolean {
  try {
    if (new RegExp(pattern, 'i').test(normalizedAnswer)) return true;
  } catch {
    // not a valid regex; fall through to a plain substring check below
  }
  return normalizedAnswer.includes(normalizeAnswer(pattern));
}

function matchesAnyTrap(item: DrillItem, normalizedAnswer: string): boolean {
  return item.trapPatterns.some((p) => matchesTrapPattern(p, normalizedAnswer));
}

export function checkAnswer(item: DrillItem, rawAnswer: string, inputMode: InputMode): DrillCheckResult {
  const normalizedAnswer = normalizeAnswer(rawAnswer);
  const expected = item.correctEn;
  const acceptedNormalized = item.acceptedEn.map(normalizeAnswer);
  const exactMatch = acceptedNormalized.includes(normalizedAnswer);

  if (inputMode === 'self_check') {
    return {
      verdict: 'confirm',
      correct: false, // self-graded by the user; this checker never claims a score here
      matchedTrap: matchesAnyTrap(item, normalizedAnswer),
      normalizedAnswer,
      expected,
      feedbackFr: `Réponse attendue : « ${expected} ». Marque-la toi-même.`,
    };
  }

  if (exactMatch) {
    return {
      verdict: 'correct',
      correct: true,
      matchedTrap: false,
      normalizedAnswer,
      expected,
      feedbackFr: 'Bien joué !',
    };
  }

  const trapHit = matchesAnyTrap(item, normalizedAnswer);

  if (inputMode === 'typed') {
    return {
      verdict: 'incorrect',
      correct: false,
      matchedTrap: trapHit,
      normalizedAnswer,
      expected,
      feedbackFr: `Piège : on ne traduit pas mot à mot. On dit « ${expected} ».`,
    };
  }

  // inputMode === 'spoken'
  if (!trapHit && hasCoreOverlap(normalizedAnswer, expected)) {
    const verdict: DrillVerdict = 'confirm';
    return {
      verdict,
      correct: false,
      matchedTrap: false,
      normalizedAnswer,
      expected,
      feedbackFr: `Tu as dit : « ${rawAnswer} » ?`,
    };
  }

  return {
    verdict: 'incorrect',
    correct: false,
    matchedTrap: trapHit,
    normalizedAnswer,
    expected,
    feedbackFr: `Piège : on ne traduit pas mot à mot. On dit « ${expected} ».`,
  };
}
