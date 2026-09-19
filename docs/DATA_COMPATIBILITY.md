# Data compatibility — ArtiSys Lavoura

Contrato a preservar durante a migração:

- product id: `agro-lavoura`
- targets: `desktop`, `pwa`
- migrations: `./migrations`
- seeds: `./seeds`
- branding: `./branding/brand.json`
- migration inicial: `migrations/001-initial.sql`
- metadados de persistência: `persistence/product.persistence.json`

A migração não altera schema, ids de collections, slugs ou formato de backup nesta fase. Compatibilidade com banco existente será validada antes da remoção do app do monorepo.
