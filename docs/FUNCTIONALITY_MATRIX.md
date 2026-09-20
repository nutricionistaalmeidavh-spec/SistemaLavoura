# Functionality matrix — ArtiSys Lavoura

Inventário da superfície funcional publicada pelo produto.

## Núcleo agrícola (`presentation.js`)

| Tela | Funcionalidades expostas |
|---|---|
| Visão Geral (`overview`) | dashboard; `search`; alertas (`acknowledgeAlert`, `snoozeAlert`, `dismissAlert`); `capture` |
| Talhões (`fields`) | `save`, `remove`, `uploadFile`, `removeFile`, `saveGeometry`, `addScouting`; download de anexos na UI |
| Safras (`seasons`) | `save` |
| Operações (`operations`) | `schedule`, `start`, `complete`, `cancel`, `savePlan`, `createChecklist`, `setChecklistItem`, `completeChecklist` e fluxos agrícolas/comerciais adicionais publicados pelo contrato atual |
| Insumos (`inputs`) | `save` |
| Colheita (`harvest`) | `create` e fluxo de colheita/armazenagem atual |
| Estoque (`inventory`) | `receive`, `consume` e controles de estoque 2.0 atuais |
| Custos e Financeiro (`finance`) | `addExpense`, `addIncome`, fornecedores, compras, recebimento, vendas e entregas com seletores humanos |
| Relatórios (`reports`) | `csv`, `issue`, `summary`, `export`, `pdf`; downloads CSV/PDF/exportação pela UI |
| Configurações (`settings`) | `backup`, `restore`, `set`, `merge`, `previewImport`, `applyImport`, `upsertCatalog`, `setFeatureFlag`; IDs técnicos de catálogo gerados internamente |

## Superfícies virtuais do RPC

| Superfície | Permissão | Funcionalidades expostas |
|---|---|---|
| Administração (`admin`) | leitura `users:read`; escrita `users:write` | criar usuário, alterar papéis, ativar/desativar usuário, alterar própria senha; consulta de auditoria conforme `audit:read` |
| Sensores e IoT (`iot`) | leitura `iot:read`; configuração `iot:configure` | consultar dispositivos/telemetria/integrações/alertas; `saveDevice`, `bindField`, `saveAdapterConfig`, `setAdapterEnabled`, `saveRule`, `removeRule` |

A superfície IoT é opcional. Regras de limiar, offline e bateria usam estado persistente local e alimentam o mesmo serviço de alertas do produto. A configuração não devolve segredos na leitura e não publica controles físicos na UI.

## Contratos automatizados

- P0: **17 ações** — `tooling/qa-phase5.mjs`.
- P1: **11 ações adicionais / 12 módulos** — `tooling/qa-p1.mjs`.
- P2: **9 ações adicionais / 7 módulos** — `tooling/qa-p2.mjs`.
- Contrato agrícola original auditado: **37 ações** em **10 telas**.
- Administração e IoT são superfícies virtuais adicionais e possuem testes próprios de RPC/RBAC/UI sem alterar a contagem histórica P0/P1/P2.

A camada visual permanece verificada separadamente pelos testes Playwright e testes estruturais de paridade. Os Product QAs exercitam o mesmo backend/RPC do produto. Ações agrícolas usam o dispatcher auditado; mutações IoT usam `security.execute`, registrando `attempt`, `success` ou `failure` sem gravar credenciais na auditoria.
