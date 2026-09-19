# ArtiSys Lavoura — Status do Produto

## Contrato atual

- Produto: `agro-lavoura`
- Banco: `artisys-safras-talhoes.sqlite`
- Migration obrigatória: `agro-lavoura/001-initial.sql`
- Telas contratadas: **10**
- Ações contratadas: **17**
- Dependência obrigatória paga: **nenhuma**
- Operação: local-first / self-hosted

## P0 — integridade

O P0 cobre autenticação/RBAC, backup e recuperação, auditoria, QA, segurança, certificação de release e a fronteira transacional de comandos.

### Segurança e RBAC

- `settings`, `backup` e `restore` usam permissões explícitas; pela política atual ficam restritos ao `admin`.
- writes de `fields`, `seasons`, `inputs` e `operationTypes` passam pelos validadores de domínio antes da persistência.
- regressões de autorização e validação são executadas pela suíte automatizada.

### Comandos, transações e auditoria

- todas as ações de negócio expostas pelo backend passam por `runtime/commands.mjs`.
- cada comando registra auditoria de `attempt`, `success` ou `failure`, com `commandId` e contexto da ação.
- comandos persistentes no desktop executam em uma única transação SQLite, com rollback integral em falha e suporte seguro a operações de persistência aninhadas.
- a persistência da PWA usa snapshot/rollback local e serialização de comandos; falhas ao criar o snapshot não bloqueiam a fila seguinte.
- `reports.csv`, `settings.backup` e `settings.restore` ficam fora da transação de negócio por serem, respectivamente, leitura ou operações de recuperação que quiescem/substituem o banco.
- restore preserva registros de auditoria criados depois do backup escolhido, tanto no SQLite quanto no armazenamento local do navegador.

### Product QA

A Fase 5 não valida apenas a existência da superfície. Ela executa funcionalmente as **17/17 ações contratadas** pelo mesmo backend usado pelo produto:

- talhões: `save`, `remove`
- safras: `save`
- operações: `schedule`, `start`, `complete`, `cancel`
- insumos: `save`
- colheita: `create`
- estoque: `receive`, `consume`
- financeiro: `addExpense`, `addIncome`
- relatórios: `csv`, `issue`
- configurações: `backup`, `restore`

A evidência `qa-artifacts/phase5-summary.json` registra ações declaradas, exercitadas, aprovadas, falhas e não testadas. A Fase 5 falha se qualquer ação contratada ficar sem execução ou sem auditoria de sucesso.

### Release e certificação

- `build:win` usa `--publish never`, impedindo publicação implícita e dependência de `GH_TOKEN`.
- `npm run phase8:certify` é fail-closed: exige evidências `passed` de Fase 5, Fase 7 e Playwright vinculadas ao mesmo commit e um instalador Windows novo, maior que 1 MiB, com SHA-256 registrado.
- `.github/workflows/p0-hardening.yml` executa regressão/compatibilidade no Linux e certificação sintética de release no Windows, publicando evidências e instalador como artefatos.

## Verificação P0

A suíte automatizada cobre, entre outros pontos:

- rollback atômico de comando no SQLite;
- rollback de comando na persistência da PWA;
- liberação da fila transacional após falha de snapshot;
- auditoria de tentativa/sucesso/falha;
- continuidade do audit-log após restore;
- RBAC e invariantes de domínio;
- **17/17 ações funcionais** no Product QA;
- navegação e UI via Playwright;
- compatibilidade de persistência e migrations;
- release Windows e certificação fail-closed.

## Fases 5–8

- Fase 5: QA funcional completo da superfície contratada.
- Fase 6: contrato e banco standalone validados.
- Fase 7: cutover não destrutivo sobre cópia sandbox do banco indicado por `ARTISYS_LEGACY_DB`; o original permanece byte a byte inalterado e banco com WAL ativo é rejeitado.
- Fase 8: certificação fail-closed do instalador e das evidências vinculadas ao commit.

### Banco legado real

Quando existir uma base legada real a preservar, a homologação adicional no Windows continua disponível:

```powershell
$env:ARTISYS_LEGACY_DB="C:\caminho\artisys-safras-talhoes.sqlite"; npm run release:certify
```

Essa homologação é uma etapa de migração/cutover para instalações com dados antigos; não é dependência do P0 de código para uma instalação nova sem banco legado real.

**Estado:** P0 de integridade concluído quando o workflow `P0 hardening` estiver verde no commit corrente, com Linux e Windows aprovados.
