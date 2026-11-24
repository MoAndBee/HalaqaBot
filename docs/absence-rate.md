# نسبة الغياب (absence rate)

Shown in the stats card under a student's calendar (الطالبات → a student), for
the month shown in the calendar. The logic is in
`packages/web/src/lib/absence.ts` (tests in `absence.test.ts`); keep this page
and that file in step.

## What counts

The month is split into **units**. Each unit is either an ordinary day or an
exam.

- **Every calendar day is a halaqa day.** There are no break days. A day with
  no activity at all in the course still counts.
- **Ordinary day.** She attended if, that day, she did **تسميع** or **اختبار**,
  or a **تعويض** covers it (`compensatingForDates`). A تعويض counts for the
  days it makes up, not for the day it was done, like the attendance record.
  تلاوة, مراجعة, دعم and تطبيق alone don't count as attending.
- **Exam.** An exam is **one unit**, however many days it spans. She attended
  if she did **اختبار** on any one of its days. تسميع and تعويض don't count
  for an exam, and she doesn't need تسميع on an exam's days.
  - Admins mark which days make up one exam on the exams page (الاختبارات →
    تحديد أيام اختبار واحد), and give it a name. A day belongs to at most one
    exam.
  - Any day with an اختبار in the course that no admin marked is a **one-day
    exam**.

نسبة الغياب = missed units ÷ counted units. The card also shows نسبة الحضور,
"غابت X من Y" and the list of missed days and exams.

## What isn't counted

- **Today is never counted.** Only days before today, so nobody shows as absent
  while the day is still going.
- **An exam is counted only once its last day has passed**, and it counts in
  the month of its **last** day. An exam held on Nov 30 and Dec 1 appears in
  December's rate, even if she sat it on Nov 30.
- **Days after `removedAt` aren't counted.** Nothing from the day she was
  removed from the roster (`channelStudents.removedAt`) onward counts. If she
  is re-added, `removedAt` is cleared and that gap counts as absences. This is
  accepted for now; fixing it needs a history of removals.
- **Nothing before her first participation** in the course (of any type)
  counts, so a student who joined mid-month isn't absent before she joined.
  An exam counts if any of its days falls in her counted period.

## Time zone

Days are calendar days in the viewer's local time, like the rest of the web
app. Marked exam days are stored as `"YYYY-MM-DD"` strings.

## Exams page

The exams page lists exams, not days: a marked exam with all its days, and each
unmarked exam day on its own. Opening one shows every student who sat it across
its days (with the day, for multi-day exams). Copying results
(نسخ نتائج الاختبار) and pasting scores (إدخال الدرجات دفعة واحدة) both work on
the whole exam. A student the paste adds is filed under the exam's busiest
halaqa.

## Cost

The student page reads her own history (`by_user` index), the course's marked
exams, and only the shown month's اختبار rows through the
`participationHistory.by_chat_type_completed` index. It doesn't scan the
course's whole history.
