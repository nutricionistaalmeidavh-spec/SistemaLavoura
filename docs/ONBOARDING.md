# ArtiSys Lavoura — onboarding

Este guia cobre a instalação e os primeiros passos da versão estável 1.0.0.

## 1. Requisitos

- Windows 10 ou Windows 11, 64 bits.
- Espaço local para o aplicativo, banco SQLite e arquivos agrícolas.
- Internet não é necessária para o núcleo de gestão funcionar.
- Internet é necessária somente para recursos explicitamente externos, como novas consultas a catálogos de satélite e downloads de mapas/pacotes que ainda não estejam no dispositivo.
- Nenhuma assinatura, conta em servidor da ArtiSys ou serviço pago é exigido para usar o núcleo.

## 2. Obter a versão oficial

Baixe o instalador `ArtiSys-Lavoura-Setup-1.0.0.exe` na release `v1.0.0` deste repositório. A mesma release publica `SHA256SUMS.txt` e mantém o código-fonte correspondente acessível pelo tag `v1.0.0`.

Antes de instalar, valide o arquivo no PowerShell:

```powershell
Get-FileHash .\ArtiSys-Lavoura-Setup-1.0.0.exe -Algorithm SHA256
Get-Content .\SHA256SUMS.txt
```

O hash exibido deve ser igual ao publicado em `SHA256SUMS.txt`.

## 3. Instalação

1. Execute `ArtiSys-Lavoura-Setup-1.0.0.exe`.
2. Escolha o diretório de instalação quando solicitado.
3. Conclua o instalador.
4. Abra **ArtiSys Lavoura** pelo menu Iniciar ou pelo atalho criado na área de trabalho.

O aplicativo usa persistência local. Não é necessário configurar banco remoto.

## 4. Primeira configuração recomendada

Para validar o ambiente e começar a operar, siga esta sequência:

1. Cadastre a fazenda.
2. Cadastre um talhão e, quando disponível, defina ou importe seu limite geográfico.
3. Cadastre a safra ativa.
4. Cadastre insumos e confira o estoque inicial.
5. Planeje uma operação agrícola e registre sua execução.
6. Registre movimentações de estoque relacionadas à operação.
7. Registre uma colheita.
8. Confira custos e lançamentos financeiros.
9. Abra os relatórios e valide os resultados esperados.
10. Abra o mapa agrícola e confira a localização dos talhões.
11. Crie um backup nas Configurações antes de iniciar a operação real.

## 5. Backup e restauração

O produto possui fluxo de backup e restauração na área de Configurações. O mecanismo é coberto pela suíte de QA e a certificação verifica que um estado salvo pode ser restaurado sem perder a consistência esperada.

Recomendações operacionais:

- crie um backup antes de atualizações ou importações grandes;
- mantenha uma segunda cópia do backup em outro dispositivo;
- teste periodicamente a restauração em ambiente controlado;
- não substitua manualmente arquivos SQLite enquanto o aplicativo estiver aberto.

## 6. Funcionamento offline

O núcleo de cadastro, operações, estoque, colheita, financeiro e relatórios é local-first. Mapas regionais já instalados, cenas de satélite já armazenadas e dados do Modo Campo podem continuar disponíveis localmente conforme o conteúdo previamente preparado no dispositivo.

Recursos que buscam dados externos novos informam essa dependência de rede e não são requisitos para as funções centrais do produto.

## 7. GIS e mapas

O sistema suporta importação de GeoJSON, KML, KMZ, GPX, Shapefile ZIP e ISOXML/TaskData. O mapa agrícola não exige Google Maps. Pacotes PMTiles podem ser preparados por região para uso offline.

Antes de usar arquivos recebidos de terceiros em produção, confira visualmente o limite importado e confirme que o sistema de coordenadas e a posição estão corretos.

## 8. Satélite e IoT

Satélite e IoT são recursos opcionais. O produto continua operacional sem contratar qualquer provedor pago.

- Novas pesquisas de satélite dependem de internet e disponibilidade dos catálogos externos configurados.
- Dados já armazenados podem continuar disponíveis localmente.
- Integrações IoT dependem do equipamento/protocolo escolhido e devem ser configuradas somente quando necessárias.

## 9. Checklist antes de colocar uma fazenda real em produção

- [ ] Instalador obtido da release oficial.
- [ ] SHA-256 conferido.
- [ ] Aplicativo abre e fecha normalmente.
- [ ] Fazenda, talhão e safra de teste cadastrados.
- [ ] Operação agrícola criada e concluída.
- [ ] Estoque conferido após movimentação.
- [ ] Colheita registrada.
- [ ] Financeiro e relatórios conferidos.
- [ ] Mapa agrícola aberto e limites conferidos.
- [ ] Backup criado.
- [ ] Backup de teste restaurado com sucesso.
- [ ] Aplicativo fechado e reaberto com os dados preservados.

## 10. Licença e código-fonte

O ArtiSys Lavoura Core é licenciado sob `AGPL-3.0-only`. O texto integral está no arquivo [`../LICENSE`](../LICENSE). Para cada release oficial, o código correspondente é o conteúdo do mesmo tag publicado junto ao executável.
