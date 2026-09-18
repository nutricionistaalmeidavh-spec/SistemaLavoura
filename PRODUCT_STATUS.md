# ArtiSys Lavoura — Status do Produto

## Contrato atual

- Produto: `agro-lavoura`
- Banco: `artisys-safras-talhoes.sqlite`
- Migration obrigatória: `agro-lavoura/001-initial.sql`
- Telas contratadas: **10**
- Ações contratadas: **17**
- Dependência obrigatória paga: **nenhuma**
- Operação: local-first / self-hosted

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

**Estado:** Fases 0–8 implementadas; homologação real ainda requer execução fresca do comando acima. Até certificação `passed`, `main` não deve ser promovida e o monorepo continua rollback/reference.
