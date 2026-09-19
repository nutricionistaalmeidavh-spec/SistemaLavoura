# ArtiSys Lavoura — estado da migração standalone

## Fases 0–2

- Fase 0 — baseline/auditoria: implementada na branch `migration/standalone-phase-0-2`.
- Fase 1 — fronteira de core: implementada como snapshot pinado em `shared/`, com proveniência em `shared/core.lock.json`.
- Fase 2 — extração piloto do código de negócio/runtime local: implementada na branch de migração.

## Preservado

- product id `agro-lavoura`;
- migration SQL original;
- seed e branding originais;
- `product.persistence.json` original;
- manifesto e política R$0/self-hosted/open-source;
- telas e ações do presentation original;
- SQLite local real disponível pelo core pinado;
- persistência browser/local disponível pelo core pinado.

## Gates definidos

- `npm run check:imports`: impede imports que escapem do repositório;
- `npm test`: domínio + UI + smoke de persistência SQLite/reabertura;
- `npm run check`: imports + suíte completa desta etapa.

## Verificação

Os arquivos e a árvore Git foram conferidos pela integração GitHub. A suíte Node ainda precisa ser executada em um ambiente com checkout do repositório antes do merge; nenhum status PASS de runtime/build é declarado sem essa execução.

## Próximo gate de produto

A homologação comercial completa continua separada destas fases e deve incorporar frontend desktop, Electron, QA visual e instalador antes de retirar Lavoura do monorepo de origem.
