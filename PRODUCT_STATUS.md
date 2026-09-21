# ArtiSys Lavoura — Status do Produto

## Contrato atual

- Produto: `agro-lavoura`
- Banco: `artisys-safras-talhoes.sqlite`
- Migrations: `agro-lavoura/001-initial.sql` + `agro-lavoura/002-iot.sql`
- Telas agrícolas-base contratadas: **10**
- Telas operacionais aditivas: **Modo Campo**, **Mapas offline**, **Importação GIS** e **Satélite**
- Superfícies virtuais adicionais: **Administração** e **Sensores e IoT**
- Ações agrícolas-base auditadas: **37** (**17 P0 + 11 P1 + 9 P2**)
- Dependência obrigatória paga: **nenhuma**
- Operação: **local-first / offline-first / self-hosted**
- Targets: desktop Electron + PWA/web

## P0 — integridade

Concluído. Cobre autenticação/RBAC, backup/restore, audit log, validação de domínio, dispatcher central, transação atômica/rollback, compatibilidade e certificação fail-closed.

- Cada comando registra `attempt`, `success` ou `failure`.
- Desktop usa transação SQLite por comando; PWA usa snapshot/rollback serializado.
- Restore preserva auditoria posterior ao backup.
- `tooling/qa-phase5.mjs` executa **17/17 ações P0**.
- O contrato P0 preserva as 10 telas originais na mesma ordem e permite superfícies aditivas posteriores.

## P1 — arquitetura e operação

Concluído. Inclui EventBus durável/retry, workflow agrícola, estoque e alertas, settings persistentes, reporting/dashboard, planejamento e conflitos, ciclo de alertas, importação/exportação, busca local e domínio financeiro determinístico.

`tooling/qa-p1.mjs` preserva P0 e executa as **11/11 ações P1**.

## P2 — produto agrícola

Concluído sem serviço externo obrigatório.

- captura e arquivos locais com SHA-256;
- PDF local;
- checklists operacionais;
- catálogo agrícola persistente;
- feature flags locais.

`tooling/qa-p2.mjs` executa as **9/9 ações P2**. O contrato agrícola-base permanece em **37 ações**.

## P3 — mapa agrícola / GIS

Concluído e integrado ao produto.

- visão espacial dos talhões com polígonos locais;
- safra ativa e resumo operacional por talhão;
- camadas de aplicações, monitoramentos, operações, fotos, chuva, sensores, máquinas, armazéns/silos e amostragem;
- pontos agrícolas persistentes;
- coordenadas reais ou centroide do talhão, sem inventar posição para registros não espacializados;
- funcionamento do núcleo do mapa sem Google Maps e sem serviço pago obrigatório.

O P3 possui workflow dedicado `P3 agricultural map` com testes unitários e jornada Playwright.

## P4 — Modo Campo

Concluído sobre a arquitetura local-first.

- tela dedicada **Modo Campo**;
- observações de campo persistidas com GPS e estado de sincronização;
- validação local de latitude/longitude;
- medição local de distância e área, sem API de mapas;
- visão por talhão de operações pendentes, monitoramentos e observações;
- PWA com manifest e service worker para abrir a aplicação sem conexão;
- o trabalho de campo continua disponível mesmo quando não existe mapa-base instalado.

## P5 — mapas offline inteligentes por fazenda

Concluído no desktop Windows x64, sem servidor próprio da ArtiSys como requisito.

- tela dedicada **Mapas offline**;
- bounding box calculado exclusivamente pelos polígonos dos talhões da fazenda selecionada;
- fail-closed para fazenda sem polígono mapeado;
- perfis `basic`, `detailed` e `maximum` com níveis de detalhe limitados;
- extração regional PMTiles em vez de baixar o Brasil ou o estado inteiro;
- uso de HTTP Range Requests contra uma fonte PMTiles pública compatível;
- instalação atômica (`.part` → pacote final), verificação do PMTiles e rollback em falha;
- preflight de espaço em disco e metadados locais do pacote;
- PMTiles CLI obtido sob demanda no desktop e validado por SHA-256 antes de uso;
- depois de instalado, o pacote regional permanece local e não exige internet para uso;
- integração opcional com o catálogo de pacotes estaduais do repositório de mapas, sem torná-lo dependência para o núcleo.

Os pacotes estaduais completos permanecem fora do instalador principal para não inflar o executável.

## P6 — importação GIS

Concluído no produto e coberto por gate dedicado.

- tela **Importação GIS**;
- GeoJSON, KML, KMZ, GPX, Shapefile ZIP e ISOXML/TaskData;
- parsing local, sem upload externo;
- normalização GeoJSON/WGS84 e validação fail-closed de coordenadas;
- persistência em `crop.gis-layers`;
- aplicação explícita de `Polygon`/`MultiPolygon` como limite de talhão;
- remoção da camada não remove limite já aplicado;
- `MultiPolygon` é preservado no read-model e renderer;
- camadas GIS genéricas permanecem visíveis como overlay independente no mapa agrícola.

