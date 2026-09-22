# ArtiSys Lavoura

Sistema agrícola standalone, local-first e offline-first para gestão de lavouras. O núcleo funciona sem assinatura, servidor próprio ou serviço pago obrigatório.

## Versão estável

A linha comercial estável é a **1.0.0**. O instalador Windows é produzido pela certificação automatizada do repositório e a release oficial publica também o checksum SHA-256 e o código-fonte correspondente ao mesmo tag.

Consulte [`docs/ONBOARDING.md`](docs/ONBOARDING.md) para instalação e primeiros passos e [`docs/RELEASE_1.0.0.md`](docs/RELEASE_1.0.0.md) para as notas desta versão.

## Produto

O Lavoura reúne cadastro de fazendas/talhões/safras, planejamento e execução de operações, insumos e estoque, colheita, financeiro, relatórios, mapa agrícola, Modo Campo, mapas offline, importação GIS, satélite opcional e integrações IoT opcionais.

- Desktop: Electron + SQLite local
- Campo/mobile: PWA com funcionamento offline
- Mapas: GIS local, PMTiles e pacotes regionais por fazenda
- Importação GIS: GeoJSON, KML, KMZ, GPX, Shapefile ZIP e ISOXML/TaskData
- Satélite opcional: catálogos Sentinel-2/Copernicus e Landsat/USGS, cache local e NDVI no dispositivo
- IoT: MQTT, Modbus, LoRaWAN, CAN/J1939, ISOBUS/ISOXML, agrirouter e REST como integrações opcionais
- Dependência paga obrigatória: nenhuma

## Licença

O código do **ArtiSys Lavoura Core** é software livre e open source sob **GNU Affero General Public License v3.0 only (`AGPL-3.0-only`)**. Consulte [`LICENSE`](LICENSE) para o texto integral.

A licença do código não concede, por si só, direitos sobre nomes, logotipos ou identidade visual da ArtiSys além do necessário para atribuição verdadeira. Consulte [`TRADEMARKS.md`](TRADEMARKS.md).

A distribuição do executável oficial mantém o código-fonte correspondente acessível pelo mesmo tag da release, sem custo adicional. Serviços de implantação, treinamento, customização ou integrações podem ser oferecidos separadamente, mas não são necessários para o núcleo funcionar.

## Desenvolvimento

Requer Node.js 22 ou superior.

```powershell
npm install
npm test
npm run build:web
```

Para executar a interface web em desenvolvimento:

```powershell
npm run dev:web
```

Para abrir o produto Electron:

```powershell
npm start
```

## QA e release

```powershell
npm run check
npm run qa:surface
npm run qa:p1
npm run qa:p2
npm run compat:contract
npm run build:win
npm run release:certify
```

A certificação comercial é fail-closed: **P0, P1, P2, P3, P4/P5, P6, P7 e P8** precisam estar verdes no mesmo estado de código antes da release. A automação de release da v1.0.0 executa novamente a certificação em Windows limpo, instala silenciosamente o artefato gerado, valida a instalação e publica instalador + SHA-256 somente quando todas as etapas passam.

## Mapas offline

O produto não depende de Google Maps. O mapa agrícola funciona com dados locais e o desktop pode preparar um pacote PMTiles somente da região da fazenda. O download inteligente usa fonte pública compatível e, após a instalação do pacote, o mapa regional permanece local.

Os pacotes estaduais completos são distribuídos separadamente do executável para não inflar o instalador.

## GIS e satélite

Arquivos GIS são analisados localmente e normalizados para GeoJSON/WGS84. Uma camada importada pode permanecer independente ou fornecer explicitamente o limite de um talhão.

A superfície Satélite é opcional: pesquisas novas dependem de internet e da disponibilidade dos catálogos externos, enquanto cenas/NDVI já armazenados continuam locais. O produto não persiste credenciais de Copernicus ou USGS.

## Status

Consulte [`PRODUCT_STATUS.md`](PRODUCT_STATUS.md) para o estado canônico do produto, [`docs/FUNCTIONALITY_MATRIX.md`](docs/FUNCTIONALITY_MATRIX.md) para a matriz funcional, [`docs/PHASE_P6_GIS_IMPORT.md`](docs/PHASE_P6_GIS_IMPORT.md) para importação GIS e [`docs/PHASE_P7_SATELLITE.md`](docs/PHASE_P7_SATELLITE.md) para satélite opcional.
