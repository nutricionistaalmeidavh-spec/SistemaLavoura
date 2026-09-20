# P8 Map Robustness Design

## Intent

P8 hardens the existing agricultural map, offline map package, GIS import, and field-mode flows so that a commercial installation remains safe when downloads fail, storage is constrained, local packages are damaged, geometry is invalid, farms span more than one state, or the dataset grows to thousands of fields.

The mandatory core remains local-first and R$0 to operate. P8 must not introduce a paid API, an ArtiSys server, a mandatory account, or a new cloud dependency. Existing P0-P7 behavior remains compatible.

## Success Criteria

P8 is complete when the product can demonstrate all of the following:

1. An interrupted map installation never destroys the last known-good package.
2. Startup/snapshot reconciliation can recover a valid backup after an interrupted replacement and can remove stale temporary files safely.
3. Disk-space failures are detected before installation when possible and are translated into stable, actionable errors if the operating system reports `ENOSPC` during work.
4. A newly generated PMTiles file is verified before promotion and receives locally stored integrity metadata.
5. An installed package can be explicitly checked later and reported as healthy, unverified, missing, corrupt, or outdated without deleting the user's last known-good package automatically.
6. Catalog refresh validates the complete existing manifest contract instead of accepting only `schemaVersion` plus `maps`.
7. A farm whose bounds cross more than one state is accepted only when the available catalog-bound coverage covers the complete farm bounds; partial coverage fails closed with a clear reason.
8. Invalid WGS84 coordinates, degenerate polygon rings, and self-intersecting field boundaries are rejected at GIS normalization boundaries.
9. Corrupt legacy field geometry cannot crash the whole agricultural map; invalid fields are surfaced as unmapped/invalid while valid fields continue rendering.
10. Building the agricultural map snapshot scales approximately linearly with field-related records rather than repeatedly scanning every collection for every field.
11. The PWA/mobile fallback still works without a desktop map provider or installed PMTiles package.
12. A clean Windows x64 data directory can initialize, install, verify, replace, recover, and remove a regional map package.
13. P0-P7 regression gates remain green on Linux and Windows.

## Current-State Findings

The current implementation already provides important foundations:

- `runtime/map-package-manager.mjs` creates map directories, verifies the PMTiles CLI checksum, runs `pmtiles extract` followed by `pmtiles verify`, uses a temporary output, renames the previous final file to a `.bak`, and uses `statfs` for a preflight disk-space estimate.
- `src/map-package-planner.js` validates the map manifest, derives farm bounds, discovers intersecting state packages, estimates package size, and supports farms that intersect multiple state bounding boxes.
- `src/gis-import.js` validates WGS84 coordinate ranges and closed polygon rings, but does not reject zero-area or self-intersecting rings.
- `src/agricultural-map.js` tolerates missing geometry, but it silently drops invalid points and repeatedly filters scouting/files/rainfall/operations/applications for each field, creating avoidable quadratic behavior at scale.
- `web/ui/offline-maps.jsx` exposes desktop availability and safe PWA fallback, but errors are currently plain strings and installed-package health is not modeled.

The remaining P8 work is therefore hardening, not a replacement of the map architecture.

## Approaches Considered

### A. Layered hardening of the existing modules — selected

Keep the current `map-package-manager`, planner, GIS domain, presentation layer, and UI contracts, and add explicit recovery/integrity primitives at their current boundaries.

Advantages:
- smallest regression surface;
- preserves P0-P7 contracts;
- no new runtime service or database;
- straightforward unit and integration testing;
- compatible with the one-time, local-first product model.

Trade-off:
- recovery state remains filesystem-based rather than being represented by a dedicated transactional database.

### B. New persistent map-job subsystem

Introduce a separate job database/state machine for queued downloads, retries, cancellation, recovery, and package inventory.

Advantages:
- strongest basis for future background download orchestration.

Trade-offs:
- substantially larger subsystem;
- migration and lifecycle complexity;
- unnecessary for P8's current success criteria;
- larger regression surface around Electron startup and persistence.

