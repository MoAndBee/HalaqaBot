# Course rosters and admin soft-remove: rollout

Two data steps must run on production once this change is deployed. Until the
backfill (step 2) has run, every course's Students page and student search are
empty, because the roster now comes from `channelStudents` and nothing has
filled it yet. Run both right after the release that ships this change.

Both use the production write key, so check with the maintainer first and run
them from `packages/db`.

## 1. Merge نورا فؤاد حسن's hand-registered account (decided 2026-11-23)

Her hand-registered account (`userId -2`) holds one exam score: 9, in
"دورة مراجعة سورة البقرة" (chat -1004448548155), post 4984, session 6. It moves
to her Telegram account (`5339050460`, @Norafouad), and the hand-registered
account is deleted. Preview it first:

```
CONVEX_DEPLOY_KEY=$CONVEX_DEPLOY_KEY_PROD_WRITE_CAUTION bunx convex run migrations/mergeManualStudent:mergeManualStudent '{"manualUserId": -2, "telegramUserId": 5339050460, "dryRun": true}'
```

The preview should list one `participationHistory` row (post 4984, score 9), no
queue rows, and the `users` row to delete. Then run it with `"dryRun": false`.
It refuses and changes nothing if her Telegram account already has that turn.

## 2. Fill the rosters

```
CONVEX_DEPLOY_KEY=$CONVEX_DEPLOY_KEY_PROD_WRITE_CAUTION bunx convex run migrations/enrollStudents:run
```

```
CONVEX_DEPLOY_KEY=$CONVEX_DEPLOY_KEY_PROD_READ bunx convex run migrations/enrollStudents:report
```

The backfill enrolls everyone with a queued or completed turn in a course, plus
anyone hand-registered into one. It leaves out the ended course
"دورة أصحاب سورة البقرة" (chat -1003233862716). It is safe to rerun.

Expected from the 2026-11-23 prod read: no roster for -1003233862716, and
same-name pairs (students with two Telegram accounts) in the other two: 3 in
-1004448548155 and 4 in -1003931211469, which are 5 distinct people. The pairs show in the Students
page's "حسابات مكررة" filter. Nothing is merged or deleted for them.

## Admin soft-remove

No data step. From this release, an admin Telegram no longer lists keeps her
`channelAdmins` row with `removedAt` set: no access, not offered as a
supervisor, name still shown on past halaqas. Admins removed before this release
were deleted and stay deleted.

## 3. Old Telegram accounts in the Aal Imran course (decided 2026-11-23)

Four students in "دورة أصحاب سورة آل عمران" (chat -1003931211469) moved to a new
Telegram account. Their old accounts posted nothing in this course, but admins
kept picking them by their identical names, so 11 turns, including 5 exam
scores, landed on the old accounts. A rename does not cause this: students are
keyed by Telegram user ID, which never changes.

`migrations/mergeStudentAccounts` moves the old account's turns in this course
to the new account and takes the old account off this course's roster. Other
courses are untouched. Dry-run each pair first, then rerun with `"dryRun": false`:

| Old account | New account |
|---|---|
| 5663778282 | 1706430170 (@Doaakotp) |
| 6394724516 | 8910263729 (@Haifa_2022) |
| 758360644 (@mumina000) | 5005254081 (@Design000Corner) |
| 1076437838 (@Hoda_Ramdan) | 8999542475 (@Hoda_R_Morsy) |

```
CONVEX_DEPLOY_KEY=$CONVEX_DEPLOY_KEY_PROD_WRITE_CAUTION bunx convex run migrations/mergeStudentAccounts:mergeStudentAccounts '{"chatId": -1003931211469, "fromUserId": 5663778282, "toUserId": 1706430170, "dryRun": true}'
```

A turn the new account already has (same halaqa and type) is not moved; the dry
run lists it under `clashes` with both scores. Expected: one for @mumina000, the
exam of 2026-11-04 (post 33058, session 8): 18 on the old account, 19 on the new.
Decided 2026-11-23: 19 is her real score. For this pair, run with
`"onClash": "keepNew"`, which deletes the old account's 18.
