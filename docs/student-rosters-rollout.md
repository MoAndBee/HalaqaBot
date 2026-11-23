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
