# Cutover

Estado desejado da Fase 4: este repositório passa a ser a fonte canônica de ArtiSys Lavoura somente após todos os gates abaixo estarem verdes.

- `npm ci`
- `npx playwright install chromium`
- `npm run check`
- `npm run qa:web`
- `npm run build:win`
- abrir o instalador em Windows limpo e repetir a jornada crítica
- abrir banco existente `artisys-safras-talhoes.sqlite` e validar leitura/escrita
- criar backup, alterar dados, restaurar e conferir rollback

Até a homologação, `SistemasNichadosAgroFrota` permanece rollback/reference. Nenhuma exclusão automática de código legado é autorizada por esta fase.
