# ArtiSys Lavoura — edições comerciais

Esta camada define **entitlements**, não preços. Preço é decisão comercial externa ao runtime.

| Capability | Essential | Management | Complete |
|---|:---:|:---:|:---:|
| Núcleo, dashboard, talhões, safras, operações, insumos e colheita | ✓ | ✓ | ✓ |
| Estoque e financeiro | — | ✓ | ✓ |
| Relatórios/PDF, arquivos e checklists | — | ✓ | ✓ |
| Mapas | — | ✓ | ✓ |
| GIS, satélite e NDVI | — | — | ✓ |
| IoT e auditoria | — | — | ✓ |
| Administração | — | ✓ | ✓ |

## Arquitetura P0–P4

1. A edição fornece defaults determinísticos.
2. Features assinadas da licença podem especializar os defaults.
3. Overrides de tenant/usuário continuam possíveis na camada de flags.
4. O core permanece local/self-hosted, sem serviço pago obrigatório.
5. P0–P4 **não aplicam ainda guards de RPC/backend ou ocultação de UI**; isso pertence à P5/P6.

A licença usa o produto canônico `artisys-lavoura`. A verificação criptográfica deve ser fornecida pelo módulo compartilhado `@artisys/licensing`; a chave privada nunca deve ser embarcada no cliente.
