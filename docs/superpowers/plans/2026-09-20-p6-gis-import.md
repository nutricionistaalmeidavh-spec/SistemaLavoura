# P6 GIS Import Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar importação GIS local para GeoJSON, KML, KMZ, GPX, Shapefile e ISOXML/TaskData, com persistência de camada e aplicação opcional como limite de talhão.

**Architecture:** Arquivos são parseados no cliente e normalizados para GeoJSON. O domínio valida/persiste em `crop.gis-layers`; geometrias poligonais podem ser aplicadas a `crop.field-geometries`. A apresentação P6 adiciona uma tela aditiva sem alterar o contrato das 10 telas agrícolas-base.

**Tech Stack:** Node 22, React 19, Vite, SQLite/browser persistence, @tmcw/togeojson, @xmldom/xmldom, fflate, shpjs, isoxml.

**Spec:** `docs/superpowers/specs/2026-09-20-p6-gis-import-design.md`

## Global Constraints

- Operação local-first/self-hosted.
- Nenhum serviço pago obrigatório.
- Nenhum upload externo de arquivos GIS.
- Preservar P0–P5 e as 37 ações agrícolas-base.
- Não seguir KML NetworkLinks automaticamente.

## Review Focus

- arquivo ZIP que não é KMZ, Shapefile ou TaskData deve falhar com mensagem clara;
- coordenadas fora de WGS84 devem falhar antes da persistência;
- `MultiPolygon` deve permanecer válido e visível no mapa;
- arquivo com múltiplas feições não pode aplicar silenciosamente a feição errada ao talhão;
- remover camada GIS não pode apagar a geometria do talhão já aplicada.

---

### Task 1: Parser e normalização GIS

**Files:**
- Create: `src/gis-import.js`
- Create: `web/ui/gis-file-parser.js`
- Test: `tests/p6-gis-import.test.js`
- Modify: `package.json`

**Interfaces:**
- Produces: `normalizeGisFeatureCollection(input)`, `createGisLayer(input)`, `geometryForField(feature)`, `parseGisFile({name,type,bytes,text})`.

- [ ] Escrever testes RED para GeoJSON, KML, GPX, KMZ, Shapefile, ISOXML e entradas inválidas.
- [ ] Adicionar dependências locais.
- [ ] Implementar parsers e normalização WGS84.
- [ ] Rodar `node --test tests/p6-gis-import.test.js` até PASS.

### Task 2: Persistência e apresentação P6

**Files:**
- Create: `src/presentation-p6.js`
- Modify: `runtime/host.mjs`
- Test: `tests/p6-gis-presentation.test.js`

**Interfaces:**
- Produces screen `gis-import` com `saveLayer`, `removeLayer`, `applyFieldGeometry`.

- [ ] Escrever testes RED de persistência, remoção e aplicação de limite.
- [ ] Implementar coleção `crop.gis-layers` e ações.
- [ ] Garantir que remoção da camada não remova `crop.field-geometries`.
- [ ] Rodar testes P6.

### Task 3: UI Importação GIS

**Files:**
- Create: `web/ui/gis-import.jsx`
- Create: `web/ui/gis-import.css`
- Modify: `web/ui/runtime.jsx`
- Modify: `web/ui/icons.jsx`
- Test: `tests/e2e/p6-gis-import.spec.mjs`

**Interfaces:**
- Consumes `gis-import` screen e parser cliente.

- [ ] Escrever E2E RED para abrir tela, analisar arquivo e salvar camada.
- [ ] Implementar upload, preview, lista de feições e aplicação a talhão.
- [ ] Exibir erros/avisos sem JSON técnico.
- [ ] Rodar Playwright P6.

### Task 4: MultiPolygon e camadas importadas no mapa

**Files:**
- Modify: `src/agricultural-map.js`
- Modify: `src/presentation-p6.js`
- Modify: `web/ui/agricultural-map.jsx`
- Modify: `web/ui/agricultural-map.css`
- Test: `tests/p6-gis-import.test.js`

**Interfaces:**
- `buildAgriculturalMapSnapshot` recebe `gisLayers` e mantém compatibilidade com geometrias antigas.

- [ ] Escrever teste RED de MultiPolygon e camada genérica.
- [ ] Renderizar partes poligonais, linhas e pontos GIS.
- [ ] Rodar regressão de P3/P4/P5.

### Task 5: Documentação e gate P6

**Files:**
- Create: `docs/PHASE_P6_GIS_IMPORT.md`
- Create: `.github/workflows/p6-gis-import.yml`
- Modify: `PRODUCT_STATUS.md`

- [ ] Documentar formatos, limites e operação offline.
- [ ] Criar workflow Node 22 com testes, build e Playwright P6.
- [ ] Rodar suíte completa e confirmar P0–P6 verdes.
