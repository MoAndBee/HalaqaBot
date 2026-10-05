/**
 * Alphabetical ordering for Arabic names.
 *
 * `localeCompare(…, 'ar')` (and Google Sheets' built-in sort) order by the
 * letter as written, so آلاء lands before every other alef, مؤمنة before مروة,
 * and حفصة / حفصه are split into two groups. Names are compared through a
 * normalized key instead; the displayed name is never changed.
 */

// Tashkeel, superscript alef and tatweel
const DIACRITICS = /[ً-ٰٟـ]/g

const LETTER_FOLDS: Record<string, string> = {
  'أ': 'ا', 'إ': 'ا', 'آ': 'ا', 'ٱ': 'ا',
  'ؤ': 'و',
  'ئ': 'ي', 'ى': 'ي', 'ی': 'ي',
  'ة': 'ه',
  'ک': 'ك',
  'ء': '',
}
const FOLDABLE = new RegExp(`[${Object.keys(LETTER_FOLDS).join('')}]`, 'g')

// "عبد الحميد" and "عبدالحميد" (likewise "ابو ال…") are the same name
const COMPOUND_PREFIX = /(^|\s)(عبد|ابو)\s+(?=ال)/g

export function arabicSortKey(name: string): string {
  return name
    .replace(DIACRITICS, '')
    .replace(FOLDABLE, (ch) => LETTER_FOLDS[ch])
    .replace(COMPOUND_PREFIX, '$1$2')
    .trim()
    .split(/\s+/)
    .join(' ')
}

/**
 * Compares word by word on the normalized key, so a repeated first name falls
 * through to the second name, then the third. Arabic code points already run
 * in alphabetical order (… ن ه و ي) once the letter variants are folded.
 */
export function compareArabicNames(a: string, b: string): number {
  const wordsA = arabicSortKey(a).split(' ')
  const wordsB = arabicSortKey(b).split(' ')
  const len = Math.min(wordsA.length, wordsB.length)
  for (let i = 0; i < len; i++) {
    if (wordsA[i] !== wordsB[i]) return wordsA[i] < wordsB[i] ? -1 : 1
  }
  return wordsA.length - wordsB.length
}
