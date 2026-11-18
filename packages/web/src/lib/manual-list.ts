/**
 * Parser for halaqa lists written by hand on Telegram (القوائم اليدوية).
 *
 * Supervisors who can't finish a halaqa in the bot, and Zoom halaqas, end up as
 * a free-text list in the lists group. This turns one such list into
 * structured rows the review screen can match against students. It is pure and
 * timezone-free: the caller passes the halaqa's calendar date, and every date
 * it returns is a UTC-midnight timestamp, the same convention the make-up date
 * picker (CompensationModal) stores in compensatingForDates.
 *
 * The lists vary a lot between supervisors, so everything here is lenient:
 * numbering (١- / ١. / 1/ / duplicated numbers) is ignored in favour of line
 * order, labels may carry tatweel or stray punctuation (المُعلمــــة/ ، المشرفة*),
 * and done/skipped marks may or may not carry an emoji variation selector.
 */

export type ManualListKind = 'regular' | 'makeup' | 'exam_makeup'

export interface CalendarDate {
  year: number
  /** 1-12 */
  month: number
  day: number
}

export interface ManualListHeader {
  teacherName: string | null
  supervisorName: string | null
  /** The date written in the list, when it could be read */
  date: CalendarDate | null
  /** What the title says the halaqa was: a normal one, a make-up, or an exam make-up */
  kind: ManualListKind
}

export interface ManualListLine {
  /** 0-based position among the list's entry lines */
  index: number
  /** The line as pasted, for showing next to the parsed result */
  raw: string
  /** The student's name as written, without numbering, marks or trailing details */
  name: string
  /** ✅ — the student finished her turn */
  done: boolean
  /** 🗣 — the student was called but didn't respond */
  skipped: boolean
  /** A session type written on the line itself, e.g. the bot's own "(تسميع)" */
  sessionType: string | null
  /** Days this line makes up, as UTC-midnight timestamps, oldest first */
  makeupDates: number[]
  /**
   * The line reads as a make-up (it is in a make-up list or mentions ورد /
   * تعويض / استدراك) but no day could be worked out from it — the reviewer has
   * to pick the dates.
   */
  makeupUnresolved: boolean
  /** Whatever text is left once name, marks and recognised dates are removed */
  note: string | null
}

export interface ParsedManualList {
  header: ManualListHeader
  lines: ManualListLine[]
  /**
   * The paste looks like it holds more than one list (a second header after
   * entries started). The review screen asks for one list at a time.
   */
  multipleLists: boolean
}

const SESSION_TYPES = ['تلاوة', 'تسميع', 'تطبيق', 'اختبار', 'دعم', 'مراجعة', 'تعويض'] as const

// ---------------------------------------------------------------------------
// Text helpers
// ---------------------------------------------------------------------------

/** Arabic-Indic and Eastern Arabic digits to ASCII */
export function toAsciiDigits(value: string): string {
  return value
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
}

/** Remove harakat and tatweel, which supervisors use freely for decoration */
function stripDecoration(value: string): string {
  return value.replace(/[\u064B-\u0652\u0670\u0640]/g, '')
}

/**
 * Fold the spelling variants that differ between how a name is typed in a
 * list and how it is stored (أ/إ/آ → ا, ة → ه, ى → ي, …). Mirrors
 * normalizeArabic in StudentPickerModal and in the Convex search queries.
 */
