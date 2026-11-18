import { describe, expect, test } from 'bun:test'
import {
  parseManualList,
  defaultSessionTypeFor,
  foldArabic,
  matchNameLocally,
  matchNameWithTypo,
} from './manual-list'

const day = (year: number, month: number, d: number) => Date.UTC(year, month - 1, d)

// Real lists from the lists group (جروب القوائم), as supervisors wrote them

const REGULAR = `📖 مقــــرأة درجــــات الجنــــة 📖
📍المُعلمــــة/ شيماء وجيه
📍المشرفـــــة/ سمية
📍التاريخ/ ١٠ أكتوبر ٢٠٢٦
⛔️فضــــلاً كتــابة الاســم ثلاثــي
-------------------
١- فاطمة علي محمد✅
٢-هبه فؤاد الخرباوى ✅
٣-هدير مجدي الهيتي✅
٤-نجوى احمد ابوالمجد✅
٥-رحمة أحمد عيد✅`

const EXAM_MAKEUP = `📌مقرأة استدراك الإختبار
4/10/2026
المُعلمة: مروة
المُشرفة* راندا
ــــــــــــــــــــــــــــــــــــــــــــــــــــ
١.ميسون حسن أحمد ✅️
٢.بسمة موسي منصور✅️
٣.شاهيناز عبدالله حسنى ✅️
٤.اسراء مصطفى عبدالرؤوف ✅️
٥-آية محمد محمد✅️
٦.اسماء السيد ناصر  🗣
٧.إيمان محب فتحي✅️
٨.أميرة عطية إبراهيم ✅️
٩.عصمت راضى عبد العليم✅️
١٠.عايدة محمد فوزي✅️
١١.منى محمد الشرقاوي ✅️
١٢-شهد علاء عبد المعطي🗣`

const MAKEUP = `📖 مقــــرأة درجــــات الجنــــة 📖
🦋 مقرأة استدراك ) 🦋
📍المُعلمــــة/  ياسمين
📍المشرفـــــة// إيمان أسامة أحمد
📍التاريخ/. 7 /10
⛔️فضــــلاً كتــابة الاســم ثلاثــي وفقكن الله حبيباتي
-----------
1/أمانة كامل ورد أمس ✅
2/ صفا محمد حافظ  الجلم ورد أمس ✅
3/آية محمد محمد  ورد الإثنين ✅
4/سلوى سمير خليفة ورد أمس ✅
4/إسراء مصطفى عبد الرؤوف ورد أمس✅
5/إيمان محب فتحي ورد أمس ✅
6/نجلاء  فتحي حسين ورد  أمس ✅
7/ندى إبراهيم نظير ورد 9/9  آية 49:50 ويوم الجمعه 18 /9 ✅`

describe('regular list', () => {
  const list = parseManualList(REGULAR, { year: 2026, month: 10, day: 10 })

  test('reads the header', () => {
    expect(list.header).toEqual({
      teacherName: 'شيماء وجيه',
      supervisorName: 'سمية',
      date: { year: 2026, month: 10, day: 10 },
      kind: 'regular',
    })
    expect(defaultSessionTypeFor(list.header.kind)).toBeNull()
  })

  test('reads every line, with or without a space after the number', () => {
    expect(list.lines.map((l) => l.name)).toEqual([
      'فاطمة علي محمد',
      'هبه فؤاد الخرباوى',
      'هدير مجدي الهيتي',
      'نجوى احمد ابوالمجد',
      'رحمة أحمد عيد',
    ])
    expect(list.lines.every((l) => l.done && !l.skipped)).toBe(true)
    expect(list.lines.every((l) => l.note === null && l.makeupDates.length === 0)).toBe(true)
    expect(list.multipleLists).toBe(false)
  })
})

