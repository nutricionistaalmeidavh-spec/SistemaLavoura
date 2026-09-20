# P4/P5 — Modo Campo e mapas offline por fazenda

## P4 — Modo Campo

O Modo Campo é uma superfície mobile-first e local-first adicionada ao produto sem substituir o domínio agrícola existente.

### Entregas

- tela `Modo Campo` na navegação;
- PWA instalável com `manifest.webmanifest` e service worker;
- uso do GPS do dispositivo pelo padrão `navigator.geolocation`;
- seleção de talhão pelo mapa ou seletor;
- início de operação planejada;
- registro de ocorrência georreferenciada;
- observação de campo persistente;
- captura de foto com `capture="environment"` em dispositivos compatíveis;
- foto vinculada ao talhão e observação georreferenciada;
- medição local de distância por Haversine;
- medição local aproximada de área por projeção local + shoelace;
- fila local de observações com `syncState=pending`, pronta para futura sincronização multi-dispositivo;
- funcionamento do domínio de campo mesmo quando nenhum mapa-base estiver instalado.

A PWA guarda o shell e os assets visitados no cache do service worker. Os registros agrícolas continuam na persistência local já usada pelo produto.

## P5 — Baixar mapa desta fazenda

A tela `Mapas offline` permite escolher uma fazenda mapeada e um perfil:

| Perfil | Zoom máximo |
| --- | ---: |
| Básico | 10 |
| Detalhado | 12 |
| Máximo | 14 |

O bounding box é calculado exclusivamente a partir dos polígonos dos talhões pertencentes à fazenda selecionada. Fazendas sem seus próprios polígonos falham fechado e não recebem geometria de outra propriedade.

### Estratégia de download

O desktop Windows não precisa baixar um estado inteiro para depois recortá-lo. O fluxo usa o CLI oficial PMTiles sobre um build diário Protomaps remoto:

```text
Talhões da fazenda
      ↓
bounding box local
      ↓
pmtiles extract https://build.protomaps.com/YYYYMMDD.pmtiles
      ↓
HTTP Range Requests
      ↓
somente os blocos necessários
      ↓
pmtiles verify
      ↓
rename atômico
      ↓
mapa regional local
```

Assim, o produto continua sem servidor próprio e sem API paga obrigatória.

### Robustez do instalador regional

- PMTiles CLI fixado em `v1.31.2`;
- download automático do binário somente no desktop Windows x64;
- SHA-256 do arquivo oficial verificado antes da extração;
- pré-checagem de espaço em disco;
- download em arquivo temporário;
- `pmtiles verify` antes da instalação;
- backup do pacote anterior durante a troca;
- restauração do anterior se a troca falhar;
- metadados locais por fazenda/perfil;
- remoção explícita pelo usuário.

## Relação com `mapasbrasilrelease`

O repositório `mapasbrasilrelease` continua sendo a distribuição oficial dos pacotes completos Brasil/UF e do manifesto versionado. O planejador P5 entende esse manifesto e constrói URLs de fallback dos assets publicados.

A geração regional não depende de uma release publicada: quando necessário, o desktop resolve um build diário Protomaps recente e recorta diretamente por HTTP Range. Isso evita bloquear o Modo Campo quando a release completa estiver em homologação/draft.

O P5 **não publica releases automaticamente**.

## Limites desta fase

- criação automática de PMTiles regional: Windows x64 desktop;
- no PWA/mobile, o Modo Campo continua disponível, mas o arquivo PMTiles regional é preparado pelo desktop nesta fase;
- sincronização entre dispositivos não faz parte do P4; a fila persistente apenas deixa esse contrato preparado;
- renderização cartográfica MapLibre/PMTiles pode ser adicionada sobre o read-model espacial sem alterar o domínio agrícola.

## Custo operacional obrigatório

**R$ 0.**

Não há Google Maps, servidor ArtiSys, broker, banco cloud ou assinatura obrigatória nesta arquitetura.
