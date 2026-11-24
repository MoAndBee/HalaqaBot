// نسبة الغياب (absence rate) for one student in one calendar month.
// The rules are documented for admins in docs/absence-rate.md; keep the two in
// step.
//
// - Every calendar day is a halaqa day. Each day is one required unit, except
//   days that belong to an exam.
// - An exam is one unit however many days it spans. Admins mark multi-day
//   exams; any other day with an اختبار in the course is a one-day exam.
// - Ordinary day: present with a تسميع or اختبار that day, or a تعويض that
//   covers it.
// - Exam: present only with an اختبار on one of its days. تسميع and تعويض
//   don't count, and she doesn't need تسميع on exam days.
// - Today is never counted. An exam counts only once its last day has passed,
//   and in the month of its last day.
// - Nothing before her first participation in the course counts, nor anything
//   from the day she was removed from the roster.
//
// Days are calendar days in the viewer's local time, like the rest of the web
// app (the server runs in UTC).

/** A calendar day, "YYYY-MM-DD" in local time. Sorts chronologically as a string. */
export type DayKey = string

export function dayKey(timestamp: number): DayKey {
  const d = new Date(timestamp)
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${mm}-${dd}`
}

export interface AbsenceParticipation {
  completedAt: number
  sessionType: string
  compensatingForDates?: number[] | null
}

export interface MarkedExam {
  name: string
  days: DayKey[]
}

export interface AbsenceInput {
  year: number
  /** 0-based, like Date#getMonth */
  month: number
  today: DayKey
  /** Her participations in this course */
  participations: AbsenceParticipation[]
  /** Times of every اختبار anyone took in the course */
  courseExamTimes: number[]
  markedExams: MarkedExam[]
  /** When she was removed from the roster, if she still is */
  removedAt: number | null
}

export interface AbsenceUnit {
  kind: 'day' | 'exam'
  /** Name of a marked exam; unset for ordinary days and unmarked exam days */
  name?: string
  days: DayKey[]
  present: boolean
}

export interface AbsenceResult {
  units: AbsenceUnit[]
  required: number
  present: number
  absent: number
  /** absent ÷ required, 0..1; null when nothing is required */
  rate: number | null
}

const TASMEE = 'تسميع'
const EXAM = 'اختبار'

export function computeMonthlyAbsence(input: AbsenceInput): AbsenceResult {
  const { year, month, today, participations } = input

  const empty: AbsenceResult = { units: [], required: 0, present: 0, absent: 0, rate: null }
  if (participations.length === 0) return empty

  const start = participations.map((p) => dayKey(p.completedAt)).sort()[0]
  const removedDay = input.removedAt !== null ? dayKey(input.removedAt) : null
  const counts = (day: DayKey) => day >= start && (removedDay === null || day < removedDay)

  // What she did, by day
  const attended = new Set<DayKey>() // تسميع or اختبار
  const examined = new Set<DayKey>() // اختبار
  const compensated = new Set<DayKey>() // covered by a تعويض
  for (const p of participations) {
    if (p.compensatingForDates && p.compensatingForDates.length > 0) {
      // Same convention as the attendance record: a make-up counts toward the
      // days it covers, not the day it was done
      p.compensatingForDates.forEach((t) => compensated.add(dayKey(t)))
      continue
    }
    const day = dayKey(p.completedAt)
    if (p.sessionType === TASMEE || p.sessionType === EXAM) attended.add(day)
    if (p.sessionType === EXAM) examined.add(day)
  }

  // Exams: marked ones, plus a one-day exam for every other day with an اختبار
  const exams: { name?: string; days: DayKey[] }[] = input.markedExams.map((e) => ({
    name: e.name,
    days: [...e.days].sort(),
  }))
  const examDays = new Set(exams.flatMap((e) => e.days))
  for (const day of new Set(input.courseExamTimes.map(dayKey))) {
    if (!examDays.has(day)) {
      exams.push({ days: [day] })
      examDays.add(day)
    }
  }

  const monthPrefix = `${year}-${String(month + 1).padStart(2, '0')}-`
  const units: AbsenceUnit[] = []

  for (const exam of exams) {
    const last = exam.days[exam.days.length - 1]
    if (!last.startsWith(monthPrefix) || last >= today) continue
    const countedDays = exam.days.filter(counts)
    if (countedDays.length === 0) continue
    units.push({
      kind: 'exam',
      ...(exam.name !== undefined && { name: exam.name }),
      days: exam.days,
      present: exam.days.some((d) => examined.has(d)),
    })
  }

  const daysInMonth = new Date(year, month + 1, 0).getDate()
  for (let d = 1; d <= daysInMonth; d++) {
    const day = `${monthPrefix}${String(d).padStart(2, '0')}`
    if (day >= today || examDays.has(day) || !counts(day)) continue
    units.push({
      kind: 'day',
      days: [day],
      present: attended.has(day) || compensated.has(day),
    })
  }

  units.sort((a, b) => (a.days[a.days.length - 1] < b.days[b.days.length - 1] ? -1 : 1))
  const present = units.filter((u) => u.present).length
  const required = units.length
  return {
    units,
    required,
    present,
    absent: required - present,
    rate: required === 0 ? null : (required - present) / required,
  }
}