describe('exam make-up list', () => {
  const list = parseManualList(EXAM_MAKEUP, { year: 2026, month: 10, day: 4 })

  test('reads the header, including a bare d/m/y date line', () => {
    expect(list.header).toEqual({
      teacherName: 'مروة',
      supervisorName: 'راندا',
      date: { year: 2026, month: 10, day: 4 },
      kind: 'exam_makeup',
    })
    expect(defaultSessionTypeFor(list.header.kind)).toBe('اختبار')
  })

  test('does not read the date line as entry number 4', () => {
    expect(list.lines).toHaveLength(12)
    expect(list.lines[0].name).toBe('ميسون حسن أحمد')
  })

  test('✅ with a variation selector is done, 🗣 is skipped', () => {
    expect(list.lines[4]).toMatchObject({ name: 'آية محمد محمد', done: true, skipped: false })
    expect(list.lines[5]).toMatchObject({ name: 'اسماء السيد ناصر', done: false, skipped: true })
    expect(list.lines[11]).toMatchObject({ name: 'شهد علاء عبد المعطي', done: false, skipped: true })
    expect(list.lines.filter((l) => l.done)).toHaveLength(10)
  })

  test('an exam make-up line is not a day make-up', () => {
    expect(list.lines.every((l) => !l.makeupUnresolved && l.makeupDates.length === 0)).toBe(true)
  })
})

describe('make-up list', () => {
  // 7 Oct 2026 is a Wednesday
  const list = parseManualList(MAKEUP, { year: 2026, month: 10, day: 7 })

  test('reads the header, with a yearless date and doubled slashes', () => {
    expect(list.header).toEqual({
      teacherName: 'ياسمين',
      supervisorName: 'إيمان أسامة أحمد',
      date: { year: 2026, month: 10, day: 7 },
      kind: 'makeup',
    })
    expect(defaultSessionTypeFor(list.header.kind)).toBe('تعويض')
  })

  test('keeps duplicated numbers as separate lines, in order', () => {
    expect(list.lines).toHaveLength(8)
    expect(list.lines[3].name).toBe('سلوى سمير خليفة')
    expect(list.lines[4].name).toBe('إسراء مصطفى عبد الرؤوف')
  })

  test('a four-word name is not cut at the make-up details', () => {
    expect(list.lines[1].name).toBe('صفا محمد حافظ الجلم')
  })

  test('ورد أمس is the day before the halaqa', () => {
    expect(list.lines[0]).toMatchObject({
      name: 'أمانة كامل',
      done: true,
      makeupDates: [day(2026, 10, 6)],
      makeupUnresolved: false,
      note: null,
    })
    expect(list.lines[6].makeupDates).toEqual([day(2026, 10, 6)])
  })

  test('a weekday is the most recent one before the halaqa', () => {
    // Monday before Wednesday 7 Oct
    expect(list.lines[2]).toMatchObject({
      name: 'آية محمد محمد',
      makeupDates: [day(2026, 10, 5)],
    })
  })

  test('explicit dates are read, a weekday before a date is not counted twice, and the rest is a note', () => {
    expect(list.lines[7]).toMatchObject({
      name: 'ندى إبراهيم نظير',
      makeupDates: [day(2026, 9, 9), day(2026, 9, 18)],
      makeupUnresolved: false,
      note: 'آية 49:50',
    })
  })
})

const ACCUMULATED = `📖 مقــــرأة درجــــات الجنــــة 📖
📍المُعلمــــة/ رضوى أحمد 
📍المشرفـــــة/راندا عمرو&شيماء 
📍التاريخ/١ نوفمبــــــــر 
⛔️فضــــلاً كتــابة الاســم ثلاثــي 
📍 مقرأة الورد المتراكم 

-------------------

١-شيماء فؤاد انيس ورد الجمعه✅
٢-ميسون حسن أحمد ورد ١٤ و١٥  اكتوبر✅
٣-علا طه علي ..ورد أمس ✅
٤-إيناس محمد نبيل (ورد الجمعة )✅
٥-أمنية سمير عبد المحسن استدراك يوم الخميس ٢٩ اكتوبر✅
٦-حفصه محمد امين ورد امس✅
٧-سوزان أحمد عبد الغفار ورد الجمعة✅
٨-نورا سعد عبدالغنى ورد آلأتنين والثلاثاء ✅
٩-أمنية جمال عبدالناصر.. ورد أمس ✅
١٠-بسمة موسي منصور تعويض ٢٣ و٢٩ أكتوبر✅
١١-هناء جلال عواد تسميع ورد  يوم29و 30✅


١٢-منة الله أيمن سيد استدراك ورد أمس ويوم 29✅
١٣-هبة الله السيد هويدي تسميع ورد امبارح ✅

🚨 انتهى التسجيل 🚨`

