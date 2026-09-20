# P1 comercial agrícola — fases 28–47

Implementação P1 sobre o P0 comercial, preservando local-first e funcionamento sem serviço pago obrigatório.

- 28 planejamento completo de safra: plano por safra, período, talhões, operações e meta.
- 29 calendário agrícola consolidado.
- 30 meta/estimativa de produtividade no planejamento.
- 31 pluviometria manual e histórico persistível.
- 32 clima local/offline; provedores externos permanecem opcionais.
- 33 pedidos de compra de insumos.
- 34 fornecedores e histórico de preços.
- 35 necessidade futura de insumos descontando estoque.
- 36 lotes de produção por armazém/silo, preparados para origem na colheita.
- 37 comercialização de produção.
- 38 contratos/vendas e entregas.
- 39 comparação histórica de safras.
- 40 comparação de talhões.
- 41 indicadores agronômicos e financeiros.
- 42 relatório gerencial consolidado.
- 43 CSV, JSON e modelo tabular para XLSX; PDF permanece pelo serviço de PDF já existente.
- 44 busca agrícola global.
- 45 alertas inteligentes determinísticos.
- 46 snapshot de campo mobile/PWA explicitamente offline-ready.
- 47 QA de domínio cobrindo jornadas P1 e validações.

## Persistência

Novas coleções: `crop.rainfall`, `crop.suppliers`, `crop.purchase-orders`, `crop.storage-lots`, `crop.sales`, `crop.deliveries`.

## Limites intencionais

Integrações meteorológicas externas não são obrigatórias. Máquinas/Frota usam ArtiSys Agro Contract v1. O core não exige nuvem. O modelo XLSX é neutro e pode ser entregue ao adaptador de planilha existente; o PDF usa o módulo de documentos/PDF já incorporado ao produto.
