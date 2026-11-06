# Student Affairs (قسم شؤون الطالبات) Support — Work Plan

Source: voice note explaining the needs to a colleague (Nov 2026). The closing
part, about how exam scores are shared, is out of scope here.

## Background: what Student Affairs does today

There are two teams on the supervision side:

- **Supervision (فريق الإشراف):** fully served by HalaqaBot already. All that's
  left for them is support: bugs, confusing behaviour, small requests.
- **Student Affairs (فريق الشؤون):** about 4 sisters, each covering 1–2 days a
  week. They still do everything by hand, in a large Excel sheet that covers
  every student and every day.

Their weekly workflow has three steps:

| # | Step | How it's done today | Pain |
|---|------|---------------------|------|
| 1 | **Transcribing the lists (تفريغ القوائم)** | After each halaqa, the supervisor posts the final list in the lists group (جروب القوائم). At the end of the day, the Student Affairs sister on duty goes through every list name by name and marks each student in Excel: attended / absent / did a make-up (استدراك). | Very time-consuming: several halaqas a day, one name at a time. |
| 2 | **Absences and grades (حساب الغياب والدرجات)** | At the end of the week they count each student's absences and make-ups. The grade starts from the exam score; each absence costs a deduction, and make-ups have a maximum number that counts. | Manual counting from the sheet. |
| 3 | **Contacting students (التواصل مع الطالبات)** | Current rule: a student absent 3 days in a row gets a message ("are you OK? why were you away?"). They note the result in Excel, e.g. "contacted on day X, no reply" or "replied, had a valid excuse (عذر قهري)". | Works well (it has kept several students from leaving the programme); it's only the record-keeping that's manual. |

**Key insight:** steps 1 and 2 shouldn't need doing at all. Supervisors already
run the lists in HalaqaBot and exam scores are entered there, so the data
exists. Two gaps stop the bot's data from being complete. Close them and
HalaqaBot can produce the attendance and grades directly.

### The two gaps

1. **Halaqas that fall back to a manual list.** A supervisor hits a problem
   (a bot issue, her own connection, anything) and finishes the halaqa by hand.
   The bot's record stops part-way, or never starts.
2. **Zoom halaqas.** When teachers or time slots are tight, a Zoom halaqa
   sometimes runs at the same time as the Telegram one. Only the Telegram one
   is recorded. A Google Meet halaqa in the future would have the same problem.

---

## The three tasks (one Linear ticket each)

### Task 1 — Manual lists: edit or add a halaqa from a pasted list

**Goal:** every halaqa ends up in HalaqaBot, whatever platform it ran on or
however it was finished.

Two entry points, sharing one parse, match, review and apply pipeline:

- **1a. تعديل الحلقة بقائمة يدوية (edit a halaqa with a manual list)**, on an
  existing session. The supervisor pastes the final manual list she reached.
  The bot works out the difference from what it has and corrects the session.
- **1b. إضافة حلقة بقائمة يدوية (add a halaqa with a manual list)**, for a
  halaqa the bot never saw (Zoom, Meet, …). It creates a new session from the
  pasted list. Its number doesn't matter.

**Flow (both entry points):**

1. A modal with a textarea, where the supervisor pastes the list.
2. **Parse** each line into: name, activity type (تلاوة / تسميع / تعويض plus
   the dates it covers), done ✅, skipped 🗣️, notes. Manual lists probably copy
   the bot's own format (`١. name - notes (type) 🗣️ ✅`, see
   `bot-task.service.ts` → `formatMessage`), so a deterministic parser should
   handle most lines. Use AI only for messy lines.
3. **Match** names to students using the same approach as
   `matchBulkScores` / `BulkScoreModal`: Groq, small-integer ids, the Arabic
   spelling folding we already use, and matching against `getChannelStudents`
   rather than only the session roster.
4. **Review table** (reuse the `BulkScoreModal` patterns): confidence per row,
   `StudentPickerModal` to fix a match, `RegisterUserModal` for a student who
   isn't in the system yet (likely for Zoom attendees). For 1a, show the change
   as a diff: *to add / to mark done / to un-mark / type changed / to remove*.
5. **Apply** in one mutation. The supervisor reviews, fixes anything misread,
   then locks the session as usual.

**Backend work:**

- New mutation `applyManualList({ chatId, postId, sessionNumber | null, entries, mode })`:
  - Done entries go to `participationHistory`, with `completedAt` set to the
    **halaqa's date, not `Date.now()`**. Attendance is grouped by the
    `completedAt` day, so a list entered the next morning would otherwise land
    on the wrong day.
  - Entries that aren't done go to `turnQueue`.
  - In 1a mode, entries the list no longer contains get removed or un-done.
- New optional fields so manual data stays auditable:
  - `sessions.source`: `"telegram" | "manual_fix" | "manual_external"`.
  - `sessions.platform`: `"telegram" | "zoom" | "meet" | "other"`.
  - `participationHistory.source` / `turnQueue.source`: `"manual"`, set on
    rows created this way.
- 1b creates the session through a new path, **not** `startNewSession`.
  `startNewSession` auto-locks the previous session, which is wrong when the
  Zoom halaqa runs at the same time as the Telegram one.
- The bot must never try to post or update a Telegram list message for a
  `manual_external` session.

**Where a Zoom halaqa lives (proposal):** as an extra session under that day's
Telegram post. This reuses all existing views, locking and attendance with no
new concepts. It does need a post for that day; see question Q5.