### C. Minimal test-only hardening

Add more tests and a few catch blocks without introducing integrity status, startup reconciliation, or strict topology validation.

Advantages:
- smallest code change.

Trade-off:
- does not actually solve process interruption, stale backups, corrupt installed packages, or geometry failures.

P8 selects approach A.

## Architecture

### 1. Stable Map Package Error Model

`runtime/map-package-manager.mjs` will expose a `MapPackageError` with stable `code`, human-readable `message`, and `retryable` metadata.

Initial codes:

- `MAP_UNSUPPORTED_RUNTIME`
- `MAP_CATALOG_UNAVAILABLE`
- `MAP_CATALOG_INVALID`
- `MAP_SOURCE_UNAVAILABLE`
- `MAP_DISK_FULL`
- `MAP_INSTALL_IN_PROGRESS`
- `MAP_EXTRACT_FAILED`
- `MAP_VERIFY_FAILED`
- `MAP_PACKAGE_EMPTY`
- `MAP_PACKAGE_MISSING`
- `MAP_PACKAGE_CORRUPT`
- `MAP_RECOVERY_FAILED`

Raw platform errors remain available as `cause`, but UI/presentation code must not need to parse OS-specific strings.

No error code changes the local agricultural data. A failed map operation affects only the optional basemap package.

### 2. Installation Transaction and Recovery

The package directory remains the source of truth for offline map files. Each package uses:

- final PMTiles file;
- metadata JSON;
- temporary `.part-*` file during extraction;
- `.bak` file only during replacement;
- lightweight transaction journal JSON while promotion is in progress.

Promotion order:

1. preflight disk space;
2. extract to unique temp path;
3. `pmtiles verify` temp path;
4. reject empty output;
5. compute SHA-256 and size of temp package;
6. write transaction journal atomically;
7. move current final file to backup if it exists;
8. rename verified temp file to final;
9. write package metadata atomically;
10. remove backup and transaction journal.

If any step fails, cleanup is best-effort and the previous known-good final package is restored whenever possible.

On `init()`/`snapshot()`, reconciliation will inspect transaction journals and known backup/temp naming patterns:

- final missing + backup present -> restore backup;
- final present + backup present -> keep final and remove backup only after final metadata/file checks pass;
- stale temp with no active in-process install -> remove temp;
- journal with no recoverable final/backup -> retain evidence, surface `MAP_RECOVERY_FAILED`, and do not invent a successful package.

The product never replaces a known-good final file with an unverified file.

### 3. Local Integrity Metadata

Package metadata schema gains a versioned local integrity block:

```json
{
  "metadataVersion": 1,
  "size": 123,
  "sha256": "...",
  "verifiedAt": "...",
  "catalogVersion": "2026.09.1",
  "sourceDate": "2026-09-20"
}
```

`snapshot()` performs cheap reconciliation based on metadata/file existence and size. It does not hash multi-gigabyte files on every screen load.

A new `verifyFarmMap({id})` action returns package health:

- `healthy`
- `unverified`
- `missing`
- `corrupt`
- `outdated`

For metadata version 1 packages, verification checks current file size and SHA-256 against the values captured after the successful structural `pmtiles verify` performed during installation. If the PMTiles CLI is already present locally, the explicit verification may also run structural `pmtiles verify`; it must not download the CLI or require network solely to validate an already installed package.

For legacy metadata without SHA-256, explicit verification computes local integrity metadata when a local PMTiles CLI is already available. If no local CLI exists, the package remains `unverified` and usable; P8 does not force a network download merely to upgrade metadata.

`outdated` means the package remains usable but the cached/published catalog has a newer relevant source/catalog version. P8 does not auto-delete or auto-update an outdated package.

### 4. Catalog Validation and Offline Fallback

`refreshCatalog()` must use the same semantic manifest validator used by the planner. Invalid remote catalogs do not overwrite the last valid cached catalog.

If the network is unavailable:

- a valid cached catalog remains usable for planning/status;
- a direct regional extraction that needs network fails with `MAP_SOURCE_UNAVAILABLE`;
- already installed packages remain usable;
- explicit verification of a version-1 package remains local;
- field mode and local agricultural data remain usable.

