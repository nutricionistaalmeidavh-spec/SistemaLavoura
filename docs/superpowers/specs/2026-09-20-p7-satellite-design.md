# P7 — Satélite opcional

## Objetivo

Adicionar descoberta e uso de imagens de satélite na gestão dos talhões sem transformar internet, conta externa ou API paga em requisito do produto.

## Provedores

### Sentinel-2 / Copernicus

Catálogo oficial STAC do Copernicus Data Space Ecosystem:

- endpoint: `https://stac.dataspace.copernicus.eu/v1/search`
- coleção: `sentinel-2-l2a`
- bandas de NDVI: vermelho B04 e NIR B08

A busca de catálogo é pública. Downloads de ativos que exigirem credenciais CDSE continuam opcionais e são tratados como capacidade do provedor, não como dependência do Sistema Lavoura.

### Landsat / USGS

Catálogo oficial LandsatLook STAC:

- endpoint: `https://landsatlook.usgs.gov/stac-server/search`
- coleção: `landsat-c2l2-sr`
- bandas normalizadas: `red` e `nir08`

A busca de catálogo é pública. Downloads protegidos por autenticação USGS permanecem opcionais.

## Arquitetura

`src/satellite.js` contém configuração de provedores, construção da consulta STAC, normalização de cenas e cálculo NDVI puro. Nenhum segredo é persistido.

A coleção `crop.satellite-cache` guarda somente artefatos explicitamente cacheados pelo usuário:

- metadata da cena;
- bounding box;
- provider/collection;
- preview em data URL quando o thumbnail é acessível;
- grade NDVI reduzida e seu resumo estatístico quando calculada;
- data de cache.

O cache funciona em SQLite e na persistência browser existente. Ele continua utilizável offline depois de salvo.

## NDVI

NDVI é calculado como `(NIR - RED) / (NIR + RED)`, com proteção para denominador zero e valores limitados ao intervalo [-1, 1].

Há dois caminhos:

1. ler bandas COG da cena quando as URLs HTTPS estiverem acessíveis ao cliente;
2. selecionar arquivos GeoTIFF locais de banda vermelha e NIR, permitindo cálculo totalmente offline mesmo quando o provedor exige autenticação para download.

`geotiff` lê COG/GeoTIFF e reamostra para uma grade de visualização pequena antes da persistência, evitando armazenar rasters gigantes no banco.

## UI

Nova superfície `Satélite` no grupo Monitoramento:

- escolher talhão;
- escolher Sentinel-2 ou Landsat;
- período e cobertura máxima de nuvens;
- buscar cenas;
- listar data, nuvens, coleção e disponibilidade de preview/bandas;
- cachear preview localmente;
- calcular NDVI por cena quando possível ou por arquivos locais;
- remover item do cache;
- alternar visualização entre `Vetorial`, `Imagem` e `NDVI`.

A visualização usa os limites/bounding boxes existentes do mapa agrícola. A imagem cacheada é sobreposta à área da cena; a grade NDVI é renderizada com escala contínua e legenda textual.

## Regras de custo e privacidade

- nenhuma chave compartilhada da ArtiSys;
- nenhuma conta externa obrigatória;
- nenhum servidor ArtiSys;
- nenhuma credencial de Copernicus/USGS persistida pelo produto nesta fase;
- catálogo online é opcional; cache e dados agrícolas locais continuam funcionando offline;
- atribuição/proveniência do provider acompanha o item cacheado.

## QA

- testes de consulta/normalização STAC com fetch mockado;
- testes de NDVI e estatísticas;
- testes de cache local e remoção;
- E2E da tela Satélite com catálogo mockado/local;
- regressão P0–P6 no mesmo HEAD.
