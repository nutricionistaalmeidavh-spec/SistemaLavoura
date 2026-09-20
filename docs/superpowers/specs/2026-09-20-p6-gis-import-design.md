# P6 — Importação GIS

## Objetivo

Permitir que o usuário traga dados geoespaciais existentes para o Sistema Lavoura sem redesenhar tudo manualmente, mantendo a operação local-first e sem serviço pago obrigatório.

## Formatos suportados

- GeoJSON (`.geojson` / `.json`)
- KML (`.kml`)
- KMZ (`.kmz`)
- GPX (`.gpx`)
- Shapefile em pacote ZIP (`.zip`, contendo `.shp` e, quando disponíveis, `.dbf`/`.prj`)
- Shapefile geométrico `.shp` quando a projeção já estiver em WGS84
- ISOXML / TaskData (`.zip` ou `TASKDATA.XML`) para geometrias de `Partfield` quando disponíveis

## Arquitetura

Todos os formatos entram por um parser cliente e são normalizados para `FeatureCollection` GeoJSON em WGS84. A camada de domínio valida coordenadas, tamanho, tipos geométricos e quantidade de feições antes de persistir.

A persistência usa uma coleção própria `crop.gis-layers`, sem alterar o contrato de talhões existente. Uma camada importada preserva nome, formato de origem, arquivo de origem, propriedades das feições, avisos de conversão e timestamp.

O usuário pode manter a importação como camada genérica (pontos, linhas, polígonos) ou aplicar uma feição `Polygon`/`MultiPolygon` como limite de um talhão existente. A aplicação grava em `crop.field-geometries`, preservando o desenho original na camada GIS.

## UI

Nova superfície `Importação GIS` no grupo Produção:

1. selecionar arquivo;
2. analisar localmente;
3. mostrar formato, quantidade de feições e tipos geométricos;
4. exibir erros/avisos antes de salvar;
5. salvar camada;
6. opcionalmente escolher uma feição poligonal e um talhão para aplicá-la como limite;
7. remover camada importada sem apagar o limite já aplicado ao talhão.

## Regras

- arquivos são analisados localmente; nenhum upload externo;
- nenhuma URL de KML `NetworkLink` é seguida automaticamente;
- coordenadas inválidas falham fechado;
- importação vazia falha;
- limites WGS84 são obrigatórios depois da normalização;
- `MultiPolygon` é preservado na camada e aceito para limite de talhão;
- o mapa agrícola continua compatível com geometrias antigas de polígono simples;
- ISOXML reutiliza a biblioteca `isoxml` e importa limites de `Partfield`; grids e telemetria continuam fora do escopo de P6.

## Dependências

- `@tmcw/togeojson` para KML/GPX;
- `@xmldom/xmldom` para XML em Node/browser;
- `fflate` para KMZ;
- `shpjs` para Shapefile;
- `isoxml` para TaskData ISO 11783-10.

Todas são bibliotecas locais, sem serviço remoto obrigatório.

## QA

- testes unitários para normalização/validação;
- fixtures para GeoJSON, KML, GPX, KMZ, Shapefile e ISOXML;
- E2E da tela de importação;
- regressão do mapa agrícola com `MultiPolygon`;
- P0–P5 continuam verdes no mesmo HEAD.
