# Fases 18–27 — P0 comercial agrícola

## 18. Aplicações agrícolas
Registro estruturado por safra/talhão, área aplicada, produtos, dose/ha, quantidade calculada, alvo, operador/máquina e condições climáticas locais. A baixa financeira/estoque continua sendo transacional pela conclusão de operação.

## 19. Monitoramento
Ocorrências de pragas, doenças, ervas daninhas e outros eventos, com severidade, área afetada, coordenadas, observação e status.

## 20. GIS / mapa local
Persistência local de polígonos por talhão, com validação mínima de geometria e entrada manual de coordenadas. Não depende de mapas pagos ou rede.

## 21. Estoque agrícola 2.0
Mantém lotes/FEFO e baixa automática das fases anteriores e adiciona contagem física com ajuste auditável e registro de transferência entre armazéns.

## 22. Colheita 2.0
Produtividade/ha, umidade, impurezas, perdas, destino e referência de carga/romaneio.

## 23–25. Financeiro agrícola
Consolidação de despesas/receitas por safra, orçamento x realizado, desvio, percentual utilizado, produtividade e margem/resultado da safra.

## 26. Dashboard gerencial
Área gerenciada, operações abertas/concluídas, monitoramentos abertos, receita e custo agrícola, além dos indicadores operacionais existentes.

## 27. QA P0 comercial
Testes de domínio para 18–26 e Playwright verificando a superfície comercial. P0 só é considerado concluído após os pipelines P0/P1/P2 Linux e Windows passarem no estado integrado.

## Restrições
- local-first e self-hosted;
- nenhuma dependência paga obrigatória;
- IDs continuam internos;
- integrações externas permanecem opcionais;
- Frota/Máquinas não são duplicados.
