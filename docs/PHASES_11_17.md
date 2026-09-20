# Fases 11–17 — núcleo agrícola comercial

Implementação do primeiro bloco do roadmap comercial sem dependências pagas obrigatórias.

## Fase 11 — Modelo agrícola 2.0

- Fazenda (`crop.farm-units`).
- Área/Setor (`crop.farm-areas`).
- Talhão vinculado à fazenda e, opcionalmente, à área/setor.
- Safra com período amigável, cultivar, ciclo, janela de plantio, população-alvo, meta de produtividade e orçamento.
- Cultivares persistidas em `crop.varieties`.
- IDs continuam existindo internamente, mas podem ser gerados automaticamente.

## Fase 12 — UX agrícola

- Formulários principais não solicitam IDs técnicos.
- Valores monetários são informados em reais e convertidos para centavos apenas no domínio.
- Talhões, safras e insumos usam seletores com rótulos agrícolas legíveis.
- Unidades agrícolas comuns são oferecidas diretamente.
- Planejamentos e checklists recebem IDs internos automaticamente.

## Fases 13–16 — transação operação → estoque → custos

`operations.complete` é a fronteira transacional. Uma conclusão pode:

1. validar área executada e insumos;
2. calcular quantidade por dose/ha;
3. validar saldo antes da baixa;
4. concluir a operação;
5. baixar os lotes/itens no estoque;
6. calcular custo de insumos, mão de obra, máquina e outros;
7. lançar a despesa da operação no financeiro;
8. calcular custo por hectare;
9. atualizar os read models de custos por talhão, safra e categoria.

O dispatcher já existente fornece atomicidade no SQLite e rollback por snapshot na PWA. O fluxo não inicia uma segunda transação interna.

Exemplo: `Glifosato | 2 L/ha` em 50 ha consome 100 L. Se o insumo custa R$ 10/L, o custo de insumo é R$ 1.000. Somando R$ 100 de mão de obra e R$ 200 de máquina, a operação registra R$ 1.300 e R$ 26/ha.

## Fase 17 — Caderno de campo

Toda operação concluída gera automaticamente um registro em `crop.field-notebook` contendo:

- safra e talhão;
- tipo e data da operação;
- área executada;
- insumos/quantidades/doses;
- máquina e operador quando informados;
- custo total e custo/ha;
- observações;
- vínculo com a operação de origem.

O registro é exibido no workspace de Operações e participa da mesma transação dos demais efeitos.

## Critérios de aceite

- jornada ponta a ponta coberta por teste funcional;
- rollback comprovado quando um efeito posterior falha;
- compatibilidade mantida com chamadas antigas que ainda enviam IDs explicitamente;
- nenhuma dependência de SaaS ou API paga;
- mesmos mecanismos de auditoria, backup e autenticação já existentes são preservados.
