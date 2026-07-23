# ADR 0001: React, Expo, TypeScript 7, and Oxc

- Status: accepted
- Date: 2026-07-23

## Context

Riichimi needs one product language across Android, iOS, and web; direct camera access; shared domain code; offline model inference; and a fast, strict TypeScript feedback loop.

## Decision

- Use React 19 with Expo 57, React Native 0.86, React Native Web, and Expo Router.
- Use npm workspaces for the initial monorepo.
- Use TypeScript 7 with strict options.
- Use Oxlint with `oxlint-tsgolint` for type-aware rules and project diagnostics.
- Use Oxfmt as the only formatter.
- Use Vitest for framework-free packages and Jest Expo plus React Native Testing Library for React Native behavior.
- Keep scoring and vision policy in framework-free packages so runtime and UI mechanisms remain replaceable.

## Consequences

The client can share most interface code while retaining platform-specific adapters. TypeScript 7 and type-aware Oxlint provide one fast correctness gate. Two test runners are justified by different runtimes: Vitest stays fast for pure packages, while Jest Expo provides supported React Native transforms and native-module behavior.

Native ONNX integration will require an Expo development build rather than Expo Go. Model runtime selection remains behind a port and is intentionally deferred until the vision proof of concept.
