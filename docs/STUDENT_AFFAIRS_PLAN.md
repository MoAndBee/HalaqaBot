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

## Needed work

1. **Edit or add a halaqa from a pasted manual list.** It reads the list and
   matches names, reusing the paste-and-match flow from bulk exam scores. The
   supervisor checks a review screen, then saves. My suggestion is to put a
   Zoom halaqa in as an extra session under that day's Telegram post.

2. **User roles.** We need to introduce roles to the list of users we have.
   Now, anyone who ever took a turn counts as a student forever, so students
   who left would show as absent every week.

3. **Removing a student from a program.** There needs to be a way to remove a
   student from a program so we don't end up reporting on them forever.

4. **Accepted absences.** An option to record absence as accepted so it
   doesn't deduct from the student's score.

5. **Students absent 3 days in a row.** List students who have been absent for
   3 days in a row. This needs to be done in a way that allows for historical
   checks in case Student Affairs are late in contacting the absent students.

6. **Student notes.** Notes feature on each student to record contacts and
   relevant information.

## Open questions

- Which days is each student expected to attend?
- Are there holidays that shouldn't count in the absence records?
