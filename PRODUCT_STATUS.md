# ArtiSys Lavoura — Status do Produto

## Contrato atual

- Produto: `agro-lavoura`
- Banco: `artisys-safras-talhoes.sqlite`
- Migration obrigatória: `agro-lavoura/001-initial.sql`
- Telas contratadas: **10**
- Ações contratadas: **17**
- Dependência obrigatória paga: **nenhuma**
- Operação: local-first / self-hosted

## P0 hardening

Integrado na branch `migration/standalone-phase-0-8`.

- `settings` deixou de aceitar acesso genérico de qualquer sessão autenticada.
- `backup` e `restore` usam permissões explícitas e ficam restritos ao `admin` pela política atual.
- writes de `fields`, `seasons`, `inputs` e `operationTypes` passam pelos validadores de domínio antes da persistência.
- regressões específicas vivem em `tests/p0-hardening.test.js`.
- o checker standalone valida imports/requires reais sem confundir metadados de UX com dependência externa.
- `build:win` usa `--publish never`, impedindo publicação implícita e exigência de `GH_TOKEN` em CI.
- `.github/workflows/p0-hardening.yml` executa verificação Linux e certificação sintética Windows, publicando evidências e instalador como artefatos do GitHub Actions.

### Evidência automatizada

O GitHub Actions `P0 hardening` foi executado com sucesso no commit `945f4162d74a9b6ae2eb7df9b63690e561e413a4`:

- Linux: `phase5` passou, contrato de compatibilidade passou e evidências foram publicadas.
- Windows: banco legado sintético foi criado, `release:certify` passou e o instalador Windows foi publicado como artefato.
- suíte Node no Windows: **20 testes aprovados, 0 falhas**.
- Playwright: **2 testes aprovados** nas execuções de certificação.

Essa certificação automatizada usa banco legado sintético e não substitui a homologação final contra uma cópia real do banco legado de produção.

## Fases 5–6

Implementadas e verificadas no CI sintético. A homologação comercial final continua dependente de execução contra banco legado real no Windows.

## Fase 7 — cutover não destrutivo

Implementada. `npm run phase7` trabalha exclusivamente sobre cópia sandbox do banco indicado por `ARTISYS_LEGACY_DB`, valida migration, escrita/reabertura, backup/restore, preservação lógica das tabelas existentes e SHA-256 inalterado do arquivo original. Banco com WAL ativo é rejeitado.

## Fase 8 — certificação fail-closed

Implementada. `npm run phase8:certify` exige evidências `passed` de Fase 5, Fase 7 e Playwright vinculadas ao mesmo commit, além de instalador `ArtiSys-Lavoura-Setup-*.exe` novo, maior que 1 MiB e com SHA-256 registrado.

### Homologação final com banco real no Windows

```powershell
$env:ARTISYS_LEGACY_DB="C:\caminho\artisys-safras-talhoes.sqlite"; npm run release:certify
```

Evidências esperadas:
- `qa-artifacts/phase5-summary.json`
- `qa-artifacts/phase7-summary.json`
- `qa-artifacts/playwright-summary.json`
- `qa-artifacts/release-certification.json`

**Estado:** P0 de código concluído e certificação sintética Linux/Windows aprovada. A promoção para `main` permanece bloqueada somente pela homologação contra banco legado real; o monorepo continua rollback/reference até essa evidência existir.
