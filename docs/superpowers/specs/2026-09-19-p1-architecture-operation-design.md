# Sistema Lavoura — P1 Arquitetura e Operação

## Objetivo

Completar o P1 do Sistema Lavoura sem transformar o produto em outro sistema: adicionar EventBus, workflow engine, inventory operacional, settings persistentes, reporting, dashboard operacional, planning, alerts, importer, exporter, search e finance-domain como capacidades locais integradas ao produto existente.

## Escopo aprovado

P1 inclui exatamente:

- eventbus
- workflow-engine
- inventory
- settings
- reporting
- dashboard
- planning
- alerts
- importer
- exporter
- search
- finance-domain

P0 permanece como base imutável de segurança, RBAC, backup/restore, audit-log, Product QA, release/certificação e comandos/transações.

## Restrições globais

- Core obrigatório R$0, local-first/self-hosted e sem serviço cloud obrigatório.
- Nenhuma dependência paga pode entrar no caminho crítico.
- Desktop e PWA continuam suportados.
- Persistência continua no mesmo contrato de `vertical-persistence` já usado pelo produto.
- Comandos persistentes continuam atômicos no SQLite e com rollback na PWA.
- RBAC e audit-log do P0 continuam envolvendo toda mutação exposta ao usuário.
- As 10 telas existentes permanecem; P1 enriquece dados e ações sem adicionar navegação obrigatória.
- As 17 ações P0 continuam válidas; P1 pode adicionar novas ações, mas não remover ou mudar a semântica das existentes.
- Contratos reutilizáveis são baseados no repositório `nutricionistaalmeidavh-spec/utilidades` fixado no commit `4a138a9d77775f5be1e43244b9d45ca8586742c5`.
- O produto não depende do repositório `utilidades` em runtime; integrações são snapshots/adapters locais revisáveis.

## Arquitetura

### 1. EventBus durável

Adicionar `shared/packages/product-eventbus/src/index.js` com:

- `publish(type, payload, metadata)` para registrar um evento durável no persistence.
- `subscribe(type, handler)` para handlers locais.
- `flush(eventId?)` para entregar eventos pendentes e registrar `delivered`/`failed`.
- wildcard `*`.
- tentativa de entrega registrada no próprio evento.
- falha de subscriber não apaga o evento; permanece reprocessável.

O dispatcher de comandos passa a criar um evento `agro.<screen>.<action>.completed` depois da ação persistente e dentro da mesma transação do domínio. A entrega ocorre após commit. Para comandos não transacionais, o evento é registrado antes da entrega. O evento inclui `commandId`, `screenId`, `action`, input sanitizado e referência ao resultado.

### 2. Workflow engine

Adicionar snapshot do contrato determinístico de `artisys-workflow-engine` e adaptar operações agrícolas para uma definição única:

- `planned -> in-progress`
- `planned -> cancelled`
- `in-progress -> completed`
- `in-progress -> cancelled`

`start`, `complete` e `cancel` deixam de validar estado por condicionais duplicadas e passam pelo motor de transição. O shape externo da operação permanece compatível.

### 3. Inventory

Manter `product-inventory` existente como ledger autoritativo. P1 acrescenta:

- configuração de estoque mínimo.
- leitura de itens abaixo do mínimo.
- alerta local após recebimento/consumo quando saldo disponível fica abaixo do limite.
- informação de estoque crítico no dashboard.

Não haverá ERP de compras, fiscal ou fornecedor neste P1.

### 4. Settings

Criar `shared/packages/product-settings/src/index.js` sobre o persistence com namespace `settings:agro-lavoura`.

Defaults iniciais:

- `inventory.lowStockThreshold = 10`
- `planning.lookAheadDays = 30`
- `alerts.enabled = true`
- `reporting.csvDelimiter = ','`

API: `get`, `set`, `delete`, `merge`, `snapshot`.

A tela Settings ganha ações `set` e `merge`; continua admin-only pela política P0.

### 5. Reporting e exporter

