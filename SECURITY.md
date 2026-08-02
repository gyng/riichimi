# Security policy

## Reporting

Do not disclose a suspected vulnerability in a public issue. Send a private report to the repository owner with the affected version, reproduction steps, impact, and any known mitigation. Do not include real captured hands, player data, credentials, or tokens in the report.

## Supported versions

Until the first public release, only the current `main` branch receives security fixes.

## Dependency triage

Dependency updates are pinned through `package-lock.json`, reviewed in grouped pull requests, and verified with the complete quality gate and web build. A new version is not adopted until it has been published for seven days; see the [dependency policy](docs/dependencies.md). Do not run `npm audit fix --force` — it resolves advisories by downgrading, and has proposed replacing a current dependency with a years-old major version.

An accepted finding is recorded here with the reason it is unreachable and the condition that would end the exception. There are no accepted findings at present.
