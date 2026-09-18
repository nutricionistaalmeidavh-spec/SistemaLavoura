# Fases 7 e 8 — ArtiSys Lavoura

## Fase 7 — ensaio de cutover

O banco definido em `ARTISYS_LEGACY_DB` nunca é usado como diretório de dados do runtime. O gate calcula SHA-256 e snapshot lógico do original, rejeita WAL ativo, copia o arquivo para uma sandbox temporária com o nome `artisys-safras-talhoes.sqlite`, abre o host standalone, exige `agro-lavoura/001-initial.sql`, testa escrita e reabertura, restaura um backup anterior à escrita e compara as tabelas preexistentes. Por fim recalcula o hash do original e exige igualdade byte a byte.

Evidência: `qa-artifacts/phase7-summary.json`.

## Fase 8 — certificação fail-closed

O certificador apaga certificação antiga antes de começar e exige:

1. Fase 5 `passed` no commit atual.
2. Fase 7 `passed` no commit atual.
3. Playwright `passed` no commit atual.
4. Instalador `ArtiSys-Lavoura-Setup-*.exe` maior que 1 MiB.
5. Instalador mais novo que as evidências da rodada atual.
6. SHA-256 do instalador registrado.

Evidência final: `qa-artifacts/release-certification.json`.

## Execução final no Windows

```powershell
npm install --no-audit --no-fund
npx playwright install chromium
$env:ARTISYS_LEGACY_DB="C:\caminho\artisys-safras-talhoes.sqlite"
npm run release:certify
```

O código do monorepo não deve ser removido até a certificação final registrar `status: passed`.
