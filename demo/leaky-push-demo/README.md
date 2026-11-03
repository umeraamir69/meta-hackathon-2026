# Leaky push demo (video)

Tiny fixture repo with **fake** secret-shaped values. Shows the Sentinel **pre-commit** and **pre-push** hooks blocking a bad commit/push so nothing ships.

These are not live credentials — docs-shaped placeholders only.

## One-shot setup

```bash
./setup.sh
```

That:

1. `git init` (if needed)
2. Commits a **clean** seed (`README.md` + `setup.sh` only)
3. Leaves `app.py` and `config.json` **untracked** (they hold the fake keys)
4. Installs Sentinel **pre-commit** + **pre-push** hooks from `../../project`

## Show the block (on camera)

```bash
git add app.py config.json
git commit -m "ship credentials"
```

Expect: hook runs `pr-diff-sentinel --staged` → **FAIL** → commit aborted.

Optional push beat (after a `--no-verify` commit, or with secrets still in the tree):

```bash
git push
```

Expect: **pre-push** scans the working tree → FAIL.

Bypass only if you must (never in the video): `git commit --no-verify` / `git push --no-verify`.

## Reset between takes

```bash
./setup.sh --reset
```
