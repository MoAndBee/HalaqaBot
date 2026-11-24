import { describe, expect, test } from 'bun:test'
import { computeMonthlyAbsence, dayKey, type AbsenceInput, type AbsenceParticipation } from './absence'

// Local-time timestamp, mid-morning like real halaqas
const at = (month: number, d: number, hour = 8) => new Date(2026, month - 1, d, hour).getTime()

const tasmee = (month: number, d: number): AbsenceParticipation => ({
  completedAt: at(month, d),
  sessionType: 'تسميع',
})
const exam = (month: number, d: number): AbsenceParticipation => ({
  completedAt: at(month, d),
  sessionType: 'اختبار',
})
const makeUp = (doneMonth: number, doneDay: number, ...forDays: [number, number][]): AbsenceParticipation => ({
  completedAt: at(doneMonth, doneDay),
  sessionType: 'تعويض',
  compensatingForDates: forDays.map(([m, d]) => at(m, d, 0)),
})

// November 2026, viewed on Nov 11: Nov 1..10 are countable
const base = (over: Partial<AbsenceInput>): AbsenceInput => ({
  year: 2026,
  month: 10,
  today: '2026-11-11',
  participations: [],
  courseExamTimes: [],
  markedExams: [],
  removedAt: null,
  ...over,
})

const everyDay = (from: number, to: number, skip: number[] = []) => {
  const out: AbsenceParticipation[] = []
  for (let d = from; d <= to; d++) if (!skip.includes(d)) out.push(tasmee(11, d))
  return out
}

describe('dayKey', () => {
  test('pads month and day', () => {
    expect(dayKey(at(3, 5))).toBe('2026-03-05')
  })
})

describe('ordinary days', () => {
  test('every calendar day before today counts; today does not', () => {
    const r = computeMonthlyAbsence(base({ participations: everyDay(1, 11, [4, 7]) }))
    expect(r.required).toBe(10)
    expect(r.absent).toBe(2)
    expect(r.rate).toBeCloseTo(0.2)
  })

  test('تلاوة or مراجعة alone is an absence', () => {
    const r = computeMonthlyAbsence(
      base({
        participations: [
          ...everyDay(1, 10, [5]),
          { completedAt: at(11, 5), sessionType: 'تلاوة' },
        ],
      })
    )
    expect(r.absent).toBe(1)
  })

  test('a تعويض covers the day it makes up, not the day it was done', () => {
    const r = computeMonthlyAbsence(
      base({ participations: [...everyDay(1, 10, [3, 6]), makeUp(11, 6, [11, 3])] })
    )
    // Nov 3 made up; Nov 6 (when the make-up was done) still missed
    expect(r.absent).toBe(1)
    expect(r.units.find((u) => !u.present)?.days).toEqual(['2026-11-06'])
  })

  test('nothing before her first participation counts', () => {
    const r = computeMonthlyAbsence(base({ participations: everyDay(6, 10) }))
    expect(r.required).toBe(5)
    expect(r.absent).toBe(0)
  })

  test('nothing from the day she was removed counts', () => {
    const r = computeMonthlyAbsence(
      base({ participations: everyDay(1, 4), removedAt: at(11, 6, 15) })
    )
    // Nov 1..5 count, Nov 5 missed
    expect(r.required).toBe(5)
    expect(r.absent).toBe(1)
  })

  test('no participations at all: nothing to report', () => {
    const r = computeMonthlyAbsence(base({}))
    expect(r.rate).toBeNull()
  })

  test('other months are not counted', () => {
    const r = computeMonthlyAbsence(
      base({ participations: [tasmee(10, 30), ...everyDay(1, 10)] })
    )
    expect(r.required).toBe(10)
  })
})

describe('marked exam over two days', () => {
  const markedExams = [{ name: 'اختبار الجزء ٣', days: ['2026-11-07', '2026-11-08'] }]
  const courseExamTimes = [at(11, 7), at(11, 8)]
  const ordinary = everyDay(1, 10, [7, 8])

  test('sat on day 1: present, no تسميع needed on day 2', () => {
    const r = computeMonthlyAbsence(
      base({ participations: [...ordinary, exam(11, 7)], markedExams, courseExamTimes })
    )
    // 8 ordinary days + 1 exam
    expect(r.required).toBe(9)
    expect(r.absent).toBe(0)
    const unit = r.units.find((u) => u.kind === 'exam')!
    expect(unit.name).toBe('اختبار الجزء ٣')
    expect(unit.days).toEqual(['2026-11-07', '2026-11-08'])
  })

  test('sat on day 2: present', () => {
    const r = computeMonthlyAbsence(
      base({ participations: [...ordinary, exam(11, 8)], markedExams, courseExamTimes })
    )
    expect(r.absent).toBe(0)
  })

  test('sat on neither: one absence, not two', () => {
    const r = computeMonthlyAbsence(base({ participations: ordinary, markedExams, courseExamTimes }))
    expect(r.required).toBe(9)
    expect(r.absent).toBe(1)
  })

  test('تسميع on an exam day does not count as sitting the exam', () => {
    const r = computeMonthlyAbsence(
      base({ participations: [...ordinary, tasmee(11, 7), tasmee(11, 8)], markedExams, courseExamTimes })
    )
    expect(r.absent).toBe(1)
  })

  test('a تعويض covering an exam day does not count', () => {
    const r = computeMonthlyAbsence(
      base({ participations: [...ordinary, makeUp(11, 9, [11, 7])], markedExams, courseExamTimes })
    )
    expect(r.absent).toBe(1)
  })

  test('not counted until its last day has passed', () => {
    const r = computeMonthlyAbsence(
      base({ today: '2026-11-08', participations: everyDay(1, 6), markedExams, courseExamTimes })
    )
    // Nov 1..6 only; the exam ends today
    expect(r.required).toBe(6)
    expect(r.units.some((u) => u.kind === 'exam')).toBe(false)
  })
})

