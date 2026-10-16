import { StageLabel } from '../../../types/grooming';

/*
 * MOCK ONLY. A tiny keyword stand-in so the UI can be seen working before the
 * backend exists. It is NOT the roberta-base model, NOT the real normalizer,
 * and says nothing about real detection quality.
 */

const LEET: Record<string, string> = {
  '0': 'o',
  '1': 'i',
  '3': 'e',
  '4': 'a',
  '5': 's',
  '7': 't',
  '@': 'a',
  $: 's',
};

const SLANG: Record<string, string> = {
  u: 'you',
  ur: 'your',
  r: 'are',
  pls: 'please',
  plz: 'please',
  pic: 'picture',
  pics: 'pictures',
  rn: 'right now',
  ily: 'i love you',
  bc: 'because',
  dont: "don't",
};

export function mockNormalize(text: string): string {
  let t = text.toLowerCase();
  t = t.replace(/[013457@$]/g, (c) => LEET[c] ?? c);
  // "sooooo" -> "soo"
  t = t.replace(/(.)\1{2,}/g, '$1$1');
  // "s e c r e t" -> "secret"
  t = t.replace(/\b(?:[a-z] ){2,}[a-z]\b/g, (m) => m.replace(/ /g, ''));
  t = t
    .split(/\s+/)
    .map((w) => {
      const core = w.replace(/[^a-z']/g, '');
      return SLANG[core] ? w.replace(core, SLANG[core]) : w;
    })
    .join(' ');
  return t.trim();
}

// Checked from the most severe stage down.
const LEXICON: [StageLabel, RegExp][] = [
  [
    'Solicitation',
    /(send (me )?(a |some |your )?(picture|photo|selfie)|meet (up|me)|video ?call|come over|where do you live|what'?s your address)/,
  ],
  [
    'Desensitization',
    /(ever kissed|it'?s (totally )?normal|everyone does it|what are you wearing|do you have a (boyfriend|girlfriend))/,
  ],
  [
    'Isolation',
    /(don'?t tell|our (little )?secret|between us|delete (the|our|these|this) (chat|messages?)|are you alone|are your parents (home|around)|nobody (has to|needs to) know)/,
  ],
  [
    'Trust-Building',
    /(tell me anything|i understand you|so mature|you'?re special|i'?m here for you|trust me|they don'?t get you)/,
  ],
];

export function mockClassify(normalized: string): {
  label: StageLabel;
  scores: Record<StageLabel, number>;
} {
  const hit = LEXICON.find(([, re]) => re.test(normalized));
  const label: StageLabel = hit ? hit[0] : 'none';
  const top = hit ? 0.78 : 0.86;
  const rest = (1 - top) / 4;
  const scores = {
    none: rest,
    'Trust-Building': rest,
    Isolation: rest,
    Desensitization: rest,
    Solicitation: rest,
  } as Record<StageLabel, number>;
  scores[label] = top;
  return { label, scores };
}
