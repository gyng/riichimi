# Security policy

## Reporting

Do not disclose a suspected vulnerability in a public issue. Send a private report to the repository owner with the affected version, reproduction steps, impact, and any known mitigation. Do not include real captured hands, player data, credentials, or tokens in the report.

## Supported versions

Until the first public release, only the current `main` branch receives security fixes.

## Dependency triage

Dependency updates are pinned through `package-lock.json`, reviewed in grouped pull requests, and verified with the complete quality gate and web export. Do not run `npm audit fix --force`; it may replace Expo with an incompatible version.

As of 2026-07-23, `npm audit --omit=dev` reports a moderate `uuid` advisory (`GHSA-w5hq-g745-h8pq`) through Expo's Xcode/configuration toolchain. Richii does not invoke the affected UUID buffer API, and the package is build tooling rather than shipped application behavior. npm currently proposes an incompatible downgrade from Expo 57 to Expo 46. The project therefore accepts this transitive finding temporarily and will remove the exception when Expo updates the dependency chain. Re-evaluate it on every Expo upgrade or if the affected code becomes reachable.
