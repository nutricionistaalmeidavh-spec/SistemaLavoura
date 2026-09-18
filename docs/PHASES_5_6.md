# Migração standalone — Fases 5 e 6

## Fase 5 — Homologação de robustez independente

O produto passa a possuir um contrato explícito de superfície em `qa/product-contract.json`. O gate `npm run phase5` exige:

- fronteira standalone sem imports do monorepo;
- testes Node existentes;
- build web;
- bootstrap/login e sessão local;
- carregamento de 100% das telas contratadas;
- correspondência exata entre ações publicadas e handlers;
- contrato RBAC com `admin` e `viewer`;
- backup, alteração e restauração de dados;
- fechamento/reabertura do SQLite preservando autenticação e dados;
- Playwright percorrendo todas as rotas de navegação e guardando evidências.

O resumo programático é salvo em `qa-artifacts/phase5-summary.json`.

## Fase 6 — Compatibilidade e cutover técnico

O gate `npm run compat:contract` valida `productId`, nome do banco, namespace das migrations, propriedade do banco e migrations obrigatórias. Para validar um banco real anterior ao standalone:

```powershell
$env:ARTISYS_LEGACY_DB="C:\caminho\artisys-safras-talhoes.sqlite"; npm run compat:legacy
```

O arquivo original nunca é aberto diretamente: ele é copiado para uma sandbox temporária e somente a cópia recebe as migrations atuais.

`npm run phase6` valida o contrato e gera o instalador Windows. `npm run cutover:verify` acrescenta obrigatoriamente a prova com banco legado antes do build.

O monorepo continua sendo rollback/reference até que esses comandos sejam executados com sucesso e o instalador seja homologado em Windows.
