# Production releases

The `Production release` GitHub Actions workflow owns routine releases after the
2026-11-20 cutover. It targets Bosla Worker `halaqabot`,
`https://halaqabot.bosla.to`, and Convex production `incredible-lyrebird-981`.
Keep the old Coolify bot stopped and its automatic deployments disabled. Keep
Cloudflare Workers Builds' production command as its existing manual/no-op;
GitHub Actions is the release path.

## Release switch and first release

Repository Actions variable `PRODUCTION_RELEASE_ENABLED` must equal `true` for
any production deployment. It is initially `false` while the operator reviews
the setup. Merging the workflow with this switch off runs preparation only.
Neither a successful test run nor a manual dispatch bypasses the switch.

After the operator explicitly approves releasing the latest changes:

1. Merge the workflow PR with the release switch still off. Let its `Test` and
   production preparation runs finish successfully.
2. Set `PRODUCTION_RELEASE_ENABLED=true` in repository Actions variables.
3. Run `Production release` from **main**, entering the full current main SHA
   in `release_sha`. This runs tests, builds and dry-runs before deployment.
4. Inspect the release summary and perform the phone checks below.

Subsequent successful `Test` runs triggered by pushes to main automatically
start production preparation and release while the switch remains enabled.
PR test runs never deploy. A missing switch or any value other than `true`
disables releases. Turning it off prevents new deployment jobs; it does not
cancel an already-running deployment. Do not cancel a release between its two
deployment steps without checking the resulting production state.

## Credentials and GitHub protection

The workflow reads these GitHub Actions secrets only in the deployment job:

| Secret | Purpose |
| --- | --- |
| `PRODUCTION_CLOUDFLARE_API_TOKEN` | Dedicated Cloudflare deployment API token restricted to Bosla / bosla.to; Edit Cloudflare Workers permissions plus Queues Edit |
| `PRODUCTION_CONVEX_DEPLOY_KEY` | Deployment-scoped write key beginning `prod:incredible-lyrebird-981\|` |
| `PRODUCTION_CONVEX_AUTH_PRIVATE_KEY` | Existing production signing JWK, for read-only authenticated smoke checks |

The production Worker already holds its runtime secrets. Routine releases
preserve them and do not upload the full env file, change signing keys, set
the Telegram webhook/menu, create queues, disable cron, or repeat the cutover.
Convex environment values, including JWKS and Groq, are also retained.

The deployment job names the `production` GitHub environment. A repository
administrator can pre-create it, restrict deployment branches to `main`, and
move the three secrets there. A required reviewer can also be configured if
releases should require approval every time. Without those settings, GitHub
can create the environment when the first deployment runs and the workflow uses
repository secrets. Maintain access can configure repository Actions secrets
and variables, but cannot configure environment protection.

## What runs

Preparation selects one exact commit, rejects stale main candidates, installs
the lockfile with Bun 1.3.14, builds/types-checks DB and bot, builds the frontend
with the production Convex URL, and dry-runs the account-pinned Worker config.
Manual releases and workflow PRs also run the full local test suite; automatic
releases require an already successful push-to-main `Test` run for that SHA.
Prepared frontend assets are retained for seven days as a GitHub artifact, with
`release.json` recording their commit.

The deployment job performs read-only credential, Worker binding, auth and HTTPS
checks, then checks that main still matches the candidate. It deploys Convex
first, then the Worker with the prepared assets and the normal production cron.
Production releases are serialized and never automatically cancelled. If main
advances after the final check, the following tested release runs afterward.

Post-deploy checks verify HTTPS routes, unsigned auth/webhook rejection,
authenticated existing-channel reads, anonymous Convex denial, the production
frontend backend URL, and the expected asset commit. The job summary records the
source commit and active Worker version IDs, and checks the Worker's version tag
matches the released commit. These checks do not send Telegram
messages or modify app data.

## Failure and phone checks

A failed deployment stops the workflow. If Convex succeeded and the Worker
failed, inspect compatibility and fix forward; the workflow does not blindly
roll back the backend or restore a data snapshot. Follow the existing
[recovery procedure](production-cutover.md#5-rollback) when recovery is needed.

After releasing PR #178, use an existing production admin's phone to open a
halaqa, open **أضف مشرفة**, check the eligible supervisor list, verify an incorrect
passcode is rejected, then add an intended supervisor using the correct passcode.
Also repeat the pending fresh `/admin` command and returned panel-button check.
Use only an agreed test halaqa or a supervisor change the operator intends.
