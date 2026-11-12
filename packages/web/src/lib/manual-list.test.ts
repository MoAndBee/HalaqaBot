import { describe, expect, test } from 'bun:test'
import { parseManualList, defaultSessionTypeFor, foldArabic, matchNameLocally } from './manual-list'

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
})