describe('accumulated wird list (مقرأة الورد المتراكم)', () => {
  // 1 Nov 2026 is a Sunday
  const list = parseManualList(ACCUMULATED, { year: 2026, month: 11, day: 1 })
  const oct = (d: number) => day(2026, 10, d)

  test('is a make-up list, and every line is a تعويض', () => {
    expect(list.header).toMatchObject({ teacherName: 'رضوى أحمد', date: { year: 2026, month: 11, day: 1 }, kind: 'makeup' })
    expect(list.lines).toHaveLength(13)
    expect(list.lines.every((l) => l.sessionType === 'تعويض' && l.done && !l.makeupUnresolved)).toBe(true)
  })

  test('names stop before the details, dots and all', () => {
    expect(list.lines[2].name).toBe('علا طه علي')
    expect(list.lines[8].name).toBe('أمنية جمال عبدالناصر')
    expect(list.lines[3].name).toBe('إيناس محمد نبيل')
  })

  test('every line gets its days', () => {
    expect(list.lines.map((l) => l.makeupDates)).toEqual([
      [oct(30)], // ورد الجمعه
      [oct(14), oct(15)], // ١٤ و١٥ اكتوبر
      [oct(31)], // ..ورد أمس
      [oct(30)], // (ورد الجمعة )
      [oct(29)], // يوم الخميس ٢٩ اكتوبر
      [oct(31)], // امس
      [oct(30)],
      [oct(26), oct(27)], // آلأتنين والثلاثاء
      [oct(31)],
      [oct(23), oct(29)], // ٢٣ و٢٩ أكتوبر
      [oct(29), oct(30)], // يوم29و 30
      [oct(29), oct(31)], // ورد أمس ويوم 29
      [oct(31)], // امبارح
    ])
  })

  test('nothing but a replaced session type is left in the notes', () => {
    expect(list.lines.map((l) => l.note)).toEqual([
      null, null, null, null, null, null, null, null, null, null, 'تسميع', null, 'تسميع',
    ])
  })
})

