# Dependency inventory — ArtiSys Lavoura

## Core interno efetivamente incorporado

- `ui-shell`
- `vertical-persistence`
- `domain-finance`
- `product-documents`
- `product-eventbus`
- `product-inventory`
- `product-security`
- `product-settings`

Vendor snapshots incorporados:

- `artisys-storage`
- `artisys-auth-rbac`
- `artisys-audit-log`
- `artisys-inventory`
- `artisys-reporting`
- `artisys-pdf`

## Módulos locais de produto P2

- capture
- files/upload
- checklists
- agricultural catalog
- feature flags
- agricultural PDF integration

Esses módulos usam a persistência genérica já existente e não adicionam serviço remoto obrigatório nem migration SQL adicional.

## Manifesto / utilidades

O `vertical.manifest.json` continua registrando o catálogo de módulos reutilizáveis obrigatórios/opcionais do ecossistema. A presença no manifesto não deve ser interpretada como dependência runtime automática; a incorporação efetiva é rastreada por `shared/core.lock.json` e pelos módulos locais do produto.

Política: **nenhuma dependência paga/cloud pode se tornar obrigatória**.
