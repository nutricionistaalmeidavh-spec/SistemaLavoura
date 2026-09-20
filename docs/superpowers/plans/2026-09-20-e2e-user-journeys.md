# E2E User Journeys Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Certify the highlighted user journeys through the real browser UI and preserve screenshots for each relevant step in CI.

**Architecture:** Keep the existing product/UI untouched unless an E2E exposes a real defect. Add a separate E2E surface contract (without changing the 10-screen agricultural core contract), reusable screenshot helpers, journey specs for agricultural chain/Admin/Inventory/Purchases, and CI evidence paths under `qa-artifacts/`.

**Tech Stack:** Playwright 1.55, React/Vite preview, Node 22, GitHub Actions.

**Spec:** User-highlighted requirements in the 2026-09-20 conversation: every published user screen/action discoverable, chained agricultural journey, administration/RBAC, inventory lifecycle, and purchasing lifecycle.

## Global Constraints

- Do not change `qa/product-contract.json`; it is the stable agricultural core compatibility contract.
- Evidence must live under `qa-artifacts/` so existing CI artifact uploads preserve it.
- Every journey must use visible UI controls rather than direct backend calls.
- Every meaningful journey step must save a named full-page screenshot.
- Physical IoT commands remain outside the user journey suite.
- Tests must remain local/offline and require no paid service.

## Review Focus

- Contextual actions that only appear after selecting a row must actually be exercised.
- RBAC must be proven by logging in as the created non-admin user, not only by inspecting metadata.
- Purchase receipt must be observed in inventory after the finance flow.
- Inventory transfer/count/consume must use the same user-created input and visible quantities.
- Screenshots from successful runs must be uploaded by current Linux/Windows QA workflows.

---

### Task 1: Coverage contract and evidence plumbing

**Files:**
- Create: `qa/e2e-surface-contract.json`
- Create: `tests/e2e/evidence-helpers.mjs`
- Modify: `tests/e2e/full-surface.spec.mjs`
- Modify: `playwright.config.mjs`
- Test: `tests/e2e-journey-coverage.test.js`

- [ ] Write failing coverage tests for the separate E2E contract, all UI-contract actions, admin/IoT surfaces, and `qa-artifacts` Playwright output.
- [ ] Run `npm test` and verify the new test fails for missing coverage/evidence plumbing.
- [ ] Add the E2E surface contract and screenshot helper.
- [ ] Point Playwright `outputDir` to `qa-artifacts/playwright-results` and full-surface to the E2E contract.
- [ ] Run `npm test` and the full-surface Playwright spec.

### Task 2: Chained agricultural journey

**Files:**
- Create: `tests/e2e/agricultural-journey.spec.mjs`

- [ ] Create through UI: field → season → input → stock receipt → scheduled operation → start → application → complete → harvest → sale → finance → report.
- [ ] Capture a named screenshot after each stage.
- [ ] Assert each created business object appears in its downstream UI.
- [ ] Run the isolated spec and fix only defects exposed by the real browser flow.

### Task 3: Administration/RBAC journey

**Files:**
- Create: `tests/e2e/admin-journey.spec.mjs`

- [ ] Create a user through Administration.
- [ ] Change roles through the UI.
- [ ] Log out and authenticate as that user to verify allowed/hidden navigation.
- [ ] Return as admin and deactivate the user.
- [ ] Capture screenshots for create, roles, restricted session, audit, and disabled state.

### Task 4: Inventory lifecycle journey

**Files:**
- Create: `tests/e2e/inventory-journey.spec.mjs`

- [ ] Create an input and receive stock.
- [ ] Consume stock.
- [ ] Perform physical count.
- [ ] Transfer stock between warehouses.
- [ ] Set/observe low-stock state where the product exposes it.
- [ ] Capture screenshots after every mutation.

### Task 5: Purchasing lifecycle journey

**Files:**
- Create: `tests/e2e/purchase-journey.spec.mjs`

- [ ] Create supplier.
- [ ] Create purchase order with a human input selector/name.
- [ ] Receive the purchase order.
- [ ] Navigate to Inventory and assert the stock effect.
- [ ] Capture screenshots for supplier, order, receipt, and inventory result.

### Task 6: Final verification and merge

- [ ] Run `npm test`.
- [ ] Run `npm run qa:web:raw`.
- [ ] Run P0/P1/P2 CI on Linux and Windows for the exact final HEAD.
- [ ] Verify QA artifacts include Playwright HTML and successful-run screenshots.
- [ ] Merge only after all required checks are green.