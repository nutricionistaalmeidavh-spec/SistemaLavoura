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
5. An installed package can be explicitly verified later and reported as healthy, unverified, missing, corrupt, or outdated without deleting the user's last known-good package automatically.
6. Catalog refresh validates the complete existing manifest contract instead of accepting only `schemaVersion` plus `maps`.
7. A farm whose bounds cross more than one state is accepted only when the available catalog coverage covers the complete farm bounds; partial coverage fails closed with a clear reason.
8. Invalid WGS84 coordinates, degenerate polygon rings, and self-intersecting field boundaries are rejected at GIS normalization boundaries.
9. Existing valid manual field polygons that were persisted without a repeated closing coordinate remain readable; the read model may close a copy in memory for validation/rendering but must not silently rewrite persistence.
10. Corrupt legacy field geometry cannot crash the whole agricultural map; invalid fields are surfaced as unmapped/invalid while valid fields continue rendering.
11. Building the agricultural map snapshot scales approximately linearly with field-related records rather than repeatedly scanning every collection for every field.
12. The PWA/mobile fallback still works without a desktop map provider or installed PMTiles package.
13. A clean Windows x64 data directory can initialize, install, verify, replace, recover, and remove a regional map package.
14. P0-P7 regression gates remain green on Linux and Windows.

## Current-State Findings

The current implementation already provides important foundations:

- `runtime/map-package-manager.mjs` creates map directories, verifies the PMTiles CLI checksum, runs `pmtiles extract` followed by `pmtiles verify`, uses a temporary output, renames the previous final file to a `.bak`, and uses `statfs` for a preflight disk-space estimate.
- `src/map-package-planner.js` validates the map manifest, derives farm bounds, discovers intersecting state packages, estimates package size, and supports farms that intersect multiple state bounding boxes.
- `src/gis-import.js` validates WGS84 coordinate ranges and closed polygon rings, but does not reject zero-area or self-intersecting rings.
- `src/agricultural-map.js` tolerates missing geometry, but it silently drops invalid points and repeatedly filters scouting/files/rainfall/operations/applications for each field, creating avoidable quadratic behavior at scale.
- `web/ui/offline-maps.jsx` exposes desktop availability and safe PWA fallback, but errors are currently plain strings and installed-package health is not modeled.

The remaining P8 work is therefore hardening, not a replacement of the map architecture.

## Selected Approach

P8 uses layered hardening of the existing modules. The current `map-package-manager`, planner, GIS domain, presentation layer, and UI contracts remain in place, with explicit recovery/integrity primitives added at their existing boundaries.

This minimizes regression risk, preserves P0-P7 contracts, introduces no new runtime service/database, and fits the one-time local-first product model. A separate persistent map-job subsystem is deliberately out of scope.

## Architecture

### 1. Stable Map Package Error Model

`runtime/map-package-manager.mjs` exposes a `MapPackageError` with stable `code`, human-readable `message`, and `retryable` metadata.

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

Raw platform errors remain available as `cause`, but UI/presentation code does not need to parse OS-specific strings.

### 2. Installation Transaction and Recovery

Each package uses a final PMTiles file, metadata JSON, temporary `.part-*` file, `.bak` only during replacement, and a lightweight transaction journal JSON.

Promotion order:

1. preflight disk space;
2. extract to unique temp path;
3. `pmtiles verify` temp path;
4. reject empty output;
5. compute SHA-256 and size;
6. write transaction journal atomically;
7. move current final to backup if present;
8. rename verified temp to final;
9. write metadata atomically;
10. remove backup and journal.

Startup/snapshot reconciliation restores a backup if the final is missing, removes stale temp files, keeps a valid final if present, and preserves evidence when no safe recovery is possible. A known-good final is never replaced by an unverified file.

### 3. Local Integrity Metadata

Metadata schema gains:

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

`snapshot()` performs cheap file/size/version checks and does not hash multi-gigabyte files on every screen load.

`verifyFarmMap({id})` performs explicit PMTiles + SHA verification and returns one of:

- `healthy`
- `unverified`
- `missing`
- `corrupt`
- `outdated`

Pre-P8 metadata without SHA remains readable and is `unverified` until explicit verification upgrades it locally. Verification is local and does not require network access when the PMTiles CLI is already present; the product must not require re-downloading a valid old package solely to add integrity metadata.

