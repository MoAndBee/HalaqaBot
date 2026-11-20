# Portable agent handoff

Use the current PR #165 migration branch:
`MoAndBee/HalaqaBot:claude/telegram-cloudflare-workers-migration-c09q4a`.
PRs #168 and #169 were merged into it; it includes the environment helpers,
security fix, active Bosla configs and [full runbook](../agent-environment-handoff.md).

Staging is already live at **https://halaqabot-staging.bosla.to**, backed by
`Bosla / halaqabotdb / staging` (`perfect-clam-401`). The old separate Convex
project was deleted. The personal-account Worker remains only for rollback,
with its scheduler disabled. Reuse the existing resources and obtain the
staging-scoped credentials privately. The [completed hosting cutover](../bosla-staging-cutover.md)
records the account, domain and verification; do not rerun it as initial setup.

The bundle also contains [production preparation](../production-cutover.md) and a
[copyable maintainer prompt](../production-maintainer-prompt.md). Its build/dry-run
helper makes no live changes. Only the production operator should execute the
coordinated release, with real production credentials and the required confirmation.

For an agent starting from the pinned PR #165 commit, download this directory's
`halaqabot-agent-handoff.tar.gz` and `SHA256SUMS`, then:

```bash
sha256sum -c SHA256SUMS
tar -tzf halaqabot-agent-handoff.tar.gz
tar -xzf halaqabot-agent-handoff.tar.gz
```

Extract outside your checkout before switching branches. Read the extracted
`docs/agent-environment-handoff.md`. The archive contains a patch for the exact
base commit in `manifest.json`, the runbook and supporting docs; it contains no
environment files, dependency folders, built web assets, or live credentials.
Obtain private secrets separately. Do not apply its patch over the stacked branch.
The archive now includes both the environment changes and the merged backend
security fix. Do not cherry-pick #169 on top of it or apply it over the current
migration branch. For a new checkout at the pinned base:

```bash
git switch -c setup/bosla-staging 5b00b67d2378d8f7f29073ab4fc58d1d833742f8
git apply --check /path/to/halaqabot-agent-handoff/pr-165-environment.patch
git apply --index /path/to/halaqabot-agent-handoff/pr-165-environment.patch
git commit -m "Apply complete staging handoff"
```

From the repository root, regenerate after changing included sources:

```bash
python3 scripts/build-agent-handoff.py
python3 scripts/build-agent-handoff.py --check
```

The script has an explicit source allowlist, builds without touching the real
Git index, verifies patch application/tree equality, checks known local secret
values when available, and uses deterministic archive metadata. `--check` also
detects stale documentation or helper code in the archive. Source code is
reviewable directly in this PR; the archive is a portable copy, not a second
independent implementation.
