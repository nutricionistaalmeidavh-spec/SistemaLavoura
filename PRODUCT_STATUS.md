# ArtiSys Lavoura — Status do Produto

## Contrato atual

- Produto: `agro-lavoura`
- Banco: `artisys-safras-talhoes.sqlite`
- Migration obrigatória: `agro-lavoura/001-initial.sql`
- Telas contratadas: **10**
- Ações funcionais contratadas: **37** (**17 P0 + 11 P1 + 9 P2**)
- Dependência obrigatória paga: **nenhuma**
- Operação: **local-first / self-hosted**
- Targets: desktop Electron + PWA/web

## P0 — integridade

Concluído. Cobre autenticação/RBAC, backup/restore, audit-log, validação de domínio, comando central, transação atômica/rollback, QA funcional das 17 ações originais, compatibilidade, build Windows e certificação fail-closed.

- Cada comando registra `attempt`, `success` ou `failure`.
- Desktop usa uma transação SQLite por comando; PWA usa snapshot/rollback serializado.
- Restore preserva auditoria posterior ao backup.
- `tooling/qa-phase5.mjs` executa **17/17 ações P0**.

## P1 — arquitetura e operação

Concluído. Adiciona **12 módulos** e **11 ações funcionais**:

- EventBus durável com retry;
- workflow engine agrícola;
- inventory e alerta de estoque baixo;
- settings persistentes;
- reporting e dashboard;
- planning com progresso/conflitos;
- alerts com acknowledge/snooze/dismiss;
- importer/exporter;
- search local accent-insensitive;
- finance-domain determinístico.

`tooling/qa-p1.mjs` exige **12/12 módulos** e **11/11 ações P1**, preservando o contrato P0.

## P2 — produto agrícola

Implementado sobre a mesma arquitetura local-first, sem serviço externo obrigatório.

### Capture

- captura ligada a entidade agrícola (`field`, operação etc.);
- origem `camera`, `file` ou `manual`;
- conteúdo persistido localmente por meio do serviço de arquivos;
- controlado por feature flag.

### Files / upload

- anexos locais relacionados a entidade;
- validação de nome contra traversal (`../`, barras e NUL);
- base64 validado;
- arquivo vazio rejeitado;
- limite padrão de 10 MiB;
- SHA-256 e tamanho persistidos;
- download/listagem/remoção local.

### PDF

- ação `reports.pdf` integrada à camada existente `product-documents` / `artisys-pdf`;
- geração local, sem API paga;
- saída `application/pdf` em bytes.

### Checklists

- checklist ligado a operação;
- itens obrigatórios/opcionais;
- atualização item a item;
- conclusão bloqueada se item obrigatório estiver pendente;
- flag opcional `checklists.enforceBeforeOperationComplete` pode exigir checklist concluído antes de concluir a operação (desligada por padrão para preservar compatibilidade).

### Catálogo agrícola

- catálogo persistente para `crop`, `input`, `operation-type`, `unit` e `category`;
- busca local e filtro por tipo/ativo;
- edição administrativa pela tela de configurações.

### Feature flags

Flags persistentes locais, com defaults seguros:

- `capture.enabled`
- `files.enabled`
- `pdf.enabled`
- `checklists.enabled`
- `catalog.enabled`
- `checklists.enforceBeforeOperationComplete`

Feature flags não substituem RBAC: todas as ações continuam passando pela camada de segurança e pelo dispatcher de comandos.

### Product QA P2

`tooling/qa-p2.mjs` executa funcionalmente as **9/9 ações P2** e verifica os **7/7 módulos**, incluindo auditoria de sucesso. O contrato agregado é **37 ações**.

Ações P2:

- `overview.capture`
- `fields.uploadFile`
- `fields.removeFile`
- `reports.pdf`
- `operations.createChecklist`
- `operations.setChecklistItem`
- `operations.completeChecklist`
- `settings.upsertCatalog`
- `settings.setFeatureFlag`

Testes negativos também cobrem upload inseguro, captura desabilitada, checklist obrigatório incompleto e catálogo inválido.

## CI e release

- workflows P0/P1/P2 usam `actions/checkout@v7` e `actions/setup-node@v7`;
- Node de produto permanece 22;
- `build:win` mantém `--publish never`;
- P2 certifica Linux e Windows e publica evidências QA + instalador;
- base legada de CI é sintética e não destrutiva;
- não existe `package-lock.json` no baseline atual, portanto CI continua em `npm install`; migrar para `npm ci` depende primeiro de gerar e versionar um lockfile real validado.

## Banco legado real

Quando existir uma base legada real a preservar, a homologação adicional permanece disponível:

```powershell
$env:ARTISYS_LEGACY_DB="C:\caminho\artisys-safras-talhoes.sqlite"; npm run release:certify
```

Essa homologação é uma etapa de migração/cutover para instalações com dados antigos; não é dependência para uma instalação nova.

## Critério de fechamento

P0/P1/P2 só são considerados certificados quando os workflows correspondentes estiverem verdes no mesmo HEAD/PR, com Linux aprovado, Windows aprovado, QA funcional completo e instalador Windows gerado.
