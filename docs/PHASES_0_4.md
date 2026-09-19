# Migração standalone — Fases 0–4

## Fase 0 — Baseline
Origem congelada no monorepo em `a95bd0176ad4053276c5588d3170d18fe5c24c8e`. Contratos, telas, dados e dependências inventariados.

## Fase 1 — Fronteiras
Dependências do produto identificadas; nenhum corte destrutivo no monorepo. Política obrigatória: núcleo R$0, local/self-hosted e open source.

## Fase 2 — Produto standalone
Código de domínio, persistência, migrations, seed, branding e snapshot do core compartilhado vivem neste repositório. O runtime não importa caminhos do antigo monorepo.

## Fase 3 — Runtime e QA independentes
O repositório possui host SQLite, backup/restauração, UI própria, bridge Electron segura, testes Node e Playwright, build Vite e gate Woodpecker. `npm run check` valida imports, testes e build web; `npm run qa:web` cobre a jornada visual funcional.

## Fase 4 — Release e cutover
`npm run build:win` gera instalador NSIS x64 local; `npm run release:win` executa gates antes do instalador. O cutover só pode tornar este repositório fonte canônica após QA e instalador verificados. O código legado no monorepo não deve ser removido antes disso.
