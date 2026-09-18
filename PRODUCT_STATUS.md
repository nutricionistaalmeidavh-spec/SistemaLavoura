# ArtiSys Lavoura — Status do Produto

## Contrato atual

- Produto: `agro-lavoura`
- Banco: `artisys-safras-talhoes.sqlite`
- Telas contratadas: **10**
- Ações contratadas: **17**
- Dependência obrigatória paga: **nenhuma**
- Operação: local-first / self-hosted

## Fase 5

**Implementada; homologação pendente de execução fresca.**

Comando de prova:

```powershell
npm run phase5
```

Evidências: `qa-artifacts/phase5-summary.json`, relatório Playwright, screenshots e traces de falha.

## Fase 6

**Implementada; cutover pendente de banco legado e build Windows verificados.**

```powershell
$env:ARTISYS_LEGACY_DB="C:\caminho\artisys-safras-talhoes.sqlite"; npm run cutover:verify
```

O repositório só deve substituir definitivamente a origem do monorepo depois desses gates ficarem verdes.
