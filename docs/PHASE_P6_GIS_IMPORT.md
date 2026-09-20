# P6 — Importação GIS

## Entrega

O Sistema Lavoura passa a importar dados geoespaciais existentes sem enviar o arquivo para um servidor externo.

Formatos aceitos pela superfície de importação:

- GeoJSON (`.geojson` / `.json`);
- KML (`.kml`);
- KMZ (`.kmz`);
- GPX (`.gpx`);
- Shapefile empacotado em ZIP, preferencialmente com `.shp`, `.dbf` e `.prj`;
- Shapefile geométrico avulso (`.shp`) quando as coordenadas já estiverem em WGS84;
- ISOXML/TaskData (`TASKDATA.XML` ou ZIP) para limites `Partfield` disponíveis.

Para `.shp` avulso, o sistema importa somente a geometria, assume WGS84 e mostra aviso explícito de que atributos/projeção não acompanham o arquivo. Para preservar `.dbf` e `.prj`, a opção recomendada continua sendo ZIP.

## Fluxo

1. usuário seleciona o arquivo;
2. parser roda localmente;
3. conteúdo é normalizado para `FeatureCollection` GeoJSON em WGS84;
4. coordenadas e tipos geométricos são validados;
5. prévia informa quantidade/tipos de feições e avisos de conversão;
6. camada é persistida em `crop.gis-layers`;
7. uma feição `Polygon` ou `MultiPolygon` pode ser aplicada explicitamente como limite de um talhão;
8. excluir a camada não exclui um limite de talhão já aplicado.

## Integridade

- nenhuma URL de `NetworkLink` KML é seguida automaticamente;
- coordenadas fora de WGS84 são rejeitadas;
- coleção vazia é rejeitada;
- feição aplicada ao talhão exige seleção explícita do usuário;
- `MultiPolygon` é preservado pelo domínio e pelo mapa agrícola;
- pontos, linhas e polígonos de camadas importadas podem permanecer como overlay independente no mapa agrícola;
- `.shp` avulso nunca finge possuir projeção ou atributos que não vieram no arquivo.

## Dependências

As bibliotecas de parsing ficam empacotadas com o aplicativo. Não existe API paga, servidor ArtiSys ou conta externa obrigatória para importar arquivos.

## Persistência

- camadas: `crop.gis-layers`;
- limites aplicados: `crop.field-geometries`;
- metadados preservados: nome, formato, arquivo de origem, propriedades, avisos e data da importação.