**Prerequisite:** go through the real manual lists in the lists group and
collect 10–20 samples as parser test fixtures, including messy ones.

**Size:** M–L. Parsing and matching are most of the effort; apply and UI reuse
existing pieces.

---

### Task 2 — Weekly absences and grades report

**Goal:** replace the end-of-week counting in Excel.

Once Task 1 is in place, everything needed already exists:

- Attendance per student per day: `participationHistory`, grouped by day.
- Make-ups (استدراك): `تعويض` entries with `compensatingForDates`. The existing
  views already credit these to the day being made up.
- Exam scores: `اختبار` entries with `score`.

**Work:**

- One pure, unit-tested function, `computeWeeklyGrade(student, week, rules)`,
  that applies Student Affairs' rules: the exam score as the base, a deduction
  per absence, and a cap on how many make-ups count. Hard-code the rules in v1;
  move them to a per-channel `gradingRules` setting only if they change often.
- Query `getWeeklyReport({ chatId, weekStart })`, returning for each student
  in the week:
  - day-by-day status: attended / absent / made up / excused
  - absences, make-ups and the exam score
  - deductions and the final grade
- New web route `/weekly`, linked from the Home cards:
  - A student × day grid with totals and the grade.
  - A **"needs follow-up"** list of students absent 3 days in a row. This feeds
    Task 3.
  - An **export** shaped like their current Excel columns: CSV download, or a
    copy-to-clipboard they can paste into the sheet.
- Extend or align the existing `AttendanceRecord` page (it counts تسميع only
  today) so both pages use the same definition of "attended".

**Prerequisites:**

- The exact rules (Q1–Q4).
- A copy of their Excel sheet, so the export matches it.

**Size:** M. Most of it is getting the rules right; the data is already there.

---

### Task 3 — Student contact log (سجل التواصل)

**Goal:** move the "contacted on X, outcome Y" notes out of Excel.

**Deferred:** the bot messaging students itself. Telegram bots can't start a
conversation with a user who hasn't started the bot first, so this would be
unreliable. Revisit later.

**Work:**

- New table `studentContacts`, with fields `{ chatId, userId, contactedAt,
  contactedBy, outcome, excuse?, note?, absenceDates? }`:
  - `contactedBy` is the admin's user id.
  - `outcome` is one of `"no_reply" | "excused" | "not_excused" | "other"`.
  - `absenceDates` records which absences the contact was about.
  - Indexes `by_chat_user` and `by_chat_contacted`.
- Mutations to add, edit and delete a contact entry.
- UI:
  - A **سجل التواصل** section on the student page (`StudentStats`): a timeline
    plus an "add contact" form.
  - The Task 2 follow-up list shows whether each student has already been
    contacted since her latest absence streak, and lets the user log a contact
    in place.
- If an excused absence doesn't count against the grade (Q6), Task 2 reads
  these entries.

**Size:** S–M. It's independent of Task 1 and can run alongside it.

---

## Suggested order and milestones

1. **Groundwork.** The colleague supervises one halaqa start to finish in
   HalaqaBot (ask Randa to add her as a supervisor), collects sample manual
   lists, and gets the Excel sheet and the rules from Student Affairs.
2. **Task 1**, then a trial with real manual lists from the lists group.
3. **Task 2**, checked against one past week that Student Affairs already
   calculated by hand. The numbers should match exactly before anyone relies
   on them.
4. **Task 3**, which can run alongside Task 1 or 2.
5. **Rollout:**
   - explainer videos for supervisors (Task 1) and Student Affairs (Tasks 2–3)
   - support and questions over WhatsApp
   - a short period where Student Affairs runs both Excel and the bot, then
     switches over

## Open questions

**Grades and attendance rules (block Task 2)**

- **Q1.** What exactly counts as "attended"? Any completed turn (تلاوة,
  تسميع, تطبيق, …), only تسميع, or just being on the list? Does a registered
  student who never got her turn count as present or absent?
- **Q2.** What is the grading formula?
  - Is the base the week's exam score?
  - How much does each absence deduct (the voice note says "e.g. absent twice
    → one point")?
  - What is the make-up cap, and what happens past it?
- **Q3.** Which days is a student expected to attend? Every day there's a
  halaqa, or a fixed set of days per student? What does a week run from and to
  (Saturday–Friday?)
- **Q4.** Who is on the roster? Today a student counts once she has ever taken
  a turn, so anyone who left the programme would show as absent forever. Do we
  need an active/withdrawn flag, or a list of enrolled students from Student
  Affairs?

**Terminology and data**

- **Q5.** Is استدراك the same thing as the existing تعويض type? Is there ever
  a day with only a Zoom halaqa and no Telegram post? That decides whether a
  Zoom halaqa can always hang off a post.
- **Q6.** Does an accepted excuse (عذر قهري) cancel the deduction for that
  absence? Which excuses are accepted?

**Access and process**

- **Q7.** Are the Student Affairs sisters admins of the channel? The web app
  only lets channel admins in (`channelAdmins`). If they aren't, they'll need
  to be added, or we need a separate read-only role.
- **Q8.** Who can use "edit/add a halaqa with a manual list": only the
  session's supervisor, or any admin (e.g. Student Affairs fixing a list
  afterwards)? Should a locked session be editable this way?
- **Q9.** Is there a target date? The voice note mentions wanting progress by
  next week. Which part should land first: Task 1, or Task 3 since it's
  independent?
