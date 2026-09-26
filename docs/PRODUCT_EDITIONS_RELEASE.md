# Product editions — P5–P12

## Enforcement
O backend é a fonte de verdade. `describe` filtra navegação/telas pela edição; `load` e `action` repetem o guard para impedir bypass do frontend. RBAC continua sendo aplicado depois do entitlement.

## Perfis
- Essential: registro agrícola — dashboard, talhões, safras, operações, insumos, colheita e configurações essenciais.
- Management: Essential + estoque, financeiro, relatórios/PDF, arquivos, checklists, mapas e administração.
- Complete: Management + GIS, satélite/NDVI, IoT e auditoria.

## Upgrade
Upgrade é monotônico: Essential → Management/Complete e Management → Complete. A troca da licença não migra nem remove dados.

## Release
O build continua único: `ArtiSys-Lavoura-Setup-${version}.exe`. A edição é uma propriedade da licença/runtime, não um fork nem um instalador separado.

## Gates
- `npm run qa:editions`
- `npm run check`
- `npm run release:certify`

A edição padrão permanece `complete` durante a transição para preservar instalações existentes. Distribuição comercial deve fornecer a edição/licença explicitamente.
