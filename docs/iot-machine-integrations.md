# Integrações com máquinas agrícolas

Esta camada complementa o núcleo IoT da branch `roadmap/iot-ready` sem criar dependência obrigatória de fabricante, cloud ou serviço externo.

## Regra central

O Lavoura não presume que uma marca/modelo suporte todos os sinais de CAN, J1939 ou ISOBUS. A compatibilidade precisa ser comprovada por documentação do fabricante, AEF ISOBUS Database, contrato de API ou homologação física.

## Adapters genéricos

- `can.js`: recebe frames de uma fonte CAN injetada e só decodifica sinais explicitamente mapeados.
- `j1939.js`: interpreta o identificador J1939 e aplica somente mappings de PGN/sinal fornecidos legalmente ao integrador.
- `isobus.js`: recebe registros DDI já decodificados por gateway/stack autorizado e normaliza para o domínio IoT.
- `isoxml.js`: importa TaskData ISO 11783-10 por meio de `taskDataReader` injetado; não embute parser/standard proprietário no core.
- `agrirouter.js`: recebe TaskData/EFDI pela API oficial e usa `payloadDecoder` injetado para formatos binários/Protobuf.
- `rest.js`: bridge genérica para APIs oficiais/autorizadas. Inclui wrappers de protocolo para John Deere Operations Center e CNH FieldOps.

## Perfis de máquina

`src/iot/machine-profiles.js` mantém perfis por ecossistema, nunca uma promessa universal por modelo. Perfis atuais:

- CAN genérico;
- J1939 genérico;
- ISOBUS trator;
- ISOBUS implemento;
- agrirouter;
- John Deere Operations Center;
- CNH FieldOps (Case IH / New Holland / STEYR);
- AGCO/Fendt via agrirouter;
- Stara (CAN + API de parceiro quando contratada);
- Jacto Next/EKOS (bridge somente quando houver contrato técnico/API do parceiro).

## Evidências públicas usadas

- AEF ISOBUS/ISO 11783 e funcionalidades/certificação: `https://www.aef-online.org/about-us/isobus.html` e `https://www.aef-online.org/products/aef-isobus-database.html`.
- agrirouter TaskData/EFDI: `https://agrirouter.com/en/docs/message-types` e `https://agrirouter.com/en/docs/message-types/efdi`.
- John Deere Operations Center equipment/device state/engine hours: `https://developer.deere.com/dev-docs/machine-device-state-reports` e `https://developer.deere.com/dev-docs/machine-hours-of-operation`.
- CNH FieldOps e telemetria ISO 15143-3/CAN profiles: `https://develop.cnh.com/api-guides/fieldops-api` e `https://develop.cnh.com/api-guides/fieldops-api/vehicle-telemetry`.
- Fendt/AGCO e agrirouter: `https://www.fendt.com/br/smart-farming/fendtone`.
- Stara integração por API de parceiro e rede CAN: `https://www.stara.com.br/noticias/departamento-de-rede/telemetria-stara-permite-integrar-informacoes-da-maquina-com-outros-softwares`.
- Jacto Next/EKOS multimarcas: `https://blog.jacto.com.br/jacto-next/`.

## Limites deliberados

1. Nenhum PGN/SPN proprietário é copiado para o repositório.
2. Nenhum DDI ou trecho de norma licenciada é reproduzido como catálogo interno sem licença apropriada.
3. A AEF Database deve ser usada para confirmar funcionalidade/modelo antes da homologação.
4. Deere/CNH exigem autenticação e permissões do cliente; recursos podem depender de contrato/licença do fornecedor.
5. Stara/Jacto não são marcados como API pública aberta. O bridge só é ativado após documentação/credencial oficial do parceiro.
6. Controle físico continua desabilitado por padrão; estes adapters são voltados a leitura/importação.