describe('edge cases', () => {
  const halaqa = { year: 2026, month: 1, day: 5 }

  test('a yearless date after the halaqa belongs to the previous year', () => {
    const list = parseManualList('مقرأة استدراك\n1- سارة علي حسن ورد 28/12 ✅', halaqa)
    expect(list.lines[0].makeupDates).toEqual([day(2025, 12, 28)])
  })

  test('a make-up line with no readable day is flagged for the reviewer', () => {
    const list = parseManualList('مقرأة استدراك\n1- سارة علي حسن ورد سورة البقرة ✅', halaqa)
    expect(list.lines[0]).toMatchObject({ makeupDates: [], makeupUnresolved: true })
  })

  test('the bot format: notes, session type and a make-up in brackets', () => {
    const list = parseManualList(
      ['١. فاطمة علي - متأخرة (تسميع) ✅', '٢. عائشة محمد (تعويض: ٣ يناير) 🗣️'].join('\n'),
      halaqa
    )
    expect(list.lines[0]).toMatchObject({ name: 'فاطمة علي', sessionType: 'تسميع', note: 'متأخرة', done: true })
    expect(list.lines[1]).toMatchObject({
      name: 'عائشة محمد',
      sessionType: 'تعويض',
      makeupDates: [day(2026, 1, 3)],
      skipped: true,
      done: false,
    })
  })

  test('a bare day after the halaqa day is last month, and a missing day is not invented', () => {
    const list = parseManualList('مقرأة استدراك\n1- سارة علي حسن ورد يوم 3 و 31 ✅', { year: 2026, month: 3, day: 2 })
    // 3 Feb exists, 31 Feb doesn't: the whole phrase is left for the reviewer
    expect(list.lines[0]).toMatchObject({ makeupDates: [], makeupUnresolved: true })
    const ok = parseManualList('مقرأة استدراك\n1- سارة علي حسن ورد يوم 3 ✅', { year: 2026, month: 1, day: 2 })
    expect(ok.lines[0].makeupDates).toEqual([day(2025, 12, 3)])
  })

  test('a verse number is not a day', () => {
    const list = parseManualList('مقرأة استدراك\n1- سارة علي حسن ورد أمس آية 12 ✅', halaqa)
    expect(list.lines[0]).toMatchObject({ makeupDates: [day(2026, 1, 4)], note: 'آية 12' })
  })

  test('ورد as a given name is kept', () => {
    const list = parseManualList('1- ورد محمد علي ✅', halaqa)
    expect(list.lines[0].name).toBe('ورد محمد علي')
  })

  test('relative days count from the date written on the list, not the post', () => {
    // The list says 7 Oct but is pasted into an 8 Oct post
    const list = parseManualList(MAKEUP, { year: 2026, month: 10, day: 8 })
    expect(list.lines[0].makeupDates).toEqual([day(2026, 10, 6)])
    expect(list.lines[2].makeupDates).toEqual([day(2026, 10, 5)])
  })

  test('without a written date, relative days count from the post', () => {
    const list = parseManualList('مقرأة استدراك\n1- سارة علي حسن ورد أمس ✅', halaqa)
    expect(list.lines[0].makeupDates).toEqual([day(2026, 1, 4)])
  })

  test('numbering with an underscore, alone or before a dot', () => {
    const list = parseManualList(
      [
        '📖 مقــــرأة الــدعم 📖',
        '📍المعــلمة / منى صلاح',
        '📍المشــرفة / راندة محمد ',
        '📍التـــاريخ / 10 نوفمبر ٢٠٢٦',
        '⛔️فضــــلاً كتــابة الاســم ثلاثــي',
        '---------',
        'ــــــــ',
        '1_ بسمه سامى محمد ✅',
        '2_ نادية عبدالله حجاج  ✅',
        '3_. تهاني السيد أحمد ناجي ✅',
        '4_  هدير مجدي الهيتي  ✅',
      ].join('\n'),
      { year: 2026, month: 11, day: 10 }
    )
    expect(list.header).toMatchObject({ teacherName: 'منى صلاح', supervisorName: 'راندة محمد' })
    expect(list.lines.map((l) => l.name)).toEqual([
      'بسمه سامى محمد',
      'نادية عبدالله حجاج',
      'تهاني السيد أحمد ناجي',
      'هدير مجدي الهيتي',
    ])
    expect(list.lines.every((l) => l.done)).toBe(true)
  })

  test('two lists in one paste are detected', () => {
    expect(parseManualList(`${REGULAR}\n\n\n${EXAM_MAKEUP}`, halaqa).multipleLists).toBe(true)
  })
})

test('foldArabic folds spelling variants', () => {
  expect(foldArabic('إسراء مصطفى عبد الرؤوف')).toBe('اسراء مصطفي عبد الرووف')
  expect(foldArabic('المُعلمــــة')).toBe('المعلمه')
})

