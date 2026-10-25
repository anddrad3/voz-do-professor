# Importação, atualização e monitoramento de fontes

## Fluxo

O servidor possui importação por fluxo de CSV e uma execução periódica por manifesto. O cadastro resultante é persistente e entra em rascunho. Não atribuímos validação humana ao processamento automático.

- **Receita Federal:** estabelecimentos ativos e CNAEs `8511200`, `8512100`, `8513900` e `8520100`, também verificados na lista de atividades secundárias. Arquivos sem cabeçalho, separador `;`, Latin-1; layout de 30 colunas.
- **Censo Escolar:** cabeçalho com `CO_ENTIDADE`, `NO_ENTIDADE`, `TP_SITUACAO_FUNCIONAMENTO`, `TP_DEPENDENCIA`, `NO_MUNICIPIO` e `SG_UF`; utiliza CNPJ, endereço e coordenadas quando disponibilizados na edição. Redes são mapeadas de 1/2/3/4 para federal/estadual/municipal/privada.
- **CSV normalizado:** instituições, publicações, editais ou pesquisas. Permite integrar outras fontes após seu tratamento editorial.

O cruzamento usa CNPJ e código Inep, sem correspondência automática por nome aproximado. Quando os identificadores apontam para escolas distintas, a linha é rejeitada para evitar uma fusão incorreta. Nomes/municípios divergentes ficam sinalizados. Coordenadas e dados anteriormente conferidos são preservados quando ausentes na nova base.

Inativação de instituição já cadastrada atualiza o registro e o retira da circulação para revisão. Novos estabelecimentos inativos são ignorados. Fontes idênticas são ignoradas sem invalidar a publicação; mudanças reais geram nova revisão. Conteúdos e editais normalizados são identificados pela combinação link de fonte + título; não altere ambos ao atualizar sem antes localizar o registro na gestão.

## Fontes oficiais

- [Layout dos dados abertos do CNPJ](https://www.gov.br/receitafederal/dados/cnpj-metadados.pdf).
- [Microdados do Censo Escolar / Inep](https://www.gov.br/inep/pt-br/acesso-a-informacao/dados-abertos/microdados/censo-escolar).
- [Lei 11.738/2008 — referência do piso salarial](https://planalto.gov.br/ccivil_03/_ato2007-2010/2008/lei/l11738.htm).

Os endereços acima foram conferidos na preparação do projeto. A aplicação não presume valores salariais atuais nem publica o conteúdo dos exemplos como notícia verdadeira.

## Arquivos grandes e manifesto

Baixe os arquivos oficiais da edição escolhida, descompacte os CSVs em um diretório de dados e use o dicionário correspondente. O importador não baixa nem descompacta automaticamente todos os arquivos nacionais: o volume é grande e o leiaute pode variar. Mantenha essa etapa em uma rotina operacional controlada. Arquivos que não disponibilizam coordenadas continuam pesquisáveis por cidade/rede, mas ficam fora do mapa e do raio até enriquecimento verificado.

Crie um manifesto fora do versionamento, por exemplo `data/import-manifest.json`:

```json
{
  "sources": [
    {
      "path": "data/fontes/Estabelecimentos.csv",
      "format": "cnpj",
      "kind": "school",
      "encoding": "latin1",
      "sourceDate": "2026-10-01",
      "municipalitiesPath": "data/fontes/Municipios.csv"
    },
    {
      "path": "data/fontes/microdados_ed_basica.csv",
      "format": "census",
      "kind": "school",
      "encoding": "latin1",
      "sourceDate": "2026-10-01"
    },
    {
      "path": "data/fontes/selecoes-verificaveis.csv",
      "format": "normalized",
      "kind": "opportunity",
      "encoding": "utf8"
    }
  ]
}
```

Datas no exemplo são ilustrativas: substitua pela data de referência real. Os caminhos são relativos à pasta onde o servidor é iniciado, ou absolutos.

```sh
npm run import -- data/import-manifest.json
```

Para execução periódica, configure `IMPORT_MANIFEST=data/import-manifest.json` e `IMPORT_INTERVAL_HOURS=24`. O servidor importa ao iniciar e no intervalo configurado, impedindo execuções simultâneas desse agendador. O servidor precisa permanecer ligado. Atualize os arquivos de origem atomicamente para que o agendamento não leia um download incompleto.

## Importação pela interface

Abra **Gestão → Importações**. Selecione destino, formato, data da base, separador, codificação e arquivo. Limite de 8 MB para uploads; use CLI para bases grandes. As execuções e até 50 amostras de erros de linha aparecem no histórico, com contagem total de erros. Registros válidos de uma execução parcialmente incorreta permanecem em rascunho para revisão.

CSV normalizado de instituição:

```csv
title;network;city;state;address;sourceName;sourceUrl;sourceDate;lat;lng
Escola de exemplo;Municipal;Franca;SP;Endereço a conferir;Fonte oficial;https://example.org/fonte;2026-10-01;-20.5386;-47.4009
```

CSV normalizado de oportunidade:

```csv
title;type;city;state;discipline;level;education;requirements;opens;closes;sourceName;sourceUrl;sourceDate
Edital de exemplo;Concurso público;Franca;SP;Matemática;Ensino Fundamental;Licenciatura;Conferir diploma no edital;2026-10-01;2026-11-01;Fonte oficial;https://example.org/edital;2026-10-01
```

São modelos, não fontes reais. Use `type=Seleção privada` para processos privados e `Cadastro de reserva` para reservas. Salário, jornada, prova, inscrição, documentos e coordenadas são opcionais. `opens` e `closes` são obrigatórios para editais. `stage` aceita `Automático`, `Em andamento`, `Suspenso` ou `Finalizado`.

Campos compostos como `tags`, `history` e `questions` usam JSON dentro da célula CSV com aspas escapadas. A definição completa e validada de cada formato está em `server/domain.js`.

## Qualidade e publicação

Abra **Gestão → Qualidade** para duplicidades, fontes com mais de 180 dias, coordenadas ausentes e divergências entre bases. Exporte os apontamentos em CSV e edite o registro correspondente. Na revisão, confira fonte, data, endereço, contatos e eventual canal de recrutamento.

Nenhum processo privado, concurso ou norma é considerado publicado apenas por existir em uma fonte importada. A curadoria humana é obrigatória; ao publicar, o servidor gera alertas para perfis compatíveis. O calendário calcula a situação pelo dia no fuso de São Paulo e respeita alterações de estágio registradas pelo curador.
