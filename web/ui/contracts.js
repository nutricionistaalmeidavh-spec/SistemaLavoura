const field=(name,label,type='text',options={})=>Object.freeze({name,label,type,...options});
const action=(name,label,fields=[],options={})=>Object.freeze({name,label,fields:Object.freeze(fields),...options});
const units=['kg','L','sc','t','un','mL','g'];

export const SCREEN_UI_CONTRACTS=Object.freeze({
  fields:Object.freeze({screenId:'fields',title:'Talhões',actions:Object.freeze({
    save:action('save','Salvar talhão',[
      field('code','Código'),field('name','Nome'),field('farmUnitName','Fazenda'),field('areaName','Área/Setor (opcional)'),field('areaHa','Área (ha)','number',{min:0.01,step:'0.01'})
    ]),
    remove:action('remove','Excluir talhão',[],{confirm:true,destructive:true}),
    uploadFile:action('uploadFile','Anexar arquivo',[field('file','Arquivo','file')]),
    removeFile:action('removeFile','Excluir arquivo',[],{confirm:true,destructive:true}),
    saveGeometry:action('saveGeometry','Salvar mapa do talhão',[field('fieldId','Talhão','select',{optionsKey:'fieldOptions'}),field('coordinatesText','Coordenadas do polígono','textarea',{help:'Uma coordenada longitude,latitude por linha.'})]),
    addScouting:action('addScouting','Registrar monitoramento',[field('seasonId','Safra','select',{optionsKey:'seasonOptions'}),field('fieldId','Talhão','select',{optionsKey:'fieldOptions'}),field('kind','Tipo','select',{options:['praga','doença','erva-daninha','outro']}),field('name','Ocorrência'),field('severity','Severidade (0-5)','number',{min:0,max:5}),field('affectedAreaHa','Área afetada (ha)','number'),field('notes','Observações','textarea')])
  })}),
  seasons:Object.freeze({screenId:'seasons',title:'Safras',actions:Object.freeze({
    save:action('save','Salvar safra',[
      field('crop','Cultura'),field('periodName','Safra/Período','text',{help:'Ex.: 2026/27'}),field('varietyName','Cultivar'),field('cycleDays','Ciclo (dias)','number',{min:1,step:'1'}),
      field('fieldIds','Talhões','multiselect',{optionsKey:'fieldOptions'}),field('plantingWindowStart','Início da janela de plantio','date'),field('plantingWindowEnd','Fim da janela de plantio','date'),
      field('targetPopulation','População-alvo','number',{min:0,step:'any'}),field('expectedYieldPerHa','Meta de produtividade/ha','number',{min:0,step:'any'}),field('budget','Orçamento (R$)','money',{min:0,step:'0.01'})
    ])
  })}),
  operations:Object.freeze({screenId:'operations',title:'Operações',actions:Object.freeze({
    schedule:action('schedule','Programar operação',[
      field('seasonId','Safra','select',{optionsKey:'seasonOptions'}),field('fieldId','Talhão','select',{optionsKey:'fieldOptions'}),field('typeName','Tipo de operação'),field('scheduledAt','Programada para','datetime-local'),field('machineName','Máquina/Recurso'),field('operatorName','Operador')
    ]),
    start:action('start','Iniciar operação',[field('startedAt','Iniciada em','datetime-local')]),
    complete:action('complete','Concluir operação',[
      field('completedAt','Concluída em','datetime-local'),field('actualAreaHa','Área executada (ha)','number',{min:0.0001,step:'any'}),
      field('inputUsages','Insumos aplicados','lines',{help:'Um por linha. Ex.: Glifosato | 2 L/ha ou Adjuvante | 5 L'}),
      field('laborCost','Mão de obra (R$)','money',{min:0,step:'0.01'}),field('machineCost','Máquina (R$)','money',{min:0,step:'0.01'}),field('otherCost','Outros custos (R$)','money',{min:0,step:'0.01'}),field('notes','Observações','textarea')
    ]),
    cancel:action('cancel','Cancelar operação',[field('reason','Motivo','textarea',{required:true}),field('cancelledAt','Cancelada em','datetime-local')],{confirm:true,destructive:true}),
    savePlan:action('savePlan','Salvar planejamento',[field('name','Nome'),field('seasonId','Safra','select',{optionsKey:'seasonOptions'}),field('startsAt','Início','datetime-local'),field('endsAt','Fim','datetime-local'),field('resourceIds','Recursos','tags')]),
    createChecklist:action('createChecklist','Criar checklist',[field('title','Título'),field('items','Itens obrigatórios','lines')]),
    setChecklistItem:action('setChecklistItem','Atualizar item',[field('itemId','Item'),field('checked','Concluído','checkbox')]),
    completeChecklist:action('completeChecklist','Concluir checklist',[],{confirm:true}),
    recordRainfall:action('recordRainfall','Registrar chuva',[field('fieldId','Talhão','select',{optionsKey:'fieldOptions'}),field('mm','Chuva (mm)','number',{min:0.1}),field('measuredAt','Data e hora','datetime-local'),field('notes','Observações','textarea')]),
    recordApplication:action('recordApplication','Registrar aplicação',[field('seasonId','Safra','select',{optionsKey:'seasonOptions'}),field('fieldId','Talhão','select',{optionsKey:'fieldOptions'}),field('areaHa','Área aplicada (ha)','number',{min:0.01}),field('products','Produtos e doses','lines',{help:'Um por linha: Insumo | 2 L/ha'}),field('target','Alvo'),field('temperatureC','Temperatura (°C)','number'),field('humidityPct','Umidade (%)','number'),field('windKmh','Vento (km/h)','number'),field('notes','Observações','textarea')]),
    addScouting:action('addScouting','Registrar monitoramento',[field('seasonId','Safra','select',{optionsKey:'seasonOptions'}),field('fieldId','Talhão','select',{optionsKey:'fieldOptions'}),field('kind','Tipo','select',{options:['praga','doença','erva-daninha','outro']}),field('name','Ocorrência'),field('severity','Severidade (0-5)','number',{min:0,max:5}),field('notes','Observações','textarea')])
  })}),
  inputs:Object.freeze({screenId:'inputs',title:'Insumos',actions:Object.freeze({
    save:action('save','Salvar insumo',[field('name','Nome'),field('unit','Unidade','select',{options:units}),field('category','Categoria'),field('unitCost','Custo unitário (R$)','money',{min:0,step:'0.01'}),field('brand','Marca'),field('activeIngredient','Ingrediente ativo')])
  })}),
  harvest:Object.freeze({screenId:'harvest',title:'Colheita',actions:Object.freeze({
    addStorage:action('addStorage','Registrar lote armazenado',[field('seasonId','Safra','select',{optionsKey:'seasonOptions'}),field('fieldId','Talhão','select',{optionsKey:'fieldOptions'}),field('warehouse','Silo/Armazém'),field('quantity','Quantidade','number',{min:0.0001}),field('unit','Unidade','select',{options:['kg','t','sc']})]),
    create:action('create','Registrar colheita',[field('seasonId','Safra','select',{optionsKey:'seasonOptions'}),field('fieldId','Talhão','select',{optionsKey:'fieldOptions'}),field('quantity','Quantidade','number',{min:0.0001,step:'any'}),field('unit','Unidade','select',{options:['kg','t','sc']}),field('areaHa','Área colhida (ha)','number',{min:0.0001,step:'any'}),field('harvestedAt','Data da colheita','datetime-local'),field('moisturePct','Umidade (%)','number',{min:0}),field('impurityPct','Impurezas (%)','number',{min:0}),field('lossPct','Perdas (%)','number',{min:0}),field('destination','Destino/Silo'),field('loadRef','Carga/romaneio')])
  })}),
  inventory:Object.freeze({screenId:'inventory',title:'Estoque',actions:Object.freeze({
    receive:action('receive','Registrar entrada',[field('sku','Insumo','select',{optionsKey:'inputOptions'}),field('quantity','Quantidade','number',{min:0.0001,step:'any'}),field('lotNumber','Lote'),field('expiresAt','Validade','date'),field('reference','Referência'),field('occurredAt','Data','datetime-local')]),
    consume:action('consume','Registrar saída',[field('sku','Insumo','select',{optionsKey:'inputOptions'}),field('quantity','Quantidade','number',{min:0.0001,step:'any'}),field('lotNumber','Lote'),field('reference','Referência'),field('occurredAt','Data','datetime-local')]),
    physicalCount:action('physicalCount','Contagem física',[field('sku','Insumo','select',{optionsKey:'inputOptions'}),field('countedQuantity','Quantidade contada','number',{min:0}),field('warehouse','Armazém')]),
    transfer:action('transfer','Transferir estoque',[field('sku','Insumo','select',{optionsKey:'inputOptions'}),field('quantity','Quantidade','number',{min:0.0001}),field('fromWarehouse','Origem'),field('toWarehouse','Destino')])
  })}),
  finance:Object.freeze({screenId:'finance',title:'Financeiro',actions:Object.freeze({
    addExpense:action('addExpense','Nova despesa',[field('seasonId','Safra','select',{optionsKey:'seasonOptions'}),field('fieldId','Talhão','select',{optionsKey:'fieldOptions'}),field('amount','Valor (R$)','money',{min:0.01,step:'0.01'}),field('description','Descrição'),field('category','Categoria')]),
    saveSupplier:action('saveSupplier','Novo fornecedor',[field('name','Nome'),field('document','CPF/CNPJ'),field('phone','Telefone'),field('email','E-mail')]),
    createPurchaseOrder:action('createPurchaseOrder','Novo pedido de compra',[field('supplierId','Fornecedor'),field('seasonId','Safra','select',{optionsKey:'seasonOptions'}),field('itemsText','Itens','lines',{help:'Um por linha: ID do insumo | quantidade | custo unitário em centavos'})]),
    receivePurchaseOrder:action('receivePurchaseOrder','Receber pedido',[field('id','Pedido'),field('warehouse','Armazém')]),
    createSale:action('createSale','Nova venda',[field('seasonId','Safra','select',{optionsKey:'seasonOptions'}),field('buyer','Comprador'),field('quantity','Quantidade','number',{min:0.0001}),field('unit','Unidade','select',{options:['kg','t','sc']}),field('unitPrice','Preço unitário (R$)','money',{min:0}),field('fieldId','Talhão','select',{optionsKey:'fieldOptions'})]),
    deliverSale:action('deliverSale','Registrar entrega',[field('saleId','Venda'),field('quantity','Quantidade','number',{min:0.0001}),field('reference','Romaneio/Referência')]),
    addIncome:action('addIncome','Nova receita',[field('seasonId','Safra','select',{optionsKey:'seasonOptions'}),field('fieldId','Talhão','select',{optionsKey:'fieldOptions'}),field('amount','Valor (R$)','money',{min:0.01,step:'0.01'}),field('description','Descrição'),field('partyId','Cliente/Parte')])
  })}),
  reports:Object.freeze({screenId:'reports',title:'Relatórios',actions:Object.freeze({
    csv:action('csv','Gerar CSV',[field('type','Relatório','select',{options:['season-summary','field-operations','traceability']}),field('rows','Linhas','lines')]),
    issue:action('issue','Emitir documento',[field('type','Relatório','select',{options:['season-summary','field-operations','traceability']}),field('title','Título'),field('rows','Linhas','lines')]),
    summary:action('summary','Resumir dados',[field('groupField','Agrupar por'),field('valueField','Campo de valor'),field('op','Operação','select',{options:['sum','count','avg']})]),
    export:action('export','Exportar dados',[field('format','Formato','select',{options:['csv','json','xlsx-model']})]),
    pdf:action('pdf','Gerar PDF',[field('type','Relatório','select',{options:['season-summary','field-operations','traceability']}),field('title','Título')])
  })}),
  settings:Object.freeze({screenId:'settings',title:'Configurações',actions:Object.freeze({
    backup:action('backup','Criar backup',[field('label','Identificação')]),
    restore:action('restore','Restaurar backup',[],{confirm:true,destructive:true}),
    recoveryCode:action('recoveryCode','Gerar código de recuperação',[]),
    restoreByCode:action('restoreByCode','Restaurar por código',[field('code','Código de recuperação')],{confirm:true,destructive:true}),
    set:action('set','Alterar preferência',[field('key','Preferência','select',{options:['inventory.lowStockThreshold','planning.lookAheadDays','alerts.enabled','reporting.csvDelimiter']}),field('value','Valor')]),
    merge:action('merge','Salvar preferências',[field('inventoryLowStockThreshold','Estoque mínimo','number',{min:0}),field('planningLookAheadDays','Dias de planejamento','number',{min:1}),field('alertsEnabled','Alertas ativos','checkbox'),field('reportingCsvDelimiter','Separador CSV')]),
    previewImport:action('previewImport','Pré-visualizar importação',[field('target','Destino','select',{options:['fields','inputs']}),field('csv','Dados CSV','textarea',{help:'Primeira linha deve conter os nomes das colunas.'})]),
    applyImport:action('applyImport','Aplicar importação',[],{confirm:true}),
    upsertCatalog:action('upsertCatalog','Salvar item do catálogo',[field('id','ID'),field('kind','Tipo','select',{options:['crop','input','operation-type']}),field('name','Nome'),field('code','Código'),field('active','Ativo','checkbox')]),
    setFeatureFlag:action('setFeatureFlag','Alterar recurso',[field('key','Recurso'),field('value','Ativo','checkbox')])
  })})
});

