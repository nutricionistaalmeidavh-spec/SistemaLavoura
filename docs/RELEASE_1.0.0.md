# ArtiSys Lavoura v1.0.0

Primeira release comercial estável do ArtiSys Lavoura.

## Escopo

A v1.0.0 consolida em uma distribuição local-first e offline-first:

- fazendas, talhões e safras;
- planejamento e execução de operações agrícolas;
- catálogo de insumos e estoque;
- colheita;
- financeiro e relatórios;
- mapa agrícola;
- Modo Campo;
- mapas offline e pacotes regionais PMTiles;
- importação GIS em GeoJSON, KML, KMZ, GPX, Shapefile ZIP e ISOXML/TaskData;
- satélite opcional com cache local e processamento de NDVI;
- integrações IoT opcionais.

## Modelo de execução

O núcleo funciona localmente sem servidor da ArtiSys, assinatura ou serviço pago obrigatório. Recursos que consultam fontes externas novas — por exemplo, catálogos de satélite — dependem de internet e da disponibilidade do provedor, mas não são requisito para as funções centrais.

## Licença

O ArtiSys Lavoura Core é distribuído sob **GNU Affero General Public License v3.0 only (`AGPL-3.0-only`)**. O texto integral está em `LICENSE` e o código-fonte correspondente desta versão é o tag `v1.0.0`.

## Artefatos oficiais

A release é criada somente após a certificação automatizada em Windows e publica:

- `ArtiSys-Lavoura-Setup-1.0.0.exe`;
- `SHA256SUMS.txt`;
- arquivos-fonte gerados automaticamente pelo GitHub para o tag `v1.0.0`.

## Verificação do instalador

No PowerShell:

```powershell
Get-FileHash .\ArtiSys-Lavoura-Setup-1.0.0.exe -Algorithm SHA256
Get-Content .\SHA256SUMS.txt
```

Os valores devem coincidir.

## Gate de qualidade

A publicação é fail-closed. O pipeline de release executa a certificação do produto no mesmo commit, incluindo testes automatizados, Playwright, compatibilidade, build Windows, certificação do artefato e smoke test da instalação em um runner Windows limpo. Se qualquer etapa falhar, a release não é publicada.

## Primeira implantação

Consulte [`ONBOARDING.md`](ONBOARDING.md) e conclua o checklist de instalação, fluxo agrícola, backup, restauração, fechamento e reabertura antes de usar dados reais de produção.

## Limitações e opcionais

- Consultas novas de satélite exigem conexão quando a informação ainda não estiver em cache.
- Downloads de novos pacotes de mapas exigem conexão; pacotes já instalados permanecem locais.
- Integrações IoT dependem do equipamento e protocolo efetivamente configurados.
- Assinatura Authenticode do executável não é requisito técnico do core e não é uma dependência paga obrigatória. Quando ausente, o Windows pode apresentar avisos de reputação/SmartScreen; o SHA-256 oficial permite verificar a integridade do artefato.
