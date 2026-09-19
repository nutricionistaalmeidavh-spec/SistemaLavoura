# Functionality matrix — ArtiSys Lavoura

Inventário da superfície funcional publicada pelo `presentation.js`.

| Tela | Funcionalidades expostas |
|---|---|
| Visão Geral (`overview`) | dashboard; `search`; alertas (`acknowledgeAlert`, `snoozeAlert`, `dismissAlert`); `capture` |
| Talhões (`fields`) | `save`, `remove`, `uploadFile`, `removeFile` |
| Safras (`seasons`) | `save` |
| Operações (`operations`) | `schedule`, `start`, `complete`, `cancel`, `savePlan`, `createChecklist`, `setChecklistItem`, `completeChecklist` |
| Insumos (`inputs`) | `save` |
| Colheita (`harvest`) | `create` |
| Estoque (`inventory`) | `receive`, `consume` |
| Custos e Financeiro (`finance`) | `addExpense`, `addIncome` |
| Relatórios (`reports`) | `csv`, `issue`, `summary`, `export`, `pdf` |
| Configurações (`settings`) | `backup`, `restore`, `set`, `merge`, `previewImport`, `applyImport`, `upsertCatalog`, `setFeatureFlag` |

## Contratos automatizados

- P0: **17 ações** — `tooling/qa-phase5.mjs`.
- P1: **11 ações adicionais / 12 módulos** — `tooling/qa-p1.mjs`.
- P2: **9 ações adicionais / 7 módulos** — `tooling/qa-p2.mjs`.
- Total funcional contratado e auditado: **37 ações** em **10 telas**.

A camada visual permanece verificada separadamente pelos testes Playwright. Os Product QAs exercitam o mesmo backend/RPC do produto e exigem audit-log de sucesso para cada ação contratada.
