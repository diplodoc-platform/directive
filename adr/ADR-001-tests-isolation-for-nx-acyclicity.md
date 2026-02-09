# ADR-001: Tests isolation in a separate package to avoid Nx circular dependency

## Status

Accepted

## Context

`@diplodoc/directive` provides directive syntax parsing and helper APIs for integrating directives into MarkdownIt and the Diplodoc transformer. The package is used by `@diplodoc/transform` and by extensions that depend on transform (e.g. `@diplodoc/cut-extension`). Unit tests for directive need to run markdown through the full transformer pipeline and therefore depend on `@diplodoc/transform`.

In the Diplodoc monorepo, Nx builds the task graph from `package.json` dependencies. The default build rule uses `dependsOn: ["^build"]`, so building any package requires building all of its dependencies first.

## Problem

When directive declared `@diplodoc/transform` as a devDependency (to run tests that use `transform()`), the following cycle appeared in the Nx build graph:

```
@diplodoc/testpack:build
  → @diplodoc/cli:build
    → @diplodoc/page-constructor-extension:build
      → @diplodoc/transform:build
        → @diplodoc/cut-extension:build
          → @diplodoc/directive:build
            → @diplodoc/transform:build   ← cycle
```

Nx reported:

```
Could not execute command because the task graph has a circular dependency
@diplodoc/testpack:build --> ... --> @diplodoc/directive:build --> @diplodoc/transform:build
```

So the e2e/build flow (e.g. `nx build @diplodoc/testpack`) failed. Removing the tests’ dependency on transform (e.g. by deleting the tests folder or its separate package.json) had been tried earlier and led to losing the test setup; restoring it reintroduced the cycle.

## Decision

Keep tests that require `@diplodoc/transform` in a **separate directory with its own `package.json`**, which is **not** a workspace root in the monorepo. The main package `@diplodoc/directive` does **not** depend on `@diplodoc/transform`; only the test suite does, in an isolated dependency tree.

Concretely:

1. **Layout**
   - `packages/directive/` — main package (no dependency on `@diplodoc/transform`).
   - `packages/directive/tests/` — separate Node project with its own `package.json` (e.g. name `@diplodoc/directive-tests`, `private: true`).

2. **Main package**
   - Remove `@diplodoc/transform` (and test-only devDependencies such as `vitest`, `jsdom`, `ts-dedent`) from `packages/directive/package.json`.
   - Test scripts in the main package run the suite by changing into `tests/` and executing vitest there (e.g. `cd tests && npm install && npx vitest run --config ../vitest.config.mjs`).
   - `tsconfig.json` in the main package excludes the `tests` directory.

3. **Tests package**
   - `tests/package.json` declares dependencies (or devDependencies) on `@diplodoc/directive` (e.g. `file:..`) and `@diplodoc/transform`, plus vitest, jsdom, ts-dedent, etc.
   - Test sources live under `tests/src/` (e.g. `directive.test.ts`), importing from `@diplodoc/directive` and `@diplodoc/transform`.
   - Vitest is run from the `tests/` directory with the config in the parent (`../vitest.config.mjs`), so include paths like `src/**/*.test.ts` resolve to `tests/src/`.

4. **Monorepo**
   - The root `workspaces` array does **not** include `packages/*/tests`, so `packages/directive/tests` is not a workspace package and is not part of the Nx project graph. No `directive → transform` edge is introduced at build time.

This pattern matches the one used in `extensions/cut/tests/` (separate `package.json` and tests that use transform).

## Consequences

### Positive

- **Nx build is acyclic**: `@diplodoc/directive` no longer depends on `@diplodoc/transform`, so `nx build @diplodoc/testpack` (and any other build that pulls in directive) can complete.
- **Tests remain**: All tests that need the full transformer pipeline stay in `tests/` and keep running (e.g. via `npm run test` from the directive package).
- **Clear boundary**: Only the test subproject depends on transform; the published directive package stays minimal and cycle-free.
- **Consistency**: Same approach as in cut-extension and other packages that test with transform.

### Negative

- **Two places to maintain**: Dependency and tooling (vitest, tsconfig) are maintained in both the main package and `tests/`.
- **Extra install step**: Running tests from the main package requires `cd tests && npm install` (or equivalent) so the test environment has its own lockfile and dependencies.
- **No Nx task for directive tests**: The tests are run via npm script, not as a first-class Nx target; CI/workflows must invoke the directive’s `test` script explicitly if needed.

### Neutral

- Snapshot and minor output differences may appear when test dependencies (e.g. markdown-it) are updated in `tests/`; they are resolved in the usual way (e.g. `vitest -u` or adjusting expectations).

## Alternatives Considered

1. **Remove tests that use transform**  
   - Avoids the cycle but loses coverage for behaviour that depends on the full pipeline; rejected.

2. **Mock or stub transform in the main package**  
   - Would allow keeping a single package and no transform dependency, but complicates tests and does not exercise the real integration; rejected for the main suite.

3. **Move directive below transform in the dependency tree**  
   - Would require refactoring so transform does not depend on directive (e.g. moving directive inside transform or inverting roles); large and out of scope for fixing the build.

4. **Keep tests in the main package and use a separate Nx configuration**  
   - Nx would still see the devDependency in `package.json` and the cycle would remain unless we split the project; the chosen approach (separate directory with its own package.json) is the minimal split that breaks the cycle.

## Related

- [AGENTS.md](../AGENTS.md) — Development and testing workflow for the directive package.
- Same pattern: `extensions/cut/tests/` with its own `package.json` and dependency on `@diplodoc/transform`.
