/**
 * Blocks offensive names at sign-up (person, workshop and address). English and Hindi/Hinglish swear words and slurs,
 * in Latin and Devanagari script. Catches common tricks: capitals, spaces or dots between letters, l33t digits, repeated letters.
 * Real surnames that contain a short swear word (Chodankar, Hancock, Dickson, Sussex) are allowed: short words only match as whole words.
 */

// Matched anywhere, even inside a longer word ("Srijitbhosdamon"). Only words with no innocent use as part of a name.
const ANYWHERE = [
  'fuck', 'fuk', 'shit', 'bitch', 'cunt', 'pussy', 'dildo', 'porn', 'nigger', 'nigga', 'ngga', 'niga', 'faggot', 'slut', 'whore', 'asshole',
  'motherfu', 'horny', 'boob', 'penis', 'vagina', 'retard', 'sexshop', 'redlight',
  'bhosd', 'bhosad', 'bhosr', 'chutiy', 'chutia', 'chootiy', 'madarch', 'maderch', 'behench', 'bahench', 'bhench', 'bhenchod', 'bencho', 'behnchod',
  'lauda', 'lavda', 'lawda', 'lodu', 'gandu', 'gaand', 'gand mar', 'randi', 'randwa', 'haramzad', 'haraamzad', 'harami', 'jhaant', 'jhant', 'chodu', 'bsdk', 'tatti',
  // Devanagari
  'चूतिय', 'चुतिय', 'भोसड', 'भोसड़', 'मादरचोद', 'बहनचोद', 'बहन चोद', 'लौड़', 'लौड', 'लंड', 'गांडू', 'गांड', 'रंडी', 'हरामी', 'हरामज़ाद', 'झांट', 'चोद',
];

// Matched only as a whole word (plural allowed), because they appear inside real names or words.
const WHOLE_WORD = ['sex', 'sexy', 'dick', 'cock', 'rape', 'lund', 'loda', 'chod', 'chut', 'bc', 'mc', 'mf', 'wtf', 'kutta', 'kutti', 'kamina', 'kamine', 'saala'];

const LEET: Record<string, string> = { '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '@': 'a', '$': 's', '!': 'i' };

function words(raw: string): string[] {
  const s = raw.normalize('NFKC').toLowerCase().replace(/[01345@$!7]/g, (c) => LEET[c] ?? c);
  return s.split(/[^\p{L}\p{M}]+/u).filter(Boolean).map((w) => w.replace(/(\p{L})\1{2,}/gu, '$1$1'));
}

/** True when the text contains an offensive word. Empty or missing text is fine. */
export function offensive(raw: unknown): boolean {
  if (raw == null) return false;
  const ws = words(String(raw));
  if (!ws.length) return false;
  // joined, and with doubled letters squeezed, so "b h o s d a" and "shiit" are still caught
  const joined = ws.join('');
  const squeezed = joined.replace(/(\p{L})\1+/gu, '$1');
  const spaced = ws.join(' ');
  for (const w of ANYWHERE) {
    const k = w.replace(/\s+/g, '');
    if (joined.includes(k) || squeezed.includes(k) || spaced.includes(w)) return true;
  }
  return ws.some((w) => WHOLE_WORD.some((b) => w === b || w === b + 's' || w === b + 'es'));
}
