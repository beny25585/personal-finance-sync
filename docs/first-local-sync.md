# First manual synchronization on a personal Linux computer

The personal Linux computer is not currently accessible. This guide prepares the handoff; no real synchronization has occurred. The managed development environment must not receive real banking credentials. Android is the client target, but its connection and deployment architecture remain undecided.

## Local preparation without banking credentials

When the personal computer becomes accessible, open the user's repository there. These instructions are on branch `docs/first-local-sync`, which includes the 11 repeat-import tests. They are not yet merged into `main`. Do not overwrite or discard existing work when switching branches.

Inspect the actual host before choosing installation commands:

```bash
cat /etc/os-release
uname -m
git --version
node --version
bun --version
command -v chromium chromium-browser google-chrome
```

The host's distribution, installed runtimes, browser, display, and credential service have not been verified. Missing tools need installation appropriate to that host; the development container's setup is not evidence about it. Use a normal user account, not root.

After reviewing dependency install scripts, with Bun and the required Node version installed:

```bash
bun install --ignore-scripts
npm rebuild better-sqlite3
bun run prebuild
bun run test -- tests/integration/repeat-import.test.ts tests/integration/leumi-max-sync.test.ts tests/unit/dedup.test.ts tests/integration/database.test.ts
```

The selected 90 tests passed in the managed development environment. They must be checked on the local host. They use synthetic records and do not validate live authentication.

Check the existing OS-keychain integration without supplying any banking credentials:

```bash
bun -e 'import { hasKeychainSupport } from "./src/security/keychain.ts"; const ok = await hasKeychainSupport(); console.log(ok ? "KEYCHAIN_PROBE_OK" : "STOP_KEYCHAIN_UNAVAILABLE"); process.exit(ok ? 0 : 1);'
```

This calls the project's existing probe, which writes and deletes a synthetic value. A successful probe establishes availability for that invocation, not the security of the whole machine or future unattended access. If it fails, stop before entering banking credentials and inspect the local Secret Service setup. The current application can fall back to an encrypted file whose key is stored beside it; that fallback must not be mistaken for verified OS-keychain storage.

At this preparation stage report only OS/runtime versions, test counts, and the probe result. Do not send environment dumps, credential values, account information, transactions, or screenshots to chat.

## Manual bank connection after local readiness review

Perform this stage directly on the trusted personal machine with the user present. Its credential storage, data/backup protection, and any required display must first be reviewed. Do not ask an agent to receive passwords through chat or tool arguments.

The verified provider-add syntax is:

```bash
bun run src/cli/index.ts --no-auto-fetch providers add
```

There is no provider-name positional argument. Select **Bank → Bank Leumi** or **Credit card → Max** interactively, one provider at a time. The username prompt is visible and the password prompt is masked. Answer **No** at `Test connection?` when separating setup from the first explicit fetch; that connection test itself contacts the provider. Check the actual storage outcome locally. If the CLI reports file fallback, stop and review it before fetching.

After adding and reviewing one provider, the existing manual fetch commands are:

```bash
bun run src/cli/index.ts --no-auto-fetch fetch leumi --from 7d
# Only after Leumi has been reviewed and MAX separately configured:
bun run src/cli/index.ts --no-auto-fetch fetch max --from 7d
```

These commands contact real providers. They were not executed during preparation. The default aliases are `leumi` and `max` for the first instance; use the actual alias if a different one was selected. Do not rely on `--to` to constrain the range; the inspected service does not enforce it.

If a legitimate authentication challenge requires visible interaction, `providers add --visible` and `fetch ... --visible` exist, but require a usable local display. Neither the display nor MFA compatibility is established. Do not install a remote desktop or bypass provider protections automatically. Stop on unsupported MFA, blocked-account, or password-change messages rather than repeatedly retrying.

Review results locally against official statements, then repeat the same fetch and compare the unchanged records. A different added count alone is not proof of duplication: the provider's data may have changed between requests. Preserve evidence locally and avoid assumptions about identifier uniqueness or stability.

No scheduler, deployment, or mobile connection is enabled by these instructions. The next decision follows the actual local readiness and manual-sync results.
