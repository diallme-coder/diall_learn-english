// src/lib/levels/debate.ts: C1 unscripted debate motions.
// idiomIds reference IDIOMS entries (idioms.ts) the learner is nudged to try.

import type { DebateTopic } from '../types.ts';

export const DEBATE_TOPICS: readonly DebateTopic[] = [
  {
    id: 'remote-work',
    level: 'C1',
    motionEn: 'This house believes remote work is better for society than the office.',
    motionFr: 'Cette assemblée pense que le télétravail est meilleur pour la société que le bureau.',
    idiomIds: ['figure_out', 'put_up_with'],
  },
  {
    id: 'social-media',
    level: 'C1',
    motionEn: 'This house believes social media does more harm than good.',
    motionFr: 'Cette assemblée pense que les réseaux sociaux font plus de mal que de bien.',
    idiomIds: ['bring_up', 'come_up_with'],
  },
  {
    id: 'ai-jobs',
    level: 'C1',
    motionEn: 'This house believes artificial intelligence will create more jobs than it destroys.',
    motionFr: "Cette assemblée pense que l'intelligence artificielle créera plus d'emplois qu'elle n'en détruit.",
    idiomIds: ['figure_out', 'come_up_with'],
  },
  {
    id: 'university-free',
    level: 'C1',
    motionEn: 'This house believes university education should be free for everyone.',
    motionFr: "Cette assemblée pense que l'enseignement universitaire devrait être gratuit pour tous.",
    idiomIds: ['give_up', 'look_forward_to'],
  },
  {
    id: 'city-vs-countryside',
    level: 'C1',
    motionEn: 'This house believes city life is better than countryside life.',
    motionFr: 'Cette assemblée pense que la vie en ville est meilleure que la vie à la campagne.',
    idiomIds: ['get_along_with', 'take_after'],
  },
  {
    id: 'four-day-week',
    level: 'C1',
    motionEn: 'This house believes a four-day work week should become the norm.',
    motionFr: 'Cette assemblée pense que la semaine de quatre jours devrait devenir la norme.',
    idiomIds: ['catch_up_on', 'put_up_with'],
  },
  {
    id: 'tourism-limits',
    level: 'C1',
    motionEn: 'This house believes popular cities should limit tourism.',
    motionFr: 'Cette assemblée pense que les villes touristiques devraient limiter le tourisme.',
    idiomIds: ['run_into', 'break_down'],
  },
  {
    id: 'celebrity-privacy',
    level: 'C1',
    motionEn: 'This house believes celebrities give up their right to privacy.',
    motionFr: 'Cette assemblée pense que les célébrités renoncent à leur droit à la vie privée.',
    idiomIds: ['give_up', 'hold_on'],
  },
];

export function getTopic(id: string): DebateTopic | undefined {
  return DEBATE_TOPICS.find((t) => t.id === id);
}
