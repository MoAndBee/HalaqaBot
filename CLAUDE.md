# CLAUDE.md

## Convex environments (cloud env)

The cloud environment provides these variables. Values are set as environment secrets, never committed to the repo.

```
CONVEX_URL=https://wry-crab-519.convex.cloud

CONVEX_DEPLOY_KEY_DEV=<set in env secrets>
CONVEX_DEPLOY_KEY_PROD_READ=<set in env secrets>
CONVEX_DEPLOY_KEY_PROD_WRITE_CAUTION=<set in env secrets>
```

### Which key to use

- **Reading data** (the default when the user asks to "read", "check", "look up", or "show" data): use `CONVEX_DEPLOY_KEY_PROD_READ`. Assume this means prod data.
- **Writing data to prod**: only when the user explicitly asks to write, and only after they confirm. Then use `CONVEX_DEPLOY_KEY_PROD_WRITE_CAUTION`. Show what will change before running it.
- **Local testing and development**: use `CONVEX_URL` together with `CONVEX_DEPLOY_KEY_DEV`.

### Running commands

Always set one of the keys inline on any Convex command (`bunx convex ...`, scripts that hit Convex, etc.). Do not rely on a key being exported in the shell. For example:

```
CONVEX_DEPLOY_KEY=$CONVEX_DEPLOY_KEY_PROD_READ bunx convex data <table>
CONVEX_DEPLOY_KEY=$CONVEX_DEPLOY_KEY_DEV bunx convex dev --once
```