## P7 — satélite opcional

Concluído como capacidade opcional, sem dependência operacional do núcleo.

- tela **Satélite**;
- pesquisa STAC para Sentinel-2/Copernicus e Landsat/USGS;
- seleção espacial baseada no polígono real do talhão;
- modos **Vetorial**, **Imagem** e **NDVI**;
- cache local em `crop.satellite-cache`;
- preview local limitado a 8 MiB;
- processamento de bandas GeoTIFF no dispositivo;
- NDVI limitado a `[-1,1]`, com tratamento de denominador zero/NaN;
- cache continua utilizável sem internet;
- credenciais externas não são persistidas pelo produto;
- nenhuma chave compartilhada ArtiSys ou assinatura obrigatória.

## P8 — robustez de mapas e GIS

Concluído no código e submetido a gate dedicado de certificação.

- códigos de erro estáveis e mensagens acionáveis para catálogo, fonte, disco, verificação, corrupção e recuperação;
- catálogo remoto validado antes de substituir o último catálogo local válido;
- promoção transacional de PMTiles com journal, `.part`, backup conhecido-bom e reconciliação após interrupção;
- recuperação preserva evidência quando o journal ou metadata local estão corrompidos, sem apagar silenciosamente um PMTiles potencialmente válido;
- metadados locais versionados com tamanho, SHA-256, instante de verificação e versão do catálogo;
- estados de saúde `healthy`, `unverified`, `outdated`, `missing` e `corrupt` expostos na UI;
- SHA completo executado sob ação explícita **Verificar integridade**, evitando rehash automático de arquivos grandes a cada abertura;
- cobertura estadual só é aceita quando a união dos pacotes disponíveis cobre integralmente o retângulo da fazenda, inclusive em propriedades multiestado;
- importações GIS rejeitam anéis auto-intersectantes e degenerados, preservando vértices colineares válidos;
- polígonos manuais legados não fechados continuam legíveis por fechamento apenas em memória, sem reescrever persistência;
- geometria legada inválida é isolada no read-model sem derrubar os demais talhões;
- snapshot do mapa usa índices por entidade/talhão; fixture de regressão cobre **5.000 talhões**;
- PWA mantém Modo Campo disponível e informa explicitamente que criação/verificação de PMTiles regionais exige o desktop Windows;
- jornada Playwright P8 roda em processo isolado e o `qa-web` falha fechado se a spec especializada desaparecer.

## UI / UX

Todas as áreas-base possuem renderização especializada e não dependem de editor técnico JSON. O produto usa formulários, seletores humanos e valores em unidades/reais; IDs técnicos permanecem internos sempre que o fluxo productizado permite.

Navegação agrícola aditiva atual:

1. Dashboard
2. Talhões
3. Safras
4. Operações
5. Insumos
6. Colheita
7. Estoque
8. Financeiro
9. Relatórios
10. Configurações
11. Modo Campo
12. Mapas offline
13. Importação GIS
14. Satélite

Sessões autorizadas ainda podem receber as superfícies virtuais de **Administração** e **Sensores e IoT**.

## IoT opcional

A migration `002-iot.sql` e `src/iot/` mantêm MQTT, Modbus, LoRaWAN, CAN/J1939, ISOBUS/ISOXML, agrirouter e APIs REST como integrações opcionais. O produto funciona integralmente sem broker, hardware ou serviço externo.

Comandos físicos permanecem fora da UI e desativados por padrão.

## CI e release

Workflows de produto:

- `P0 hardening`
- `P1 architecture and operation`
- `P2 agricultural product`
- `P3 agricultural map`
- `P4 P5 field offline`
- `P6 GIS import`
- `P7 satellite`
- `P8 map robustness`

Node de produto permanece 22. O build Windows usa `--publish never`. Os gates P6/P7/P8 executam suíte completa, build web e jornadas Playwright próprias; P0–P5 continuam responsáveis pelos regressivos e certificação/instalador existentes.

## Banco legado real

Quando existir uma base legada real a preservar:

```powershell
$env:ARTISYS_LEGACY_DB="C:\caminho\artisys-safras-talhoes.sqlite"; npm run release:certify
```

A homologação de banco legado é uma etapa de cutover para instalações existentes e não é requisito para uma instalação nova.

## Critério de fechamento

P0, P1, P2, P3, P4/P5, P6, P7 e P8 só são considerados certificados comercialmente quando os workflows correspondentes estiverem verdes no **mesmo HEAD/PR**, incluindo testes, build web/PWA, Playwright, compatibilidade, certificação Windows e contratos específicos de mapas/GIS/satélite.