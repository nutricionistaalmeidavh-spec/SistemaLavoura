# P7 Satellite Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar descoberta Sentinel-2/Landsat, cache local, NDVI e alternância Vetorial/Imagem/NDVI sem dependência paga obrigatória.

**Architecture:** `src/satellite.js` encapsula STAC/NDVI e normaliza provedores oficiais. A apresentação P7 persiste somente cenas/preview/grade NDVI explicitamente cacheados em `crop.satellite-cache`; GeoTIFF é processado no cliente em resolução reduzida. A tela Satélite usa o mapa agrícola já existente como referência espacial.

**Tech Stack:** Node 22, React 19, Vite, STAC HTTP, geotiff 3.x, SQLite/browser persistence.

**Spec:** `docs/superpowers/specs/2026-09-20-p7-satellite-design.md`

## Global Constraints

- Nenhuma conta externa obrigatória.
- Nenhuma chave compartilhada ArtiSys.
- Nenhum servidor ArtiSys.
- Não persistir credenciais de Copernicus/USGS.
- Catálogo online é opcional; cache permanece utilizável offline.
- Preservar P0–P6.

## Review Focus

- provider indisponível deve falhar sem comprometer dados locais;
- cena sem thumbnail/bandas deve continuar pesquisável e informativa;
- preview acima do limite deve ser recusado antes de persistir;
- NDVI deve tratar denominador zero/NaN e limitar valores a [-1,1];
- modo offline deve listar e visualizar cache sem executar busca remota.

---

### Task 1: Domínio STAC e NDVI

**Files:**
- Create: `src/satellite.js`
- Test: `tests/p7-satellite.test.js`

**Interfaces:**
- Produces: `SATELLITE_PROVIDERS`, `buildStacSearchRequest`, `searchSatelliteScenes`, `normalizeStacScene`, `calculateNdviGrid`, `summarizeNdvi`.

- [ ] Escrever testes RED com fetch mockado para Copernicus e USGS.
- [ ] Implementar consultas STAC e normalização de assets.
- [ ] Implementar NDVI puro e estatísticas.
- [ ] Rodar testes P7 domínio.

### Task 2: Cache local e apresentação P7

**Files:**
- Create: `src/presentation-p7.js`
- Modify: `runtime/host.mjs`
- Test: `tests/p7-satellite-presentation.test.js`

**Interfaces:**
- Produces screen `satellite` com `searchScenes`, `cacheScene`, `saveNdvi`, `removeCachedScene`.

- [ ] Escrever testes RED para busca, cache, limite de preview e remoção.
- [ ] Implementar `crop.satellite-cache`.
- [ ] Carregar talhões/mapa agrícola e cache na mesma tela.
- [ ] Confirmar que nenhuma credencial entra na persistência.

### Task 3: Leitura GeoTIFF e UI Satélite

**Files:**
- Create: `web/ui/satellite.jsx`
- Create: `web/ui/satellite.css`
- Create: `web/ui/satellite-raster.js`
- Modify: `web/ui/runtime.jsx`
- Modify: `web/ui/icons.jsx`
- Modify: `package.json`
- Test: `tests/e2e/p7-satellite.spec.mjs`

**Interfaces:**
- `satellite-raster.js` produz grade NDVI reduzida a partir de dois GeoTIFFs locais ou URLs COG acessíveis.

- [ ] Adicionar `geotiff`.
- [ ] Escrever testes unitários RED para reamostragem/NDVI onde aplicável.
- [ ] Implementar busca, cache, seleção de arquivos e feedback de disponibilidade.
- [ ] Implementar modos Vetorial/Imagem/NDVI.
- [ ] Rodar E2E P7 com dados locais/mockados.

### Task 4: Documentação e gate P7

**Files:**
- Create: `docs/PHASE_P7_SATELLITE.md`
- Create: `.github/workflows/p7-satellite.yml`
- Modify: `PRODUCT_STATUS.md`

- [ ] Documentar endpoints oficiais, limites de autenticação e custo R$0 obrigatório.
- [ ] Criar workflow Node 22 com suíte completa, build e Playwright P7.
- [ ] Rodar todos os gates P0–P7 no mesmo HEAD.
- [ ] Abrir PR, revisar diff e mergear somente com CI verde.
