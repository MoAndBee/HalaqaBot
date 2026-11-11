# Portable agent handoff

Prefer checking out `mohanad-80/HalaqaBot:codex/pr-165-staging-handoff`: it already contains the
environment helpers and [full runbook](../agent-environment-handoff.md).

Shared Convex staging is now `Bosla / halaqabotdb / staging`
(`perfect-clam-401`). Its old separate project was deleted. Reuse the existing
deployment and obtain its staging-scoped key privately; follow the runbook
for the Bosla Cloudflare/domain migration.

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
The archive contains environment helpers, not the backend security fix in
[PR #169](https://github.com/MoAndBee/HalaqaBot/pull/169). Follow the runbook
to include commit `0e4e8c9909d56bd7007f678d58afa8cd91cd1f6a` before deploying;
shared staging already runs that fix.

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
