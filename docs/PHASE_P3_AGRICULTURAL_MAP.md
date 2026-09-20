# P3 — Mapa agrícola operacional

## Objetivo

Transformar a geometria já existente dos talhões em uma visão espacial operacional do Sistema Lavoura, sem criar uma segunda fonte de verdade para dados agrícolas e sem adicionar dependência obrigatória de internet, Google Maps ou outro serviço pago.

## Entregas

1. **Talhões como polígonos interativos**
   - usa `crop.field-geometries` já existente;
   - calcula centroide e limites somente para apresentação;
   - mantém longitude/latitude como dados locais.

2. **Cor por contexto agrícola**
   - talhão com safra recebe cor determinística pela cultura;
   - talhão sem safra recebe cor neutra;
   - legenda é derivada das culturas realmente presentes.

3. **Safra ativa e ficha do talhão**
   - cultura;
   - cultivar;
   - período/safra;
   - área;
   - monitoramentos abertos;
   - chuva acumulada dos últimos 7 dias;
   - operações planejadas;
   - fotos vinculadas.

4. **Camadas operacionais**
   - aplicações;
   - ocorrências/monitoramentos;
   - operações;
   - fotos;
   - chuva;
   - sensores/pluviômetros;
   - máquinas;
   - armazéns/silos;
   - pontos de amostragem.

5. **Pontos georreferenciados persistentes**
   - coleção local `crop.map-points`;
   - tipos permitidos: `sensor`, `machine`, `storage`, `sampling`;
   - latitude/longitude validadas;
   - associação opcional com talhão e safra;
   - criação disponível na tela de Talhões.

6. **Aplicações e monitoramentos com coordenadas**
   - o domínio preserva latitude/longitude quando informadas;
   - coordenadas inválidas são rejeitadas;
   - quando um evento possui apenas `fieldId`, a apresentação pode usar o centroide do talhão e marca explicitamente `coordinateSource: field-centroid`.

## Regra de integridade espacial

O sistema **não inventa uma coordenada geográfica** para um item que não tenha nem coordenada explícita nem talhão com polígono conhecido.

Quando o centroide do talhão é utilizado para posicionar visualmente uma operação, foto ou chuva, o snapshot registra a origem como `field-centroid`. Coordenadas registradas diretamente ficam com `coordinateSource: explicit`.

## Arquitetura

### Domínio e read-model

`src/agricultural-map.js` é independente de renderer e de provedor de mapa. Ele recebe dados agrícolas e devolve um snapshot espacial congelado com:

- `fields`;
- `layers`;
- `legend`;
- `bounds`;
- `unmappedFields`;
- `generatedAt`.

### Apresentação

`src/presentation-p3.js` decora a apresentação comercial existente sem alterar os contratos anteriores. A tela `fields` passa a devolver também:

- `map` — snapshot espacial consolidado;
- `mapPoints` — registros persistentes de pontos agrícolas.

Também adiciona as ações:

- `saveMapPoint`;
- `removeMapPoint`.

### UI

`web/ui/agricultural-map.jsx` renderiza o snapshot em SVG local e interativo. O SVG é deliberadamente uma camada de apresentação simples e zero-dependência: o read-model não conhece SVG, MapLibre, PMTiles ou qualquer outro renderer.

Isso permite substituir ou complementar a base visual por MapLibre/PMTiles sem mudar o domínio agrícola.

## Integração com o repositório de mapas

O P3 **não importa nem embute** arquivos do repositório `mapasbrasilrelease` no código-fonte do Sistema Lavoura.

A separação é intencional:

- `mapasbrasilrelease` distribui/versiona os pacotes cartográficos offline;
- `SistemaLavoura` guarda talhões, eventos e pontos agrícolas;
- uma camada de renderer pode combinar ambos no cliente sem que os dados agrícolas dependam do pacote cartográfico.

Assim, o cliente continua conseguindo abrir talhões, fichas e camadas agrícolas mesmo quando nenhuma base cartográfica está instalada.

## Custo e conectividade

O P3 adiciona **zero dependência obrigatória paga** e **zero requisito de servidor próprio**.

- persistência: local;
- renderização agrícola: local;
- pontos e polígonos: locais;
- mapas offline: compatíveis com a distribuição externa por PMTiles;
- integrações com máquinas/sensores: continuam opcionais.

## QA

O contrato P3 cobre:

- validação de pontos georreferenciados;
- cálculo espacial dos talhões;
- safra ativa/cultura/cultivar;
- resumo do talhão;
- as nove camadas previstas no roadmap;
- ausência de coordenadas inventadas;
- wiring da UI;
- uso da apresentação P3 nos runtimes web e desktop.
