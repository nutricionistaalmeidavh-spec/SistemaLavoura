# ArtiSys Lavoura — Fases 7 e 8

## Objetivo

Fechar a migração standalone com um ensaio de cutover usando banco legado real sem alterar o arquivo original e uma certificação de release que só aceite evidências geradas no commit atual.

## Fase 7 — Ensaio de cutover de dados

Entrada obrigatória: `ARTISYS_LEGACY_DB`, apontando para um arquivo existente `artisys-safras-talhoes.sqlite`.

Fluxo:
1. calcular SHA-256 do arquivo legado original;
2. copiar o arquivo para uma pasta temporária;
3. capturar um snapshot lógico das tabelas existentes na cópia antes do upgrade;
4. abrir a cópia por `createStandaloneHost`, aplicando as migrations `agro-lavoura/001-initial.sql`;
5. confirmar `productId=agro-lavoura`, saúde da persistência e namespace de migration;
6. criar backup imediatamente após o upgrade;
7. gravar um sentinel em coleção exclusiva `qa.cutover`, fechar e reabrir o host e confirmar persistência;
8. restaurar o backup e confirmar remoção do sentinel;
9. comparar os dados preexistentes das tabelas antigas com o snapshot anterior, ignorando somente tabelas/metadados internos de migrations permitidos;
10. recalcular SHA-256 do arquivo legado original e exigir igualdade byte a byte com o hash inicial;
11. gravar `qa-artifacts/phase7-summary.json` com commit Git, hashes, banco, migrations, contagens e status.

O ensaio nunca abre o banco original em modo de escrita. Toda migration, escrita e restauração ocorre somente na cópia temporária.

## Fase 8 — Certificação do release

A certificação é fail-closed. Ela exige, no mesmo commit:
- `qa-artifacts/phase5-summary.json` com `status=passed`;
- `qa-artifacts/phase7-summary.json` com `status=passed`;
- `qa-artifacts/playwright-summary.json` com exit code zero e commit atual;
- instalador `release/ArtiSys-Lavoura-Setup-*.exe` existente, não vazio e gerado depois do início da certificação;
- `npm run check` verde;
- `npm run build:win` verde.

O comando de certificação executa os gates na ordem: Fase 5 → Fase 7 → Playwright → build Windows → validação das evidências.

Saída: `qa-artifacts/release-certification.json`, contendo `productId`, commit, artefato, tamanho, hashes das evidências e `status=passed` apenas quando todos os gates estiverem verdes.

## Contrato funcional que continua obrigatório

Telas: `overview`, `fields`, `seasons`, `operations`, `inputs`, `harvest`, `inventory`, `finance`, `reports`, `settings`.

Ações: `fields/save`, `fields/remove`, `seasons/save`, `operations/schedule`, `operations/start`, `operations/complete`, `operations/cancel`, `inputs/save`, `harvest/create`, `inventory/receive`, `inventory/consume`, `finance/addExpense`, `finance/addIncome`, `reports/csv`, `reports/issue`, `settings/backup`, `settings/restore`.

## Segurança e rollback

- núcleo obrigatório continua R$0, self-hosted e open source;
- nenhum dado do cliente é enviado a serviço externo;
- o monorepo `SistemasNichadosAgroFrota` permanece rollback/reference;
- não há remoção do código legado nem promoção para `main` nesta fase;
- um release sem evidência fresca do commit atual permanece não certificado.