export function foldArabic(value: string): string {
  return stripDecoration(value)
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * A regex source matching a folded word in any of its unfolded spellings, so
 * text can be searched without folding it (and losing the writer's spelling).
 */
function variants(folded: string): string {
  return folded
    .replace(/ا/g, '[اأإآ]')
    .replace(/ه/g, '[هة]')
    .replace(/ي/g, '[يىئ]')
    .replace(/و/g, '[وؤ]')
}

/** Folded text for keyword matching: decoration-free, digits ASCII, letters folded */
function forMatching(value: string): string {
  return foldArabic(toAsciiDigits(value))
}

const DONE_MARK = /[✅✔☑]/u
const SKIPPED_MARK = /🗣/u
const ALL_MARKS = /[✅✔☑]|🗣|\uFE0F/gu

/** Emoji and symbols with no meaning in a name (📍, 🦋, ⛔️, *, …) */
const DECORATIVE = /[\p{Extended_Pictographic}\uFE0F*•]/gu

/**
 * "١- " / "1/" / "٤." / "12)" / "1_" / "3_. " at the start of a line. Several
 * separators may follow each other, and _ or tatweel count as a dash.
 */
const NUMBERING = /^[\s\u200e\u200f]*[0-9٠-٩۰-۹]{1,3}\s*(?:[-–—_\u0640.\/)\u066B\u06D4]\s*)+/

// ---------------------------------------------------------------------------
// Dates
// ---------------------------------------------------------------------------

const MONTHS: Record<string, number> = {
  يناير: 1,
  فبراير: 2,
  مارس: 3,
  ابريل: 4,
  مايو: 5,
  يونيو: 6,
  يوليو: 7,
  اغسطس: 8,
  سبتمبر: 9,
  اكتوبر: 10,
  نوفمبر: 11,
  ديسمبر: 12,
}

/** JS getUTCDay() numbering: 0 = Sunday */
const WEEKDAYS: Array<[RegExp, number]> = [
  [/^(?:ال)?سبت$/, 6],
  [/^(?:ال)?احد$/, 0],
  [/^(?:ال)?(اثنين|اتنين|اثنان)$/, 1],
  [/^(?:ال)?(ثلاثاء|ثلاثا|تلات|تلاتاء)$/, 2],
  [/^(?:ال)?(اربعاء|اربعا|اربع)$/, 3],
  [/^(?:ال)?خميس$/, 4],
  [/^(?:ال)?جمعه$/, 5],
]

function weekdayOf(token: string): number | null {
  for (const [pattern, day] of WEEKDAYS) {
    if (pattern.test(token)) return day
  }
  return null
}

function utcMidnight(date: CalendarDate): number {
  return Date.UTC(date.year, date.month - 1, date.day)
}

function isValidDay(day: number, month: number): boolean {
  return month >= 1 && month <= 12 && day >= 1 && day <= 31
}

/** The day exists in that month of that year (no 31 September) */
function exists(date: CalendarDate): boolean {
  const d = new Date(utcMidnight(date))
  return d.getUTCMonth() === date.month - 1 && d.getUTCDate() === date.day
}

/**
 * A bare day of the month ("يوم 29") is the most recent such day not after
 * the halaqa: this month, or last month when the day hasn't come yet.
 */
function resolveBareDay(day: number, halaqa: CalendarDate): number | null {
  if (day < 1 || day > 31) return null
  let candidate: CalendarDate = { ...halaqa, day }
  if (day > halaqa.day) {
    candidate = halaqa.month === 1
      ? { year: halaqa.year - 1, month: 12, day }
      : { year: halaqa.year, month: halaqa.month - 1, day }
  }
  return exists(candidate) ? utcMidnight(candidate) : null
}

/**
 * A day/month with no year belongs to the most recent such date not after the
 * halaqa — a make-up is always for a day that has already passed.
 */
function resolveYear(day: number, month: number, year: number | null, halaqa: CalendarDate): CalendarDate {
  if (year !== null) {
    return { year: year < 100 ? 2000 + year : year, month, day }
  }
  const sameYear = { year: halaqa.year, month, day }
  return utcMidnight(sameYear) > utcMidnight(halaqa)
    ? { year: halaqa.year - 1, month, day }
    : sameYear
}

/** d/m, d/m/y (day first, as written in Egypt) and "d monthname [y]" */
const NUMERIC_DATE = /(\d{1,2})\s*\/\s*(\d{1,2})(?:\s*\/\s*(\d{2,4}))?/g
const MONTH_NAMES = Object.keys(MONTHS).map(variants).join('|')
const NAMED_DATE = new RegExp(`(\\d{1,2})\\s*(${MONTH_NAMES})(?:\\s*(\\d{4}))?`, 'g')

/** Find a date written in a header line */
function findHeaderDate(line: string, reference: CalendarDate): CalendarDate | null {
  const text = forMatching(line)
  const named = new RegExp(NAMED_DATE.source).exec(text)
  if (named) {
    const day = Number(named[1])
    const month = MONTHS[named[2]]
    if (isValidDay(day, month)) {
      return resolveYear(day, month, named[3] ? Number(named[3]) : null, reference)
    }
  }
  const numeric = new RegExp(NUMERIC_DATE.source).exec(text)
  if (numeric) {
    const day = Number(numeric[1])
    const month = Number(numeric[2])
    if (isValidDay(day, month)) {
      return resolveYear(day, month, numeric[3] ? Number(numeric[3]) : null, reference)
    }
  }
  return null
}

function addDays(date: CalendarDate, days: number): number {
  return utcMidnight(date) + days * 86_400_000
}

/** The most recent given weekday strictly before the halaqa */
function previousWeekday(halaqa: CalendarDate, weekday: number): number {
  const halaqaWeekday = new Date(utcMidnight(halaqa)).getUTCDay()
  const back = ((halaqaWeekday - weekday + 7) % 7) || 7
  return addDays(halaqa, -back)
}

interface MakeupReading {
  dates: number[]
  /** The text with every recognised date phrase taken out */
  leftover: string
}

/**
 * Work out which days a make-up line refers to: "ورد أمس", "ورد الإثنين",
 * "ورد 9/9 آية 49:50 ويوم الجمعه 18 /9", "تعويض: ٥ نوفمبر".
 */
function readMakeupDates(text: string, halaqa: CalendarDate): MakeupReading {
  // Only decoration and digits are normalised: the leftover becomes the
  // note, so it keeps the writer's spelling
  let working = stripDecoration(toAsciiDigits(text))
  const dates = new Set<number>()

  const take = (pattern: RegExp, toDate: (m: RegExpExecArray) => number | null) => {
    working = working.replace(pattern, (...args) => {
      const match = args.slice(0, -2) as unknown as RegExpExecArray
      const date = toDate(match)
      if (date === null) return args[0]
      dates.add(date)
      return ' '
    })
  }

  // A weekday followed by an explicit date ("يوم الجمعه 18 /9") names that
  // date — it must not also count as "last Friday".
  const weekdayWord = `(?:يوم\\s*)?(?:[اأإآ]ل)?(?:${[
    'سبت', 'احد', 'اثنين', 'اتنين', 'ثلاثاء', 'ثلاثا', 'تلات', 'اربعاء', 'اربعا', 'اربع', 'خميس', 'جمعه',
  ].map(variants).join('|')})`

  // One month for several days: "١٤ و١٥ اكتوبر", "٢٣ و٢٩ أكتوبر"
  working = working.replace(
    new RegExp(`(?:${weekdayWord}\\s*)?(\\d{1,2})((?:\\s*و\\s*\\d{1,2})*)\\s*(${MONTH_NAMES})(?:\\s*(\\d{4}))?`, 'g'),
    (whole, first: string, more: string, monthName: string, year?: string) => {
      const month = MONTHS[foldArabic(monthName)]
      const days = [first, ...(more.match(/\d{1,2}/g) ?? [])].map(Number)
      if (!days.every((d) => isValidDay(d, month))) return whole
      for (const d of days) {
        const date = resolveYear(d, month, year ? Number(year) : null, halaqa)
        if (exists(date)) dates.add(utcMidnight(date))
      }
      return ' '
    }
  )

  take(new RegExp(`(?:${weekdayWord}\\s*)?${NUMERIC_DATE.source}`, 'g'), (m) => {
    const day = Number(m[1])
    const month = Number(m[2])
    if (!isValidDay(day, month)) return null
    return utcMidnight(resolveYear(day, month, m[3] ? Number(m[3]) : null, halaqa))
  })

  // Bare days of the month after يوم / ورد / تعويض / استدراك: "يوم29و 30",
  // "ويوم 29". Only these keywords introduce one, so a verse number
  // ("آية 49") is never read as a day. The keyword stays for cleanLeftover.
  working = working.replace(
    new RegExp(`(يوم|ورد|تعويض|${variants('استدراك')})\\s*(\\d{1,2})((?:\\s*و\\s*\\d{1,2})*)(?![\\d/:])`, 'g'),
    (whole, keyword: string, first: string, more: string) => {
      const resolved = [first, ...(more.match(/\d{1,2}/g) ?? [])].map((d) => resolveBareDay(Number(d), halaqa))
      if (resolved.some((d) => d === null)) return whole
      for (const d of resolved) dates.add(d!)
      return keyword === 'يوم' ? ' ' : ` ${keyword} `
    }
  )

  // "أول أمس" before "أمس", so the day before yesterday isn't read as yesterday.
  // امبارح / مبارح is the Egyptian "yesterday".
  const yesterday = `(?:${variants('امس')}|${variants('البارحه')}|${variants('امبارح')}|مبارح)`
  take(new RegExp(`(?:يوم\\s*)?${variants('اول')}\\s*${yesterday}`, 'g'), () => addDays(halaqa, -2))
  take(new RegExp(`(?:يوم\\s*)?${yesterday}`, 'g'), () => addDays(halaqa, -1))

  working = working.replace(new RegExp(weekdayWord, 'g'), (word) => {
    const bare = foldArabic(word).replace(/^يوم\s*/, '')
    const weekday = weekdayOf(bare)
    if (weekday === null) return word
    dates.add(previousWeekday(halaqa, weekday))
    return ' '
  })

  return {
    dates: [...dates].sort((a, b) => a - b),
    leftover: working,
  }
}

// ---------------------------------------------------------------------------
// Lines
// ---------------------------------------------------------------------------

/**
 * Words that end the name: what follows is about the turn, not the student.
 * Only treated as a boundary once at least two name words came before it —
 * ورد is also a given name.
 */
const DETAIL_WORDS = new Set([
  'ورد',
  'تعويض',
  'استدراك',
  ...SESSION_TYPES.map((t) => foldArabic(t)),
])

const GLUED_SESSION_TYPE = new RegExp(
  `^(\\p{L}{2,}?)(${SESSION_TYPES.map((t) => variants(foldArabic(t))).join('|')})$`,
  'u'
)

function splitNameAndDetail(text: string): { name: string; detail: string } {
  // The bot's own format: "name - notes (type)"
  const dashOrParen = text.search(/\s-\s|\(/)
  let namePart = dashOrParen === -1 ? text : text.slice(0, dashOrParen)
  let detail = dashOrParen === -1 ? '' : text.slice(dashOrParen)

  const words = namePart.split(/\s+/).filter(Boolean)
  // A session type typed without a space after the name: "ريم فاروق حامدتسميع"
  if (words.length >= 2) {
    const glued = GLUED_SESSION_TYPE.exec(stripDecoration(words[words.length - 1]))
    if (glued) {
      words.splice(words.length - 1, 1, glued[1], glued[2])
      namePart = words.join(' ')
    }
  }
  const bareWord = (word: string) => foldArabic(word).replace(/^[^\p{L}]+|[^\p{L}]+$/gu, '')
  const boundary = words.findIndex((word, i) => i >= 2 && DETAIL_WORDS.has(bareWord(word)))
  if (boundary !== -1) {
    detail = `${words.slice(boundary).join(' ')} ${detail}`
    namePart = words.slice(0, boundary).join(' ')
  }

  const name = namePart
    // Trailing separators before the details: "عبدالناصر.." / "علي .."
    .replace(/[\s.…:،,\-]+$/, '')
    .replace(/\s+/g, ' ')
    .trim()
  return { name, detail: detail.replace(/^[\s.…:،,]+/, '').trim() }
}

function findSessionType(detail: string): string | null {
  const folded = forMatching(detail)
  for (const type of SESSION_TYPES) {
    if (new RegExp(`(^|[\\s(])${foldArabic(type)}($|[\\s):])`).test(folded)) return type
  }
  return null
}

/** Strip connective words and punctuation the date reader leaves behind */
function cleanLeftover(text: string): string | null {
  const cleaned = text
    // A colon between digits is a verse range ("آية 49:50"), not punctuation
    .replace(/[()\-،,]|:(?!\d)|(?<!\d):/g, ' ')
    .split(/\s+/)
    .filter((word) => word && !['ورد', 'تعويض', 'استدراك', 'و', 'يوم'].includes(foldArabic(word)))
    .join(' ')
    .replace(/^و\s*/, '')
    .trim()
  return cleaned === '' ? null : cleaned
}

function parseLine(raw: string, index: number, kind: ManualListKind, halaqa: CalendarDate): ManualListLine {
  const done = DONE_MARK.test(raw)
  const skipped = SKIPPED_MARK.test(raw)

  const body = raw
    .replace(NUMBERING, '')
    .replace(ALL_MARKS, ' ')
    .replace(DECORATIVE, ' ')
    .replace(/\.{2,}|…/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  const { name, detail } = splitNameAndDetail(body)
  const writtenType = findSessionType(detail)

  const foldedDetail = forMatching(detail)
  const readsAsMakeup =
    kind === 'makeup' ||
    writtenType === 'تعويض' ||
    (kind !== 'exam_makeup' && /(^|\s|\()(ورد|تعويض|استدراك)($|\s|:)/.test(foldedDetail))

  // A make-up turn is a تعويض whatever it was recited as ("تسميع ورد أمس"):
  // that is the type that carries the made-up days. The written type is kept
  // in the note so it isn't lost.
  const sessionType = readsAsMakeup && kind !== 'exam_makeup' ? 'تعويض' : writtenType

  let makeupDates: number[] = []
  let note: string | null = detail === '' ? null : detail.replace(/^-\s*/, '').trim() || null

  if (readsAsMakeup && detail !== '') {
    const reading = readMakeupDates(detail, halaqa)
    makeupDates = reading.dates
    note = cleanLeftover(reading.leftover)
  }

  // The session type written on the line is not a note — unless it was
  // replaced by تعويض above, then it is the only place it survives
  if (note !== null && writtenType !== null && writtenType === sessionType) {
    note = cleanLeftover(stripDecoration(note).replace(new RegExp(variants(foldArabic(writtenType)), 'g'), ' '))
  }

  return {
    index,
    raw: raw.trim(),
    name,
    done,
    skipped,
    sessionType,
    makeupDates,
    makeupUnresolved: readsAsMakeup && makeupDates.length === 0,
    note,
  }
}

// ---------------------------------------------------------------------------
// Whole list
// ---------------------------------------------------------------------------

const TEACHER_LABEL = /المعلم(?:ه|ات)?\s*[:/*\-.،]*\s*(.*)$/
const SUPERVISOR_LABEL = /المشرف(?:ه|ات)?\s*[:/*\-.،]*\s*(.*)$/

function labelValue(line: string, label: RegExp): string | null {
  const text = stripDecoration(line).replace(DECORATIVE, ' ')
  // Labels are matched on folded text, but the value keeps its spelling
  const folded = text.replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه')
  const match = label.exec(folded)
  if (!match) return null
  const start = folded.length - match[1].length
  const value = text
    .slice(start)
    .replace(/^[\s:/*\-.،]+/, '')
    .replace(/[\s:/*\-.،]+$/, '')
    .replace(/\s+/g, ' ')
    .trim()
  return value === '' ? null : value
}

function isEntryLine(line: string): boolean {
  if (!NUMBERING.test(line)) return false
  // "4/10/2026" on its own is the header date, not entry number 4
  const afterNumber = line.replace(NUMBERING, '')
  return /\p{L}/u.test(afterNumber) && !/^\s*\d{1,2}\s*\/\s*\d{2,4}/.test(toAsciiDigits(afterNumber))
}

function isHeaderLabel(line: string): boolean {
  const folded = forMatching(line)
  return /المعلم|المشرف|التاريخ/.test(folded)
}

function kindOf(headerText: string): ManualListKind {
  const folded = forMatching(headerText)
  // مقرأة الورد المتراكم: the accumulated (missed) wird — a make-up halaqa
  if (/استدراك|تعويض|متراكم/.test(folded)) {
    return /اختبار/.test(folded) ? 'exam_makeup' : 'makeup'
  }
  return 'regular'
}

/**
 * Parse one pasted list.
 *
 * @param halaqaDate The calendar date of the halaqa the list belongs to (the
 *   post's date). Yearless dates are resolved against it, and so are relative
 *   make-up phrases (أمس, الإثنين) when the list doesn't state its own date.
 */
export function parseManualList(text: string, halaqaDate: CalendarDate): ParsedManualList {
  const rawLines = text.split(/\r?\n/)

  const headerLines: string[] = []
  const entryRaw: string[] = []
  let multipleLists = false

  for (const line of rawLines) {
    if (line.trim() === '') continue
    if (isEntryLine(line)) {
      entryRaw.push(line)
    } else if (entryRaw.length === 0) {
      headerLines.push(line)
    } else if (isHeaderLabel(line)) {
      multipleLists = true
    }
  }

  let teacherName: string | null = null
  let supervisorName: string | null = null
  let date: CalendarDate | null = null

  for (const line of headerLines) {
    teacherName ??= labelValue(line, TEACHER_LABEL)
    supervisorName ??= labelValue(line, SUPERVISOR_LABEL)
    date ??= findHeaderDate(line, halaqaDate)
  }

  const kind = kindOf(headerLines.join('\n'))

  // "ورد أمس" means the day before the list was written: when the list states
  // its own date, count from that rather than from the post it is pasted into
  const reference = date ?? halaqaDate

  return {
    header: { teacherName, supervisorName, date, kind },
    lines: entryRaw.map((line, i) => parseLine(line, i, kind, reference)),
    multipleLists,
  }
}

/** The session type a whole list implies, or null when the title doesn't say */
export function defaultSessionTypeFor(kind: ManualListKind): string | null {
  if (kind === 'exam_makeup') return 'اختبار'
  if (kind === 'makeup') return 'تعويض'
  return null
}

// ---------------------------------------------------------------------------
// Matching names to students without AI
// ---------------------------------------------------------------------------

/**
 * Name words for comparison: folded, with compound names joined so
 * "عبد الله" and "عبدالله" compare equal, and ال dropped from every word
 * after the first so "سلمى خالد شريف" and "سلمى خالد الشريف" compare equal.
 */
function nameWords(name: string): string[] {
  return foldArabic(name.replace(/^@/, ''))
    .replace(/(^|\s)(عبد|ابو|ام) /g, '$1$2')
    .split(' ')
    .filter(Boolean)
    .map((word, i) => (i > 0 && /^ال.{2,}$/.test(word) ? word.slice(2) : word))
}

function isPrefix(shorter: string[], longer: string[]): boolean {
  return shorter.length <= longer.length && shorter.every((word, i) => word === longer[i])
}

/** The one student in the list, or null for none or several */
function onlyOne<T extends { id: string }>(candidates: T[]): string | null {
  return candidates.length === 1 ? candidates[0].id : null
}

function storedNames<T extends { id: string; name: string }>(students: T[]) {
  return students
    .map((student) => ({ student, words: nameWords(student.name) }))
    .filter((s) => s.words.length > 0)
}

/**
 * Match a written name to a student when it is unambiguous, trying in order:
 * the names are the same; one is the start of the other and is at least two
 * words long ("آية محمد" ↔ "آية محمد محمد"); the names are the same once
 * spaces are ignored ("ليلىسعيد حسن" ↔ "ليلى سعيد حسن"). Each step only runs
 * when the one before found no student at all, so two students fitting
 * equally well stop the search. Returns the student's id, or null — those go
 * to matchNameWithTypo, the AI matcher and the reviewer.
 */
export function matchNameLocally<T extends { id: string; name: string }>(
  writtenName: string,
  students: T[]
): string | null {
  const written = nameWords(writtenName)
  if (written.length === 0) return null
  const stored = storedNames(students)

  const exact = stored.filter((s) => s.words.length === written.length && isPrefix(s.words, written))
  if (exact.length > 0) return onlyOne(exact.map((s) => s.student))

  const partial = stored.filter(
    (s) =>
      Math.min(s.words.length, written.length) >= 2 &&
      (isPrefix(s.words, written) || isPrefix(written, s.words))
  )
  if (partial.length > 0) return onlyOne(partial.map((s) => s.student))

  const joined = written.join('')
  return onlyOne(stored.filter((s) => s.words.join('') === joined).map((s) => s.student))
}

/** Levenshtein distance, giving up (returning limit + 1) once it exceeds limit */
function editDistance(a: string, b: string, limit: number): number {
  if (Math.abs(a.length - b.length) > limit) return limit + 1
  let previous = Array.from({ length: b.length + 1 }, (_, j) => j)
  for (let i = 1; i <= a.length; i++) {
    const current = [i]
    for (let j = 1; j <= b.length; j++) {
      current[j] = Math.min(
        previous[j] + 1,
        current[j - 1] + 1,
        previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      )
    }
    if (Math.min(...current) > limit) return limit + 1
    previous = current
  }
  return previous[b.length]
}

/**
 * A looser match for when matchNameLocally found nothing: the names differ by
 * a single letter ("سهى كمال ذكي" ↔ "سهى كمال زكي"), comparing the written
 * name with the same number of words from the start of the stored one. Both
 * must be at least two words and only one student may be that close. A
 * single letter can also be a different person (أمل / آمال), so the caller
 * shows this as a match to check rather than a certain one.
 */
export function matchNameWithTypo<T extends { id: string; name: string }>(
  writtenName: string,
  students: T[]
): string | null {
  const written = nameWords(writtenName)
  if (written.length < 2) return null
  return onlyOne(
    storedNames(students)
      .filter((s) => s.words.length >= 2)
      .filter((s) => {
        const n = Math.min(s.words.length, written.length)
        return editDistance(written.slice(0, n).join(' '), s.words.slice(0, n).join(' '), 1) <= 1
      })
      .map((s) => s.student)
  )
}
