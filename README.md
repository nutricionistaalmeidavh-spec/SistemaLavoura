# ArtiSys Lavoura

Repositório standalone do produto ArtiSys Lavoura.

Migração controlada a partir de `nutricionistaalmeidavh-spec/SistemasNichadosAgroFrota`, baseline `a95bd0176ad4053276c5588d3170d18fe5c24c8e`.

## Branch de migração

`migration/standalone-phase-0-2`

Nesta branch estão o código de negócio da Lavoura, migrations, seeds, branding, persistência SQLite/browser, testes independentes e um snapshot pinado do core compartilhado necessário para que o produto não importe código por caminho do monorepo.

## Verificação local

```powershell
npm run check
```

O comando valida imports standalone e executa os testes de domínio, UI e persistência SQLite/reabertura.

## Estado

Consulte `docs/PRODUCT_STATUS.md`. O app continua preservado no monorepo até a homologação comercial completa do repositório standalone.
