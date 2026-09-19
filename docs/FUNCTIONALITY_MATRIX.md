# Functionality matrix — ArtiSys Lavoura

Inventário da superfície publicada pelo `presentation.js` no baseline standalone.

| Tela | Funcionalidades expostas |
|---|---|
| Visão Geral (`overview`) | Dashboard de talhões, safras, operações concluídas, colheita e resultado financeiro |
| Talhões (`fields`) | `save`, `remove` |
| Safras (`seasons`) | `save` |
| Operações (`operations`) | `schedule`, `start`, `complete`, `cancel` |
| Insumos (`inputs`) | `save` |
| Colheita (`harvest`) | `create` |
| Estoque (`inventory`) | `receive`, `consume` |
| Custos e Financeiro (`finance`) | `addExpense`, `addIncome` |
| Relatórios (`reports`) | `csv`, `issue` |
| Configurações (`settings`) | `backup`, `restore` |

Total no contrato atual: **10 telas** e **17 ações de usuário**.

O `tooling/qa-phase5.mjs` executa funcionalmente as **17/17 ações** através do backend/RPC, exige auditoria de sucesso para cada ação e publica cobertura em `qa-artifacts/phase5-summary.json`. A camada visual é verificada separadamente pelos testes Playwright.
