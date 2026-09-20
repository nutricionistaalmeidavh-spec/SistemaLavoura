# ArtiSys Lavoura — Status do Produto

## Contrato atual

- Produto: `agro-lavoura`
- Banco: `artisys-safras-talhoes.sqlite`
- Migrations atuais: `agro-lavoura/001-initial.sql` + `agro-lavoura/002-iot.sql`
- Telas agrícolas contratadas: **10**
- Superfícies virtuais adicionais: **Administração** e **Sensores e IoT**
- Ações funcionais agrícolas contratadas: **37** (**17 P0 + 11 P1 + 9 P2**)
- Dependência obrigatória paga: **nenhuma**
- Operação: **local-first / self-hosted**
- Targets: desktop Electron + PWA/web
- IoT: camada opcional com consulta e configuração local no desktop, sem custo recorrente obrigatório do produto

## P0 — integridade

Concluído. Cobre autenticação/RBAC, backup/restore, audit-log, validação de domínio, comando central, transação atômica/rollback, QA funcional das 17 ações originais, compatibilidade, build Windows e certificação fail-closed.

- Cada comando registra `attempt`, `success` ou `failure`.
- Desktop usa uma transação SQLite por comando; PWA usa snapshot/rollback serializado.
- Restore preserva auditoria posterior ao backup.
- `tooling/qa-phase5.mjs` executa **17/17 ações P0**.

## P1 — arquitetura e operação

Concluído. Adiciona **12 módulos** e **11 ações funcionais**:

- EventBus durável com retry;
- workflow engine agrícola;
- inventory e alerta de estoque baixo;
- settings persistentes;
- reporting e dashboard;
- planning com progresso/conflitos;
- alerts com acknowledge/snooze/dismiss;
- importer/exporter;
- search local accent-insensitive;
- finance-domain determinístico.

`tooling/qa-p1.mjs` exige **12/12 módulos** e **11/11 ações P1**, preservando o contrato P0.

## P2 — produto agrícola

Concluído sobre a mesma arquitetura local-first, sem serviço externo obrigatório.

- Capture ligado a entidades agrícolas e controlado por feature flag.
- Arquivos locais com validação de nome, limite padrão de 10 MiB, SHA-256, listagem/download/remoção.
- PDF local integrado a `product-documents` / `artisys-pdf`.
- Checklists ligados a operações, com itens obrigatórios e bloqueio opcional antes da conclusão.
- Catálogo persistente para `crop`, `input`, `operation-type`, `unit` e `category`.
- Feature flags locais para capture, files, PDF, checklists e catálogo.

`tooling/qa-p2.mjs` executa funcionalmente as **9/9 ações P2** e verifica os **7/7 módulos**, preservando P0/P1. O contrato agrícola agregado permanece **37 ações**.

## UI Productization

### UI-0 → UI-3

Concluídas:

- design system Lavoura;
- shell/navegação agrupada;
- Product Runtime por `screen.kind`;
- dashboard especializado baseado apenas em dados reais.

### UI-4 → UI-10

Implementadas com workspaces especializados para todas as áreas da navegação:

- UI-4: Talhões;
- UI-5: formulários estruturados e remoção do editor JSON;
- UI-6: dialogs/confirmations;
- UI-7: Safras e Operações;
- UI-8: Estoque;
- UI-9: Financeiro;
- UI-10: Relatórios.

Também foram productizadas, para cumprir o requisito de **zero interface técnica JSON**:

- Insumos;
- Colheita;
- Configurações;
- Administração/RBAC;
- Sensores e IoT.

A camada React permanece somente de apresentação: ações agrícolas continuam passando pelo backend/dispatcher certificado; Administração usa o serviço de segurança; configuração IoT usa o provider local sob `iot:configure` e registra `attempt/success/failure` na auditoria de segurança.

## UX atual

As 10 telas agrícolas possuem renderização especializada:

1. Dashboard
2. Talhões
3. Safras
4. Operações
5. Insumos
6. Colheita
7. Estoque
8. Financeiro
9. Relatórios
10. Configurações

Além delas, sessões autorizadas recebem superfícies virtuais de **Administração** e **Sensores e IoT**. Não existe `ActionPanel`, `action-json` ou campo `JSON de entrada` na experiência do usuário. Os fluxos trabalham com formulários e seletores humanos; IDs técnicos e valores em centavos não são exigidos nos fluxos productizados.

## IoT opcional

A migration `002-iot.sql` e a camada `src/iot/` preservam integrações opcionais como MQTT, Modbus, LoRaWAN, CAN/J1939, ISOBUS/ISOXML, agrirouter e APIs REST de fornecedores. O núcleo do produto não depende dessas integrações para funcionar.

No desktop, usuários com `iot:configure` podem pela UI:

- cadastrar dispositivos;
- vincular dispositivo a talhão;
- configurar e ativar/desativar integrações sem editor JSON;
- criar/remover regras de limiar, dispositivo offline e bateria baixa;
- configurar limiar, histerese, ocorrências mínimas e severidade.

As regras e seus estados ficam no SQLite local. Alertas IoT entram no mesmo serviço de alertas do produto e usam o ciclo já existente de reconhecer, adiar e dispensar. Segredos de integração não são devolvidos pela API de leitura. Comandos físicos continuam fora da UI e desativados por padrão.

## CI e release

- workflows P0/P1/P2 usam `actions/checkout@v7` e `actions/setup-node@v7`;
- Node de produto permanece 22;
- `build:win` mantém `--publish never`;
- Linux executa testes, build web, QA funcional e Playwright;
- Windows executa certificação de release e gera instalador;
- base legada de CI é sintética e não destrutiva;
- não existe `package-lock.json` no baseline atual, portanto CI continua em `npm install`; migrar para `npm ci` depende primeiro de gerar e versionar um lockfile real validado.

## Banco legado real

Quando existir uma base legada real a preservar, a homologação adicional permanece disponível:

```powershell
$env:ARTISYS_LEGACY_DB="C:\caminho\artisys-safras-talhoes.sqlite"; npm run release:certify
```

Essa homologação é uma etapa de migração/cutover para instalações com dados antigos; não é dependência para uma instalação nova.

## Critério de fechamento

P0/P1/P2, productização UI e superfícies opcionais só são considerados certificados quando os workflows correspondentes estiverem verdes no mesmo HEAD/PR, com Linux aprovado, Windows aprovado, QA funcional completo, Playwright aprovado e instalador Windows gerado.