export function getUiContract(screenId){return SCREEN_UI_CONTRACTS[String(screenId)]??null;}
export function hydrateUiFields(fields=[],references={}){return fields.map(definition=>definition.optionsKey?Object.freeze({...definition,options:references?.[definition.optionsKey]??[]}):definition);}
export function referenceLabel(references,key,value){const found=(references?.[key]??[]).find(option=>String(option.value)===String(value));return found?.label??String(value??'—');}

export function parseCsvText(csv=''){
  const lines=String(csv).split(/\r?\n/).map(line=>line.trim()).filter(Boolean);
  if(lines.length<2)return [];
  const headers=lines[0].split(',').map(value=>value.trim());
  return lines.slice(1).map(line=>Object.fromEntries(line.split(',').map((value,index)=>[headers[index],value?.trim()??''])));
}

export function normalizeFormValues(fields=[],values={}){
  const result={};
  for(const definition of fields){
    let value=values[definition.name];
    if(definition.type==='number'||definition.type==='money')value=value===''||value==null?null:Number(value);
    else if(definition.type==='checkbox')value=Boolean(value);
    else if(definition.type==='tags')value=String(value??'').split(',').map(item=>item.trim()).filter(Boolean);
    else if(definition.type==='multiselect')value=Array.isArray(value)?value.map(String).filter(Boolean):String(value??'').split(',').map(item=>item.trim()).filter(Boolean);
    else if(definition.type==='lines')value=String(value??'').split(/\r?\n/).map(item=>item.trim()).filter(Boolean);
    else if((definition.type==='datetime-local'||definition.type==='date')&&value)value=new Date(value).toISOString();
    if(value!==''&&value!=null)result[definition.name]=value;
  }
  return result;
}
