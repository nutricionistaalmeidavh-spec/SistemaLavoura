# Dependency inventory — ArtiSys Lavoura

## Dependências internas observadas

- `ui-shell`
- `vertical-persistence`
- `domain-finance`
- `product-documents`
- `product-inventory`
- `product-security`
- `domain-agro-core` consta no package original e deve permanecer rastreado até a poda final de dependências.

## Módulos `utilidades` do manifesto

Obrigatórios:

- `artisys-storage`
- `artisys-backup`
- `artisys-auth-rbac`
- `artisys-settings`
- `artisys-alerts`

Opcionais:

- `artisys-planning`
- `artisys-inventory`
- `artisys-reporting`
- `artisys-capture`
- `artisys-pwa-runtime`
- `artisys-sync`
- `artisys-catalog`
- `artisys-audit-log`
- `artisys-files`
- `artisys-importer`
- `artisys-feature-flags`

Política: nenhuma dependência paga/cloud pode se tornar obrigatória.