The product never treats a malformed downloaded manifest as valid merely because it is JSON.

### 5. Disk-Space Robustness

The existing `statfs` preflight remains, with two refinements:

- required bytes are derived from the best available estimate and include replacement/temporary overhead;
- any filesystem `ENOSPC`/equivalent encountered during CLI preparation, extraction promotion, metadata write, or recovery is normalized to `MAP_DISK_FULL`.

A disk-space failure must leave no promoted partial package and must preserve the previous final package if one existed.

If filesystem capacity cannot be measured, the operation may proceed, but runtime `ENOSPC` remains fail-closed.

### 6. Multi-State Coverage

`buildFarmMapDownloadPlan()` continues selecting all intersecting available state packages, but P8 adds a complete-coverage check using the geographic `bounds` declared by the published map catalog.

A plan is valid only if the union of available non-national package rectangles covers the complete farm bounding rectangle. This prevents a farm that crosses an unavailable catalog region from being accepted because another intersecting state happened to be available.

This is a package-coverage check, not cadastral validation of exact Brazilian state borders. Exact jurisdiction boundaries are outside P8 because the current distribution contract publishes rectangular bounds, not authoritative state polygons.

The output remains one farm-region PMTiles extraction. State packages are catalog/coverage inputs, not separately exposed farm files.

For a fully covered cross-state farm, `sources` contains every contributing state package in stable deterministic order.

### 7. GIS Topology Validation

`src/gis-import.js` will add deterministic polygon-ring validation without a paid/external GIS service.

For Polygon/MultiPolygon rings:

- WGS84 ranges remain mandatory;
- ring must be closed;
- at least three distinct non-closing vertices are required;
- zero-area/degenerate rings are rejected;
- non-adjacent segments may not self-intersect;
- adjacent segments may meet only at their shared endpoint.

P8 does not attempt full cadastral topology rules such as validating that every hole is contained in its outer ring or resolving overlapping neighboring fields. Those can be a later precision-GIS phase.

`geometryForField()` therefore cannot persist a self-intersecting boundary through the P6 import flow.

### 8. Safe Handling of Legacy/Corrupt Geometry

The agricultural read model must not silently discard malformed coordinates and then render a different polygon.

`src/agricultural-map.js` will use strict geometry normalization for mapped field boundaries. If an old/local record is invalid:

- the record is not rendered as a polygon;
- the field appears in `unmappedFields` with an `invalidGeometry` reason;
- the rest of the map snapshot is still generated.

This keeps the UI available while making bad data visible instead of mutating it silently.

### 9. Large Dataset Performance

`buildAgriculturalMapSnapshot()` will pre-index related collections by `fieldId` once:

- scouting;
- files;
- rainfall;
- operations;
- applications;
- geometries.

Field assembly then reads from these indexes rather than filtering every full collection for each field.

The target complexity is `O(fields + related records)` for relationship lookup, excluding unavoidable geometry point traversal and final serialization.

A stress regression test will build a snapshot with thousands of fields and related records and verify complete counts and bounded execution. Timing thresholds must be generous enough to avoid CI flakiness; the principal regression protection is the indexed implementation plus large-fixture completion.

### 10. Presentation and UI

`src/presentation-p5.js` adds `verifyFarmMap` to the offline-map screen contract and passes catalog version metadata into installation when available.

`web/ui/offline-maps.jsx` displays package health and actionable states:

- verified/healthy;
- unverified legacy package;
- update available;
- package missing;
- integrity problem.

Actions:

- retry installation by running the existing install action again;
- explicit `Verificar integridade` for an installed package;
- remove package;
- refresh catalog.

The UI will map stable error codes to Portuguese guidance instead of relying on regex over raw English error text. Raw technical details are not required for normal operation.

On PWA/mobile, desktop-only controls remain disabled and the existing message that field mode continues with locally stored agricultural data remains visible.

### 11. Clean Windows Behavior

