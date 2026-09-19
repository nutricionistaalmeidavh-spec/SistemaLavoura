# Shared core snapshot

A pasta `shared/` é um snapshot pinado do core necessário para retirar Lavoura do monorepo sem criar dependência por caminho para `SistemasNichadosAgroFrota`.

Origem e commit estão registrados em `shared/core.lock.json`.

Regras:

1. Código de negócio de Lavoura fica em `src/`.
2. `shared/` não pode ganhar regra específica do produto.
3. O snapshot pode ser substituído depois por packages/repositório de core versionado, preservando os contratos usados por `src/`.
4. Nenhum serviço pago é dependência obrigatória.
5. Atualizações de `shared/` devem registrar novo commit de origem no lock.