describe('unmarked exam days', () => {
  test('each is a one-day exam where only اختبار counts', () => {
    const r = computeMonthlyAbsence(
      base({
        participations: [...everyDay(1, 10), exam(11, 4)],
        courseExamTimes: [at(11, 4), at(11, 5, 9), at(11, 5, 11)],
      })
    )
    // 8 ordinary days + two one-day exams; she did only تسميع on Nov 5
    expect(r.required).toBe(10)
    expect(r.absent).toBe(1)
    expect(r.units.find((u) => !u.present)).toMatchObject({ kind: 'exam', days: ['2026-11-05'] })
  })

  test('a day with both تسميع and اختبار in the course is an exam day', () => {
    const r = computeMonthlyAbsence(
      base({ participations: everyDay(1, 10), courseExamTimes: [at(11, 9)] })
    )
    expect(r.units.find((u) => u.days.includes('2026-11-09'))).toMatchObject({
      kind: 'exam',
      present: false,
    })
  })
})

describe('exam across two months', () => {
  const markedExams = [{ name: 'نهاية الشهر', days: ['2026-10-31', '2026-11-01'] }]
  const courseExamTimes = [at(10, 31), at(11, 1)]
  const participations = [exam(10, 31), ...everyDay(2, 10)]

  test('counts in the month of its last day', () => {
    const nov = computeMonthlyAbsence(base({ participations, markedExams, courseExamTimes }))
    expect(nov.units.filter((u) => u.kind === 'exam')).toHaveLength(1)
    expect(nov.absent).toBe(0)

    const oct = computeMonthlyAbsence(
      base({ month: 9, participations, markedExams, courseExamTimes })
    )
    expect(oct.units).toHaveLength(0)
  })
})

describe('نسبة التعويض', () => {
  test('days made up ÷ ordinary days; one تعويض covering two days counts twice', () => {
    const r = computeMonthlyAbsence(
      base({ participations: [...everyDay(1, 10, [2, 3, 6]), makeUp(11, 5, [11, 2], [11, 3])] })
    )
    expect(r.days).toBe(10)
    expect(r.compensatedDays).toBe(2)
    expect(r.compensationRate).toBeCloseTo(0.2)
    expect(r.units.filter((u) => u.compensated).map((u) => u.days[0])).toEqual([
      '2026-11-02',
      '2026-11-03',
    ])
  })

  test('exam days are left out of both sides', () => {
    const markedExams = [{ name: 'اختبار', days: ['2026-11-07', '2026-11-08'] }]
    const r = computeMonthlyAbsence(
      base({
        participations: [...everyDay(1, 10, [4, 7, 8]), makeUp(11, 9, [11, 4], [11, 7])],
        markedExams,
        courseExamTimes: [at(11, 7)],
      })
    )
    // 8 ordinary days; the make-up for the exam day isn't counted
    expect(r.days).toBe(8)
    expect(r.compensatedDays).toBe(1)
    expect(r.compensationRate).toBeCloseTo(1 / 8)
  })

  test('a day she also did تسميع on is not a تعويض day', () => {
    const r = computeMonthlyAbsence(
      base({ participations: [...everyDay(1, 10), makeUp(11, 6, [11, 3])] })
    )
    expect(r.compensatedDays).toBe(0)
    expect(r.compensationRate).toBe(0)
  })

  test('a تعويض done this month for last month counts in last month', () => {
    const participations = [tasmee(10, 30), ...everyDay(1, 10), makeUp(11, 2, [10, 31])]
    expect(computeMonthlyAbsence(base({ participations })).compensatedDays).toBe(0)
    const oct = computeMonthlyAbsence(base({ month: 9, participations }))
    expect(oct.days).toBe(2)
    expect(oct.compensatedDays).toBe(1)
  })
})
