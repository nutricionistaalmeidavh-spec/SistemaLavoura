# Integração ArtiSys Agro v1

O Lavoura é consumidor do contrato v1 canônico mantido em `utilidades/modules/artisys-agro-contract`.

O adapter aceita uso de máquina, abastecimento e manutenção sem ler bancos de outros produtos. A ligação física usa Agro Bridge local com segredo de pareamento. Sem Bridge, o Lavoura continua operando manualmente.

Identidades externas permanecem em `source + entityId`; relações agrícolas usam `links.fieldId`, `links.seasonId` e `links.operationId`.

A integração automática deve chamar callbacks do domínio do Lavoura; não escrever diretamente no SQLite.
