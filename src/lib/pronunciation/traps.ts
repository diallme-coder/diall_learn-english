// src/lib/pronunciation/traps.ts
//
// The catalog of all 11 TRAP_IDS. Each entry carries real, useful French
// mouth-placement guidance (not generic filler) plus at least 3 minimal
// pairs. `stress_misplaced` and `weak_forms` exist only as practice content:
// the scorer (scorer.ts) never emits them, because stress cannot be
// detected from ASR text alone.
//
// The sensitive pair (beach/bitch) is the one exception to "minimal pairs
// are two real words": `sensitive: true` on that single MinimalPair tells
// sensitive.ts and the UI to hide `confusedWith` behind a tap-to-reveal
// note instead of displaying or speaking it directly.

import type { PronunciationTrap } from '../types.ts';

export const TRAPS: readonly PronunciationTrap[] = [
  {
    id: 'h_dropped',
    category: 'aspirated_h',
    ipa: '/h/',
    titleFr: 'H muet (chute du H)',
    explanationFr:
      "En anglais, le H initial de mots comme « hungry » ou « hair » doit se faire entendre : un léger souffle. " +
      'En français le H est toujours muet, donc on a le réflexe de le laisser tomber — ce qui change parfois le mot entier.',
    mouthTipFr:
      "Laisse sortir un petit souffle d'air depuis la gorge avant la voyelle, comme si tu embuais une vitre, " +
      'sans faire vibrer les cordes vocales.',
    substitution: { heardAs: 'ø (H muet)', exampleFr: '« hungry » entendu comme « \'ungry », proche de « angry ».' },
    minimalPairs: [
      { target: 'hungry', confusedWith: 'angry', targetIpa: '/ˈhʌŋɡri/', confusedIpa: '/ˈæŋɡri/' },
      { target: 'hair', confusedWith: 'air', targetIpa: '/heər/', confusedIpa: '/eər/' },
      { target: 'heat', confusedWith: 'eat', targetIpa: '/hiːt/', confusedIpa: '/iːt/' },
      { target: 'hat', confusedWith: 'at', targetIpa: '/hæt/', confusedIpa: '/æt/' },
    ],
    practiceWords: ['hungry', 'hair', 'heat', 'hat', 'heart', 'hotel', 'happy'],
  },
  {
    id: 'h_inserted',
    category: 'aspirated_h',
    ipa: '/h/',
    titleFr: 'H ajouté par erreur',
    explanationFr:
      'À l\'inverse, certains francophones ajoutent un souffle de H devant des mots anglais qui commencent par ' +
      'une voyelle, par hypercorrection ("puisque le H anglais se prononce parfois, j\'en ajoute un partout").',
    mouthTipFr:
      'Devant une voyelle initiale, ne souffle pas avant de parler : laisse la voyelle sortir directement, ' +
      'sans bruit de gorge au départ.',
    substitution: { heardAs: 'h ajouté', exampleFr: '« egg » entendu comme « hegg ».' },
    minimalPairs: [
      { target: 'egg', confusedWith: 'hegg', targetIpa: '/ɛɡ/', confusedIpa: '/hɛɡ/' },
      { target: 'arm', confusedWith: 'harm', targetIpa: '/ɑːrm/', confusedIpa: '/hɑːrm/' },
      { target: 'add', confusedWith: 'had', targetIpa: '/æd/', confusedIpa: '/hæd/' },
      { target: 'ice', confusedWith: 'hice', targetIpa: '/aɪs/', confusedIpa: '/haɪs/' },
    ],
    practiceWords: ['egg', 'arm', 'add', 'ice', 'apple', 'orange'],
  },
  {
    id: 'th_as_s',
    category: 'th',
    ipa: '/θ/',
    titleFr: 'TH sourd prononcé « S »',
    explanationFr:
      "Le son /θ/ de « think » n'existe pas en français : on le remplace souvent par « s », la consonne la " +
      'plus proche dans notre répertoire.',
    mouthTipFr:
      "Place le bout de la langue entre les dents du haut et du bas pour /θ/ et /ð/, pas derrière les dents " +
      "comme pour « s » ou « z », puis souffle sans faire vibrer les cordes vocales pour /θ/.",
    substitution: { heardAs: 's', exampleFr: '« think » entendu comme « sink ».' },
    minimalPairs: [
      { target: 'think', confusedWith: 'sink', targetIpa: '/θɪŋk/', confusedIpa: '/sɪŋk/' },
      { target: 'thing', confusedWith: 'sing', targetIpa: '/θɪŋ/', confusedIpa: '/sɪŋ/' },
      { target: 'path', confusedWith: 'pass', targetIpa: '/pæθ/', confusedIpa: '/pæs/' },
      { target: 'mouth', confusedWith: 'mouse', targetIpa: '/maʊθ/', confusedIpa: '/maʊs/' },
    ],
    practiceWords: ['think', 'thing', 'path', 'mouth', 'thanks', 'theater'],
  },
  {
    id: 'th_as_f',
    category: 'th',
    ipa: '/θ/',
    titleFr: 'TH sourd prononcé « F »',
    explanationFr:
      'Autre remplacement fréquent de /θ/ : la consonne « f », surtout en fin de mot ou quand la graphie « th » ' +
      'suit certains schémas familiers du français.',
    mouthTipFr:
      'Garde la langue entre les dents — pas les lèvres sur les dents comme pour « f » — et souffle doucement ' +
      'sans que les lèvres se touchent.',
    substitution: { heardAs: 'f', exampleFr: '« three » entendu comme « free ».' },
    minimalPairs: [
      { target: 'three', confusedWith: 'free', targetIpa: '/θriː/', confusedIpa: '/friː/' },
      { target: 'thin', confusedWith: 'fin', targetIpa: '/θɪn/', confusedIpa: '/fɪn/' },
      { target: 'tooth', confusedWith: 'toof', targetIpa: '/tuːθ/', confusedIpa: '/tuːf/' },
      { target: 'thought', confusedWith: 'fought', targetIpa: '/θɔːt/', confusedIpa: '/fɔːt/' },
    ],
    practiceWords: ['three', 'thin', 'tooth', 'thirsty', 'through'],
  },
  {
    id: 'th_as_t',
    category: 'th',
    ipa: '/θ/',
    titleFr: 'TH sourd prononcé « T »',
    explanationFr:
      'Certains francophones remplacent /θ/ par « t », une consonne proche car les deux impliquent la langue ' +
      "vers l'avant de la bouche.",
    mouthTipFr:
      'La langue doit dépasser légèrement entre les dents, pas se poser derrière les dents du haut comme pour « t ».',
    substitution: { heardAs: 't', exampleFr: '« three » entendu comme « tree ».' },
    minimalPairs: [
      { target: 'three', confusedWith: 'tree', targetIpa: '/θriː/', confusedIpa: '/triː/' },
      { target: 'thin', confusedWith: 'tin', targetIpa: '/θɪn/', confusedIpa: '/tɪn/' },
      { target: 'bath', confusedWith: 'bat', targetIpa: '/bæθ/', confusedIpa: '/bæt/' },
      { target: 'think', confusedWith: 'tink', targetIpa: '/θɪŋk/', confusedIpa: '/tɪŋk/' },
    ],
    practiceWords: ['three', 'thin', 'bath', 'think', 'birthday'],
  },
  {
    id: 'dh_as_z',
    category: 'th',
    ipa: '/ð/',
    titleFr: 'TH voisé prononcé « Z »',
    explanationFr:
      "Le son /ð/ de « this » ou « the » est voisé (les cordes vocales vibrent) mais il n'existe pas en " +
      'français : on le remplace souvent par « z ».',
    mouthTipFr:
      'Place le bout de la langue entre les dents comme pour /θ/, mais fais vibrer les cordes vocales : pose ' +
      'un doigt sur la gorge pour sentir la vibration.',
    substitution: { heardAs: 'z', exampleFr: '« this » entendu comme « zis ».' },
    minimalPairs: [
      { target: 'this', confusedWith: 'zis', targetIpa: '/ðɪs/', confusedIpa: '/zɪs/' },
      { target: 'they', confusedWith: 'zey', targetIpa: '/ðeɪ/', confusedIpa: '/zeɪ/' },
      { target: 'those', confusedWith: 'zose', targetIpa: '/ðoʊz/', confusedIpa: '/zoʊz/' },
      { target: 'then', confusedWith: 'zen', targetIpa: '/ðɛn/', confusedIpa: '/zɛn/' },
    ],
    practiceWords: ['this', 'they', 'those', 'then', 'there', 'brother'],
  },
  {
    id: 'dh_as_d',
    category: 'th',
    ipa: '/ð/',
    titleFr: 'TH voisé prononcé « D »',
    explanationFr:
      'Autre remplacement de /ð/, cette fois par « d », car les deux sons impliquent la langue vers ' +
      "l'avant et sont voisés.",
    mouthTipFr:
      'Laisse la langue dépasser légèrement entre les dents au lieu de la poser derrière les dents du haut ' +
      'comme pour « d ».',
    substitution: { heardAs: 'd', exampleFr: '« they » entendu comme « day ».' },
    minimalPairs: [
      { target: 'this', confusedWith: 'dis', targetIpa: '/ðɪs/', confusedIpa: '/dɪs/' },
      { target: 'that', confusedWith: 'dat', targetIpa: '/ðæt/', confusedIpa: '/dæt/' },
      { target: 'they', confusedWith: 'day', targetIpa: '/ðeɪ/', confusedIpa: '/deɪ/' },
      { target: 'then', confusedWith: 'den', targetIpa: '/ðɛn/', confusedIpa: '/dɛn/' },
    ],
    practiceWords: ['this', 'that', 'they', 'then', 'mother', 'father'],
  },
  {
    id: 'ih_vs_iy',
    category: 'vowel_length',
    ipa: '/ɪ/ vs /iː/',
    titleFr: 'Voyelle courte /ɪ/ vs longue /iː/',
    explanationFr:
      "Le français ne distingue pas la durée des voyelles comme l'anglais : /ɪ/ est courte et détendue, " +
      '/iː/ est longue et tendue, et confondre les deux peut changer complètement le sens du mot.',
    mouthTipFr:
      'Pour /iː/, étire bien les lèvres en sourire et tiens le son plus longtemps ; pour /ɪ/, relâche les ' +
      'lèvres et raccourcis le son.',
    substitution: { heardAs: 'ɪ ↔ iː inversés', exampleFr: '« ship » entendu comme « sheep ».' },
    minimalPairs: [
      { target: 'ship', confusedWith: 'sheep', targetIpa: '/ʃɪp/', confusedIpa: '/ʃiːp/' },
      { target: 'live', confusedWith: 'leave', targetIpa: '/lɪv/', confusedIpa: '/liːv/' },
      { target: 'sit', confusedWith: 'seat', targetIpa: '/sɪt/', confusedIpa: '/siːt/' },
      { target: 'beach', confusedWith: 'bitch', targetIpa: '/biːtʃ/', confusedIpa: '/bɪtʃ/', sensitive: true },
    ],
    practiceWords: ['ship', 'live', 'sit', 'fill', 'chip', 'will', 'beach'],
  },
  {
    id: 'uh_vs_uw',
    category: 'vowel_length',
    ipa: '/ʊ/ vs /uː/',
    titleFr: 'Voyelle courte /ʊ/ vs longue /uː/',
    explanationFr:
      'Même logique que /ɪ/ et /iː/, mais avec les voyelles arrondies de l\'arrière de la bouche : /ʊ/ est ' +
      'courte, /uː/ est longue, et la confusion est fréquente chez les francophones.',
    mouthTipFr:
      'Pour /uː/, arrondis bien les lèvres vers l\'avant et tiens le son ; pour /ʊ/, relâche un peu les ' +
      'lèvres et raccourcis.',
    substitution: { heardAs: 'ʊ ↔ uː inversés', exampleFr: '« full » entendu comme « fool ».' },
    minimalPairs: [
      { target: 'full', confusedWith: 'fool', targetIpa: '/fʊl/', confusedIpa: '/fuːl/' },
      { target: 'pull', confusedWith: 'pool', targetIpa: '/pʊl/', confusedIpa: '/puːl/' },
      { target: 'look', confusedWith: 'Luke', targetIpa: '/lʊk/', confusedIpa: '/luːk/' },
      { target: 'soot', confusedWith: 'suit', targetIpa: '/sʊt/', confusedIpa: '/suːt/' },
    ],
    practiceWords: ['full', 'pull', 'look', 'good', 'book', 'wood'],
  },
  {
    id: 'stress_misplaced',
    category: 'stress_rhythm',
    ipa: 'ˈ (accent tonique)',
    titleFr: 'Accent tonique mal placé',
    explanationFr:
      'Le français place l\'accent presque toujours sur la dernière syllabe. L\'anglais a un accent tonique ' +
      'mobile, qui peut même changer le sens d\'un mot (« record » nom vs verbe). Mal placé, l\'accent rend ' +
      'le mot difficile à comprendre même si tous les sons sont corrects. Ce piège est affiché comme contenu ' +
      "d'entraînement : le correcteur ne peut pas le détecter de façon fiable à partir du seul texte reconnu.",
    mouthTipFr:
      'Allonge et renforce légèrement la syllabe accentuée, et réduis nettement les autres : ce contraste de ' +
      'rythme compte plus que la précision de chaque son.',
    substitution: { heardAs: 'accent plat (rythme syllabique)', exampleFr: '« comfortable » dit avec un accent sur la 3e syllabe au lieu de la 1re.' },
    minimalPairs: [
      { target: 'PHOtograph', confusedWith: 'photoGRAPH', targetIpa: "/ˈfoʊtəˌɡræf/", confusedIpa: "/ˌfoʊtəˈɡræf/" },
      { target: 'COMfortable', confusedWith: 'comforTABLE', targetIpa: "/ˈkʌmftərbəl/", confusedIpa: "/ˌkʌmfərˈteɪbəl/" },
      { target: 'deVELop', confusedWith: 'DEvelop', targetIpa: "/dɪˈvɛləp/", confusedIpa: "/ˈdɛvələp/" },
      { target: 'hoTEL', confusedWith: 'HOtel', targetIpa: "/hoʊˈtɛl/", confusedIpa: "/ˈhoʊtəl/" },
    ],
    practiceWords: ['photograph', 'comfortable', 'develop', 'hotel', 'economy', 'record'],
  },
  {
    id: 'weak_forms',
    category: 'stress_rhythm',
    ipa: 'ə (schwa)',
    titleFr: 'Formes faibles non réduites',
    explanationFr:
      'En anglais rapide, les petits mots grammaticaux (to, for, and, a) se réduisent à un schwa /ə/ au lieu ' +
      'de leur voyelle pleine. Les francophones ont tendance à prononcer chaque mot en entier, ce qui donne un ' +
      'rythme trop régulier et peu naturel. Comme pour l\'accent, ce piège reste un contenu d\'entraînement : ' +
      'le texte reconnu seul ne permet pas de savoir si une forme faible a été réduite ou non.',
    mouthTipFr:
      'Relâche la bouche et réduis la voyelle des petits mots non accentués vers un /ə/ neutre, bref et sans tension.',
    substitution: { heardAs: 'voyelle pleine au lieu du schwa', exampleFr: '« to » dit /tuː/ au lieu de /tə/ dans « I want to go ».' },
    minimalPairs: [
      { target: 'to', confusedWith: 'too', targetIpa: '/tə/', confusedIpa: '/tuː/' },
      { target: 'for', confusedWith: 'four', targetIpa: '/fər/', confusedIpa: '/fɔːr/' },
      { target: 'that (weak)', confusedWith: 'that (strong)', targetIpa: '/ðət/', confusedIpa: '/ðæt/' },
    ],
    practiceWords: ['to', 'for', 'and', 'a', 'that', 'of'],
  },
] as const;

export function getTrap(id: PronunciationTrap['id']): PronunciationTrap {
  const trap = TRAPS.find((t) => t.id === id);
  if (!trap) throw new Error(`Unknown trap id: ${id}`);
  return trap;
}