Adicionar primitivas locais de reporting e exporter baseadas nos contratos ArtiSys:

- filtro.
- agrupamento.
- `sum`, `count`, `avg`.
- CSV com quoting correto.
- JSON.
- workbook-model sem dependência XLSX obrigatória.

A tela Reports mantém `csv` e `issue` e ganha `summary` e `export`.

### 6. Dashboard

Criar um serviço de dashboard que agrega:

- talhões e área total.
- safras.
- operações por estado.
- produtividade de colheita.
- receita, despesa e margem.
- alertas ativos/vencidos.
- estoque abaixo do mínimo.
- planejamento e conflitos.

O dashboard é projeção de leitura; não duplica fonte de verdade.

### 7. Planning

Usar `crop.plans` já existente como repositório autoritativo.

Cada plano contém tarefas com `id`, `title`, `start`, `end`, `progress`, `resourceId` e dependências. O serviço oferece:

- validação.
- progresso médio.
- conflitos de recurso.
- adapters de modelo para calendário/Gantt sem dependência UI obrigatória.

A tela Operations ganha `savePlan`; o load retorna `plans`, `planningProgress` e `planningConflicts`.

### 8. Alerts

Adicionar serviço persistente de alertas baseado no contrato `artisys-alerts`:

- create/upsert.
- acknowledge.
- snooze.
- dismiss.
- list active/due.

Handlers do EventBus criam alertas para:

- operação agendada.
- estoque abaixo do mínimo após movimento.

O dashboard ganha ações `acknowledgeAlert`, `snoozeAlert` e `dismissAlert`.

### 9. Importer

Adicionar preview e apply transacional para importação de cadastros suportados:

- `fields`
- `inputs`

`previewImport` mapeia colunas, valida obrigatórios e duplicidades. `applyImport` só aceita plano válido e aplica todas as linhas dentro da camada transacional do comando.

A tela Settings ganha `previewImport` e `applyImport`.

### 10. Search

Busca local accent-insensitive e prefix-aware sobre:

- fields
- seasons
- operations
- inputs
- harvest
- finance

O índice é reconstruído sob demanda a partir das fontes autoritativas; isso evita inconsistência de projeção persistente nesta fase. A tela Overview ganha ação `search`.

### 11. Finance-domain

Preservar `createFinancialEntry`, settlements e métricas atuais. Acrescentar:

- normalização textual.
- hash/fingerprint determinístico de lançamentos.
- fingerprint gravado em despesas/receitas agrícolas.

Não haverá conciliação bancária completa no P1; o contrato ficará preparado para evolução posterior sem alterar os lançamentos atuais.

## Segurança e permissões

- Ações de Settings continuam `settings:write`.
- Alert lifecycle no dashboard usa `crop:write`.
- Search e reporting de leitura usam permissões de leitura existentes.
- Import apply passa por `settings:write` e audit-log de comando.
- Nenhum evento pode contornar o comando/RBAC para uma mutação iniciada pelo usuário.

## QA e critérios de aceite

Criar `qa/p1-contract.json` e `tooling/qa-p1.mjs`.

P1 só é concluído quando:

1. As 17 ações P0 continuam passando.
2. Todas as novas ações P1 são funcionalmente exercitadas.
3. Workflow rejeita transições inválidas.
4. EventBus persiste eventos, entrega subscribers e mantém falhas reprocessáveis.
5. Alertas de operação/estoque funcionam.
6. Import inválido não grava; import válido é atômico.
7. Export CSV/JSON é determinístico.
8. Search ignora acentos e encontra prefixos.
9. Settings sobrevivem restart.
10. Dashboard calcula indicadores sobre dados reais do teste.
11. Linux regression/compatibility passa.
12. Windows synthetic release certification passa e gera instalador.

## Fora de escopo

- novos serviços cloud obrigatórios.
- fiscal/NF-e.
- pagamentos.
- sincronização remota multi-device.
- IoT.
- arquivos/capture/upload/PDF/checklists/catalog/feature-flags, que pertencem ao P2.
