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
- `.github/workflows/p0-hardening.yml` prepara verificação Linux e certificação sintética Windows com upload das evidências e do instalador.

Verificação isolada dos módulos alterados foi executada com Node 22 e passou. O GitHub ainda não registrou workflow runs após os pushes/merge desta alteração; portanto o CI hospedado não deve ser considerado homologado até existir uma execução real registrada pelo Actions.

## Fases 5–6

Implementadas em código. A homologação continua dependente de execução fresca no ambiente Windows.

## Fase 7 — cutover não destrutivo

Implementada. `npm run phase7` trabalha exclusivamente sobre cópia sandbox do banco indicado por `ARTISYS_LEGACY_DB`, valida migration, escrita/reabertura, backup/restore, preservação lógica das tabelas existentes e SHA-256 inalterado do arquivo original. Banco com WAL ativo é rejeitado.

## Fase 8 — certificação fail-closed

Implementada. `npm run phase8:certify` exige evidências `passed` de Fase 5, Fase 7 e Playwright vinculadas ao mesmo commit, além de instalador `ArtiSys-Lavoura-Setup-*.exe` novo, maior que 1 MiB e com SHA-256 registrado.

### Certificação final no Windows

```powershell
$env:ARTISYS_LEGACY_DB="C:\caminho\artisys-safras-talhoes.sqlite"; npm run release:certify
```

Evidências esperadas:
- `qa-artifacts/phase5-summary.json`
- `qa-artifacts/phase7-summary.json`
- `qa-artifacts/playwright-summary.json`
- `qa-artifacts/release-certification.json`

**Estado:** P0 de código integrado e Fases 0–8 implementadas; homologação real ainda requer execução fresca do comando acima contra banco legado real. Até certificação `passed`, `main` não deve ser promovida e o monorepo continua rollback/reference.
