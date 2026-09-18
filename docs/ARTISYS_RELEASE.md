# ArtiSys Release — Lavoura

Este repositório usa o motor compartilhado `artisys-release` e o reporter `artisys-ci-reporter` do repositório `utilidades`. O motor não é copiado para o produto.

## Pin reprodutível

`.artisys/utilidades.lock` fixa `a444031860d5b8c91adc5628759bc67c0c29d557`. O wrapper cria um worktree detached temporário nesse SHA; não existe fallback silencioso para `main`.

## Host Windows / Woodpecker

Configure no host do agente:

```powershell
$env:ARTISYS_UTILIDADES_PATH="C:\Victor\Artisys\utilidades"
$env:GITHUB_REPORT_TOKEN="<segredo no host>"
```

O workflow `.woodpecker/artisys-release.yaml` aceita `push` e `manual`, exige `windows/amd64` + backend `local` e chama somente `scripts/artisys-release.ps1`.

A ativação deste repositório na interface do Woodpecker/webhook GitHub é uma etapa operacional externa. Não habilite PR/fork não confiável no agente local.

## Ordem

`deps → test → build → installer → qa → evidence`

O instalador é gerado antes do QA. `qa` executa a Fase 5; o evidence step exige F5 + Playwright do mesmo commit e um instalador >1 MiB.

## Fases 7 e 8

Fase 7 continua manual porque exige `ARTISYS_LEGACY_DB` apontando para banco legado real. Ela nunca é simulada no CI comum.

Após uma execução real bem-sucedida do release e da F7:

```powershell
npm run phase8:certify
```

A F8 exige F5, F7, Playwright e `qa-artifacts/release-run.json` do mesmo commit, mesmo SHA pinado do `utilidades` e mesmo hash do instalador.

## Dry-run

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\artisys-release.ps1 -DryRun
```

O dry-run não gera evidência válida de certificação.