A clean Windows x64 environment is a first-class P8 regression scenario:

- no `maps` directory;
- no CLI;
- no cached catalog;
- no installed package.

The manager must create required directories, verify the downloaded CLI archive before use, install a farm package atomically, verify it, replace it safely, and remove it.

Tests use injected filesystem/network/CLI behavior where practical; the Windows release gate still exercises actual Electron/NSIS packaging.

## Data Compatibility

Existing package metadata without `metadataVersion`/`sha256` remains readable.

Such packages are reported as `unverified`. If the local PMTiles CLI is already present, successful explicit structural verification computes SHA-256 and upgrades metadata in place to version 1. If the CLI is absent, P8 leaves the package unverified rather than requiring network access. P8 must not require users to redownload a valid pre-P8 package solely because metadata is older.

Existing field geometry records remain readable. Invalid legacy geometry is surfaced as invalid/unmapped rather than automatically rewritten.

No SQLite migration is required for P8 because map-package transaction/integrity state remains filesystem-local and GIS structures remain in the existing persistence collections.

## Testing Strategy

### Unit/domain

Add `tests/p8-map-robustness.test.js` covering:

- stable error normalization;
- disk preflight failure;
- runtime `ENOSPC` cleanup;
- interrupted replacement recovery;
- stale temp cleanup;
- missing/corrupt/unverified package status;
- local explicit integrity verification and metadata upgrade;
- verification without network requirement for version-1 metadata;
- invalid catalog preserving cached valid catalog;
- full cross-state catalog-bound coverage;
- partial cross-state coverage rejection;
- self-intersecting polygon rejection;
- degenerate polygon rejection;
- legacy invalid geometry safe degradation;
- thousands-of-fields map snapshot completion and counts.

Extend existing P4/P5, P6, and agricultural-map tests where the assertion belongs to an existing contract.

### E2E

Add `tests/e2e/p8-map-robustness.spec.mjs` for browser-visible fallback/status behavior that does not require a real Windows PMTiles process.

P8 E2E runs in a fresh Playwright segment, just like P6/P7, to avoid service-worker/browser-state contamination discovered during the previous certification fix.

### CI

Add `.github/workflows/p8-map-robustness.yml`:

- Node 22;
- full unit/contract suite;
- web build;
- Chromium install;
- P8 E2E;
- compatibility contract.

P0/P1/P2 continue to run unchanged and remain the release gates. P8 changes to `qa:web` must preserve P6/P7 process isolation.

## Files Expected to Change

Primary:

- `runtime/map-package-manager.mjs`
- `src/map-package-planner.js`
- `src/gis-import.js`
- `src/agricultural-map.js`
- `src/presentation-p5.js`
- `web/ui/offline-maps.jsx`
- `tooling/qa-web.mjs`
- `tests/map-package-manager.test.js`
- `tests/p4-p5-field-offline.test.js`
- `tests/p6-gis-import.test.js`
- `tests/p8-map-robustness.test.js`
- `tests/e2e/p8-map-robustness.spec.mjs`
- `.github/workflows/p8-map-robustness.yml`
- `docs/PRODUCT_STATUS.md` and/or `PRODUCT_STATUS.md`

Secondary files may change only when required by an existing contract or test fixture.

## Non-Goals

P8 does not add:

- satellite provider accounts;
- new paid APIs;
- an ArtiSys cloud backend;
- automatic background updates of map packages;
- full download pause/resume protocol;
- cadastral-grade polygon topology repair;
- automatic field-boundary correction;
- map-package distribution changes in `mapasbrasilrelease`;
- machinery/fleet duplication;
- fiscal or finance features.

## Release Gate

P8 may be merged only when:

1. P8-specific unit/domain tests are green;
2. P8 E2E is green;
3. P6 and P7 E2E remain green in their isolated segments;
4. P0 Linux regression/compatibility is green;
5. P0 Windows `release:certify` is green and produces the installer artifact;
6. P1 and P2 gates remain green;
7. no mandatory paid dependency has been introduced.

A passing P8-specific workflow alone is not sufficient for commercial certification.