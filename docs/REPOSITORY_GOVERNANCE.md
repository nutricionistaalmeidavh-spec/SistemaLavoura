# Governança do repositório

## Branch principal

A `main` representa código integrável e não deve receber alterações comerciais diretamente. Mudanças devem entrar por pull request após os gates de qualidade aplicáveis.

## Proteção recomendada para `main`

Configuração alvo no GitHub:

- exigir pull request antes de merge;
- exigir resolução das conversas de revisão;
- impedir force-push;
- impedir exclusão da branch;
- exigir que os checks de certificação aplicáveis estejam verdes antes do merge;
- manter `CODEOWNERS` para identificar o responsável pelo produto;
- para uma release estável, exigir P0, P1, P2, P3, P4/P5, P6, P7 e P8 no mesmo estado de código.

## Releases

Uma versão estável deve:

1. usar SemVer;
2. possuir manifesto em `.release/`;
3. ser certificada no commit que será tagueado;
4. publicar o instalador oficial e `SHA256SUMS.txt`;
5. manter o código-fonte correspondente acessível pelo mesmo tag;
6. não introduzir dependência paga obrigatória no core;
7. documentar claramente qualquer serviço externo opcional.

## v1.0.0

A automação `.github/workflows/release-v1.0.0.yml` publica `v1.0.0` somente depois da certificação fail-closed e de um smoke test do instalador em um runner Windows limpo.
