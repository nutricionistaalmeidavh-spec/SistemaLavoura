# ArtiSys Lavoura

Sistema agrícola standalone, local-first e offline-first para gestão de lavouras. O núcleo funciona sem assinatura, servidor próprio ou serviço pago obrigatório.

## Produto

O Lavoura reúne cadastro de fazendas/talhões/safras, planejamento e execução de operações, insumos e estoque, colheita, financeiro, relatórios, mapa agrícola, Modo Campo, mapas offline e integrações IoT opcionais.

- Desktop: Electron + SQLite local
- Campo/mobile: PWA com funcionamento offline
- Mapas: GIS local, PMTiles e pacotes regionais por fazenda
- IoT: MQTT, Modbus, LoRaWAN, CAN/J1939, ISOBUS/ISOXML, agrirouter e REST como integrações opcionais
- Dependência paga obrigatória: nenhuma

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
```

A certificação comercial é fail-closed: P0, P1, P2, P3 e P4/P5 precisam estar verdes no mesmo HEAD antes de merge/release.

## Mapas offline

O produto não depende de Google Maps. O mapa agrícola funciona com dados locais e o desktop pode preparar um pacote PMTiles somente da região da fazenda. O download inteligente usa fonte pública compatível e, após a instalação do pacote, o mapa regional permanece local.

Os pacotes estaduais completos são distribuídos separadamente do executável para não inflar o instalador.

## Status

Consulte [`PRODUCT_STATUS.md`](PRODUCT_STATUS.md) para o estado canônico do produto e [`docs/PHASES_P4_P5_FIELD_OFFLINE.md`](docs/PHASES_P4_P5_FIELD_OFFLINE.md) para a arquitetura de Modo Campo e mapas offline.
