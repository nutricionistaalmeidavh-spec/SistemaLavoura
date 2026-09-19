# Sistema Lavoura — Resultado UI-4 → UI-10

## Resultado funcional

A productização substitui o fallback técnico por workspaces humanos, preservando o mesmo contrato de backend.

### Workspaces
- Dashboard: permanece especializado desde UI-3.
- Talhões: tabela, indicadores, cadastro/edição, exclusão confirmada e anexos.
- Safras: tabela e formulário estruturado.
- Operações: estados do workflow, planejamento, ações contextuais e checklists.
- Insumos: tabela e cadastro estruturado.
- Colheita: tabela e registro estruturado.
- Estoque: saldos, indicadores, movimentos e entrada/saída estruturadas.
- Financeiro: receitas, despesas, resultado, margem e lançamentos estruturados.
- Relatórios: catálogo, CSV, PDF, emissão, resumo/exportação e histórico.
- Configurações: preferências, feature flags, backups, recuperação quando suportada, importação CSV e catálogo agrícola.

## Arquitetura

A implementação adiciona contratos locais de UI e componentes reutilizáveis de formulário/dialog/tabela. Nenhum workspace escreve diretamente na persistência; todos chamam `onRun`, que continua delegando para `backend.action()` e para a camada de comandos/RBAC/transação/auditoria existente.

## JSON técnico

O antigo `ActionPanel` foi removido do Product Runtime. Nenhuma tela da navegação depende de `action-json` ou de `JSON de entrada`. Texto estruturado ainda pode existir quando o próprio formato do usuário é textual, como CSV de importação ou preview CSV de relatório.

## QA

A cobertura adicionada exige:
- contratos de UI para todas as telas não-dashboard;
- renderer especializado para todos os `screen.kind` publicados;
- ausência do editor JSON técnico;
- existência dos workspaces UI-4 → UI-10;
- E2E de cadastro de talhão por formulário humano;
- E2E de entrada de estoque;
- E2E de despesa financeira;
- E2E de geração/emissão de relatório;
- E2E de acesso às configurações estruturadas.

A certificação final continua condicionada aos gates P0/P1/P2 Linux + Windows do HEAD integrado.