describe('matchNameLocally', () => {
  const students = [
    { id: 'a', name: 'آية محمد' },
    { id: 'b', name: 'إسراء مصطفى عبدالرؤوف' },
    { id: 'c', name: 'فاطمة علي' },
    { id: 'd', name: 'فاطمة علي حسن' },
    { id: 'e', name: 'سارة' },
    { id: 'f', name: 'منى محمد' },
    { id: 'g', name: 'منى محمد الشرقاوي' },
    { id: 'h', name: 'منى محمد السيد' },
  ]

  test('a shorter stored name that starts the written one', () => {
    expect(matchNameLocally('آية محمد محمد', students)).toBe('a')
  })

  test('spelling variants and a split compound name', () => {
    expect(matchNameLocally('اسراء مصطفى عبد الرؤوف', students)).toBe('b')
  })

  test('an exact match wins over a longer name it starts', () => {
    expect(matchNameLocally('فاطمة علي', students)).toBe('c')
    expect(matchNameLocally('فاطمة علي حسن', students)).toBe('d')
    expect(matchNameLocally('منى محمد الشرقاوي', students)).toBe('g')
  })

  test('ambiguous or one-word partial matches are left to the reviewer', () => {
    // Starts both منى محمد الشرقاوي and منى محمد السيد, but is not either
    expect(matchNameLocally('منى محمد', [students[6], students[7]])).toBeNull()
    expect(matchNameLocally('سارة أحمد علي', students)).toBeNull()
    expect(matchNameLocally('هدى محمود', students)).toBeNull()
  })

  // The ways names in real lists went unmatched, with made-up names
  const roster = [
    { id: 'salma', name: 'سلمى خالد الشريف' },
    { id: 'rana', name: 'رنا يوسف الحسيني' },
    { id: 'layla', name: 'ليلى سعيد حسن' },
    { id: 'suha', name: 'سهى كمال زكي' },
    { id: 'amal', name: 'أمل السيد فتحي الجمال' },
    { id: 'momina', name: 'مؤمنة رامي العلي' },
    { id: 'marwa', name: 'مروة رامي العلي' },
  ]

  test('ال added or dropped on a later name', () => {
    expect(matchNameLocally('سلمى خالد شريف', roster)).toBe('salma')
    expect(matchNameLocally('رنا يوسف حسيني', roster)).toBe('rana')
    expect(matchNameLocally('امل سيد فتحي', roster)).toBe('amal')
  })

  test('a missing space between two names', () => {
    expect(matchNameLocally('ليلىسعيد حسن', roster)).toBe('layla')
  })

  test('a one-letter typo is only a fallback', () => {
    expect(matchNameLocally('سهى كمال ذكي', roster)).toBeNull()
    expect(matchNameWithTypo('سهى كمال ذكي', roster)).toBe('suha')
    // Shortened written names compare with the start of the stored one
    expect(matchNameWithTypo('امل السيد فتحى الجمل', roster)).toBe('amal')
  })

  test('a typo close to two students, or a one-word name, is not guessed', () => {
    // مروة and مؤمنة share the rest of the name, yet only one is a letter away
    expect(matchNameWithTypo('مرمنة رامي العلي', roster)).toBe('momina')
    // One letter from both حسن and حسين
    const twins = [
      { id: 'x', name: 'منى علي حسن' },
      { id: 'y', name: 'منى علي حسين' },
    ]
    expect(matchNameWithTypo('منى علي حسان', twins)).toBeNull()
    expect(matchNameWithTypo('ايمن', [{ id: 'x', name: 'ايمان' }])).toBeNull()
  })
})

describe('session type typed onto the name', () => {
  test('is split off the last word', () => {
    const list = parseManualList('١.ريم فاروق حامدتسميع✅\n٢.هند عادل نصر تسميع✅', { year: 2026, month: 11, day: 11 })
    expect(list.lines[0].name).toBe('ريم فاروق حامد')
    expect(list.lines[0].sessionType).toBe('تسميع')
    expect(list.lines[0].note).toBeNull()
    expect(list.lines[1].name).toBe('هند عادل نصر')
  })

  test('a first name is never split', () => {
    const list = parseManualList('١.رحمةدعم', { year: 2026, month: 11, day: 11 })
    expect(list.lines[0].name).toBe('رحمةدعم')
  })
})
