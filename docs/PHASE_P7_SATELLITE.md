# P7 — Satélite opcional

## Objetivo

Adicionar consulta e uso local de imagery agrícola sem transformar internet, conta de provedor ou API paga em requisito do Sistema Lavoura.

## Fontes de catálogo

### Sentinel-2 / Copernicus

- STAC: `https://stac.dataspace.copernicus.eu/v1/search`
- coleção: `sentinel-2-l2a`
- vermelho: B04
- NIR: B08

### Landsat / USGS

- STAC: `https://landsatlook.usgs.gov/stac-server/search`
- coleção: `landsat-c2l2-sr`
- vermelho: `red`
- NIR: `nir08`

A pesquisa de catálogo é uma capacidade online opcional. Ativos que o provedor proteger por autenticação continuam opcionais e não criam uma dependência operacional do Lavoura.

## Modos

- **Vetorial** — usa o mapa agrícola local existente;
- **Imagem** — mostra preview disponível da cena selecionada;
- **NDVI** — processa localmente duas bandas GeoTIFF selecionadas pelo usuário.

## Cache local

Cenas escolhidas podem ser armazenadas em `crop.satellite-cache` com:

- metadados normalizados da cena;
- preview local opcional, limitado a 8 MiB;
- grade NDVI reduzida;
- estatísticas NDVI;
- data de cache.

Credenciais externas não fazem parte do contrato persistido.

## NDVI

O cálculo é executado no dispositivo:

`NDVI = (NIR - RED) / (NIR + RED)`

Regras:

- denominador zero produz valor neutro `0`;
- valores não finitos são tratados de forma segura;
- resultado é limitado a `[-1, 1]`;
- GeoTIFFs são reamostrados antes do cálculo para evitar carregar rasters agrícolas completos na memória do renderer;
- os arquivos selecionados não são enviados à ArtiSys.

## Operação offline

Sem internet, a tela continua listando e abrindo o cache já salvo e o mapa vetorial local. Somente nova pesquisa no catálogo deixa de estar disponível.

## Custo

P7 não adiciona servidor próprio, chave compartilhada ArtiSys ou assinatura obrigatória. O núcleo P0–P6 permanece utilizável independentemente das fontes de satélite.