### 4. Catalog Validation and Offline Fallback

Remote catalog refresh uses the same semantic manifest validator as planning. Invalid remote content never overwrites the last valid cache. Network failure leaves already installed maps and field-mode data usable.

### 5. Disk-Space Robustness

Existing `statfs` preflight remains. Runtime `ENOSPC` from CLI preparation, extraction, promotion, metadata write, or recovery is normalized to `MAP_DISK_FULL`. A disk-space failure preserves the previous final package whenever one existed.

### 6. Multi-State Coverage

Planning selects all intersecting available state packages, then verifies that their published `bounds` union covers the entire farm bounding rectangle. This is catalog-bounds coverage, not cadastral state-boundary validation.

Exact shared rectangle edges count as covered. Partial cross-state coverage fails closed.

### 7. GIS Topology Validation

Polygon/MultiPolygon rings require valid WGS84 coordinates, closure, at least three distinct non-closing vertices, non-zero area, and no non-adjacent segment self-intersection. Redundant collinear points are allowed when the ring still has non-zero area and no self-crossing.

Full cadastral topology repair, hole containment repair, and neighboring-field overlap correction remain out of scope.

### 8. Safe Handling of Existing Manual/Legacy Geometry

The agricultural read model uses a compatibility adapter for stored field boundaries. A valid manual ring persisted by earlier phases without a repeated closing point is copied and closed in memory before topology validation. The persisted record is not changed automatically.

Malformed/out-of-range/self-crossing legacy geometry is not rendered. The field appears in `unmappedFields` with an invalid-geometry reason, while the rest of the map continues to render.

### 9. Large Dataset Performance

`buildAgriculturalMapSnapshot()` pre-indexes related collections by `fieldId` once: scouting, files, rainfall, operations, applications, and geometries. Field assembly uses these indexes rather than filtering each full collection for every field.

Target lookup complexity is `O(fields + related records)`, excluding geometry point traversal and serialization. A 5,000-field stress regression protects this structure with a generous CI timing ceiling.

### 10. Presentation and UI

`src/presentation-p5.js` adds `verifyFarmMap`. `web/ui/offline-maps.jsx` displays health states and actionable guidance, including `Verificar integridade`, retry through existing installation, removal, and catalog refresh.

PWA/mobile keeps desktop package actions unavailable and retains field-mode usability.

### 11. Clean Windows Behavior

A clean Windows x64 environment remains a first-class P8 scenario: no maps directory, CLI, catalog, or package. The manager must initialize, verify CLI download, install atomically, verify, replace, recover, and remove a package. Existing Windows release certification remains mandatory.

## Data Compatibility

Existing map metadata without integrity fields remains readable as `unverified`. Existing valid manual field geometry remains readable even if stored unclosed; validation closes a copy in memory without rewriting persistence. Invalid legacy geometry is surfaced as invalid/unmapped.

No SQLite migration is required.

## Testing Strategy

`tests/p8-map-robustness.test.js` covers stable error normalization, disk failures, transaction recovery, stale temp cleanup, health states, explicit integrity upgrade, invalid catalog preservation, complete/partial multi-state coverage, topology rejection, legacy geometry compatibility, invalid-geometry degradation, 5,000-field snapshot completion, and P6/P7/P8 browser-process isolation.

`tests/e2e/p8-map-robustness.spec.mjs` covers browser-visible PWA fallback. P8 runs in a fresh Playwright process after baseline P0-P5, P6, and P7.

`.github/workflows/p8-map-robustness.yml` runs Node 22 unit/contracts, web build, Chromium P8 E2E, and compatibility. P0/P1/P2 remain the commercial Linux/Windows release gates.

## Non-Goals

P8 does not add satellite accounts, paid APIs, ArtiSys cloud backend, automatic background map updates, full pause/resume download protocol, cadastral-grade topology repair, automatic field-boundary correction, `mapasbrasilrelease` distribution changes, machinery/fleet duplication, or fiscal/finance features.

## Release Gate

P8 merges only when P8 unit/domain/E2E are green, P6/P7 isolated E2E remain green, P0 Linux regression/compatibility is green, P0 Windows `release:certify` is green with installer artifact, P1/P2 remain green, and no mandatory paid dependency is introduced.
