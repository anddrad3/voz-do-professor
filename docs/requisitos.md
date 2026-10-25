# Matriz dos 66 requisitos

Rastreabilidade do catálogo fornecido em `Voz_do_Professor.pdf`. Cada item abaixo tem um fluxo implementado. As verificações indicam a tela ou teste correspondente; não significam que todos os conteúdos reais já foram importados ou revisados.

**Condições de operação:** os exemplos são demonstrativos; notícias, normas, salários, escolas e editais reais precisam de fontes cadastradas/importadas e revisão humana. O agendamento processa arquivos locais configurados; alertas são internos. Relatórios PDF utilizam a impressão do navegador. Hospedagem, responsáveis de privacidade e carga nacional de dados devem ser configurados conforme README e documentos de operação.

## Módulo 1

| ID  | Funcionalidade do PDF                                 | Implementação                                                             | Como conferir                                                      |
| --- | ----------------------------------------------------- | ------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| 1.1 | Portal de notícias educacionais                       | Portal e cards de notícias com busca e detalhes                           | Direitos e Notícias → Notícia                                      |
| 1.2 | Biblioteca de legislação educacional                  | Acervo categorizado de normas                                             | Direitos e Notícias → Legislação                                   |
| 1.3 | Consulta ao piso salarial do magistério               | Consulta por ano, valor, jornada e fonte; valores inseridos por curadoria | Direitos e Notícias → Piso salarial → detalhes                     |
| 1.4 | Consulta aos planos de carreira municipais            | Planos municipais pesquisáveis por cidade e UF                            | Direitos e Notícias → Plano de carreira + município                |
| 1.5 | Atualizações sobre decisões dos conselhos de educação | Categoria dedicada aos conselhos de educação                              | Direitos e Notícias → Conselho de educação                         |
| 1.6 | Explicador de legislação em linguagem simples         | Resumo em linguagem simples, obrigatório antes de publicar normas         | Detalhes → Em linguagem simples; teste editorial                   |
| 1.7 | Pesquisa por legislação e assunto                     | Busca textual sem distinção de acentos e filtros combinados               | Pesquisar assunto; teste de busca e filtros                        |
| 1.8 | Histórico de mudanças legislativas                    | Linha do tempo legislativa com data, descrição e fonte                    | Detalhes → Mudanças na norma                                       |
| 1.9 | Sistema de fontes verificadas                         | Fonte original, data e responsável humano identificados                   | Detalhes → Fonte e responsabilidade editorial; teste de publicação |

Arquivos principais: `src/modules/catalog.js`, `server/domain.js`.

## Módulo 2

| ID   | Funcionalidade do PDF                     | Implementação                                                                  | Como conferir                                        |
| ---- | ----------------------------------------- | ------------------------------------------------------------------------------ | ---------------------------------------------------- |
| 2.1  | Mapa interativo de instituições de ensino | Mapa Leaflet com marcadores e popups vinculados aos perfis                     | Radar → Abrir mapa interativo                        |
| 2.2  | Localizador de escolas próximas           | Busca por município, referência aproximada pela base e geolocalização opcional | Radar → Município / centro das escolas               |
| 2.3  | Filtro por município e região             | Filtros por município e UF                                                     | Radar → filtros territoriais                         |
| 2.4  | Cadastro automatizado de instituições     | Cadastro em lote por fluxo dos estabelecimentos RFB, com agendamento           | Importações → CNPJ; CLI e teste RFB                  |
| 2.5  | Classificação por atividade educacional   | Filtro dos CNAEs de educação básica nas atividades principal e secundária      | Importador RFB; teste de CNAE e situação             |
| 2.6  | Cruzamento com o Censo Escolar            | Cruzamento exato por CNPJ/Inep e fila de divergências                          | Importador Censo; teste de cruzamento                |
| 2.7  | Perfil informativo das instituições       | Perfil com endereço, rede, contatos e procedência disponíveis                  | Radar → Ver detalhes                                 |
| 2.8  | Filtro por rede de ensino                 | Filtro municipal, estadual, federal e privado                                  | Radar → Rede de ensino; teste combinado              |
| 2.9  | Pesquisa por distância                    | Haversine para 5, 10, 25 e 50 km; ausência de coordenada não passa             | Radar → Distância; teste de distância                |
| 2.10 | Indicadores territoriais de instituições  | Distribuição por município/UF recalculada com filtros                          | Radar → indicadores acima do mapa                    |
| 2.11 | Lista de escolas favoritas                | Favoritos institucionais persistentes por conta                                | Salvar instituição → Meu Perfil; teste de isolamento |
| 2.12 | Acesso aos canais de candidatura          | Canal de candidatura exibido somente após conferência explícita                | Gestão → Instituição → canal verificado; detalhes    |

Arquivos principais: `src/modules/catalog.js`, `server/modules/imports.js`.

## Módulo 3

| ID   | Funcionalidade do PDF                         | Implementação                                                                        | Como conferir                                            |
| ---- | --------------------------------------------- | ------------------------------------------------------------------------------------ | -------------------------------------------------------- |
| 3.1  | Buscador de concursos públicos                | Busca e catálogo de concursos públicos                                               | Oportunidades → Concurso público                         |
| 3.2  | Buscador de processos seletivos simplificados | Busca de contratações temporárias e processos simplificados                          | Oportunidades → Processo simplificado                    |
| 3.3  | Monitor de seleções de instituições privadas  | Seleções privadas com fontes; cadastro e importação periódica de fontes normalizadas | Oportunidades → Seleção privada; manifesto de importação |
| 3.4  | Central de cadastros de reserva               | Categoria própria de cadastro de reserva                                             | Oportunidades → Cadastro de reserva                      |
| 3.5  | Filtro por disciplina                         | Filtro por componente curricular                                                     | Oportunidades → Disciplina                               |
| 3.6  | Filtro por nível de ensino                    | Filtro por etapa de ensino                                                           | Oportunidades → Nível de ensino                          |
| 3.7  | Filtro por escolaridade exigida               | Filtro por formação exigida                                                          | Oportunidades → Escolaridade exigida                     |
| 3.8  | Consulta à remuneração                        | Valor remuneratório e jornada, quando cadastrados no edital                          | Cards e detalhes de oportunidade                         |
| 3.9  | Calendário de inscrições e prazos             | Calendário mensal de abertura, fechamento e prova; exportação ICS                    | Oportunidades → Calendário / Exportar                    |
| 3.10 | Alertas personalizados de oportunidades       | Alertas internos por disciplina, formação, nível, território e raio                  | Publicar edital → Meus Alertas; teste de compatibilidade |
| 3.11 | Página detalhada de cada edital               | Página com cargo, município, remuneração, requisitos, documentos e prazos            | Oportunidades → Ver detalhes                             |
| 3.12 | Link direto para o edital oficial             | Links externos seguros para edital e inscrição oficiais                              | Detalhes → Edital oficial / Página de inscrição          |
| 3.13 | Lista de oportunidades salvas                 | Editais salvos por conta                                                             | Salvar edital → Meu Perfil; teste de favoritos           |
| 3.14 | Acompanhamento de situação dos editais        | Situação calculada no fuso de São Paulo, com controle de suspensão/andamento         | Filtro Situação e Gestão → estágio; teste de datas       |

Arquivos principais: `src/modules/catalog.js`, `server/domain.js`.

## Módulo 4

| ID   | Funcionalidade do PDF                         | Implementação                                                           | Como conferir                                              |
| ---- | --------------------------------------------- | ----------------------------------------------------------------------- | ---------------------------------------------------------- |
| 4.1  | Canal de manifestação dos professores         | Formulário de relato de experiência                                     | Voz do Professor → Compartilhar relato                     |
| 4.2  | Relatos anônimos sobre condições de trabalho  | Relatos sem vínculo com usuário e com comprovante de retirada           | Teste de anonimato e relato criptografado                  |
| 4.3  | Enquetes periódicas                           | Gerenciamento e coleta de enquetes com encerramento opcional            | Voz → Enquete; Gestão → Pesquisas                          |
| 4.4  | Pesquisa sobre jornada de trabalho            | Instrumento de jornada com perguntas por categorias                     | Voz → pesquisa de Jornada                                  |
| 4.5  | Pesquisa sobre vínculos empregatícios         | Instrumento de vínculo profissional                                     | Voz → pesquisa de Vínculos                                 |
| 4.6  | Pesquisa sobre remuneração docente            | Instrumento sobre percepção da remuneração                              | Voz → pesquisa de Remuneração                              |
| 4.7  | Pesquisa sobre infraestrutura escolar         | Instrumento sobre condições materiais da escola                         | Voz → pesquisa de Infraestrutura                           |
| 4.8  | Pesquisa sobre materiais didáticos            | Instrumento sobre escolha e adaptação de materiais                      | Voz → pesquisa de Materiais didáticos                      |
| 4.9  | Pesquisa sobre uso de inteligência artificial | Instrumento sobre IA e autonomia                                        | Voz → pesquisa de Inteligência artificial                  |
| 4.10 | Painel coletivo de resultados                 | Painel público com contagens protegidas e gráficos de barras            | Painel coletivo; testes de agregação                       |
| 4.11 | Relatórios públicos de condições de trabalho  | Relatórios públicos de pesquisas e temas de relatos revisados           | Painel coletivo → CSV / JSON / Relatório-PDF               |
| 4.12 | Visualização de resultados por território     | Recortes por território somente quando seguros; supressão complementar  | Resultados territoriais; teste contra subtração de células |
| 4.13 | Sugestões de melhorias para a plataforma      | Formulário de sugestões e leitura administrativa                        | Voz → Sugerir melhorias; Gestão → Escuta                   |
| 4.14 | Proteção e anonimização dos dados             | Coleta mínima, consentimento, AES-GCM, comprovante por hash e supressão | Transparência; testes de criptografia e retirada           |

Arquivos principais: `src/modules/voice.js`, `server/modules/research.js`.

## Módulo 5

| ID  | Funcionalidade do PDF               | Implementação                                                                   | Como conferir                                         |
| --- | ----------------------------------- | ------------------------------------------------------------------------------- | ----------------------------------------------------- |
| 5.1 | Cadastro gratuito do professor      | Cadastro opcional com informações públicas abertas                              | Meu Perfil → Criar conta; testes HTTP                 |
| 5.2 | Perfil profissional                 | Perfil com município, disciplina, formação e níveis                             | Meu Perfil → Perfil profissional                      |
| 5.3 | Configuração da região de interesse | Cidades adicionais e referência/raio de interesse                               | Meu Perfil → Região e raio                            |
| 5.4 | Central de notificações             | Central de avisos e marcação individual ou coletiva como lido                   | Meus Alertas; teste de isolamento                     |
| 5.5 | Preferências de alertas             | Preferências para oportunidades, normas e notícias                              | Meu Perfil → Preferências de alertas                  |
| 5.6 | Central de favoritos                | Central que reúne escolas, editais, pesquisas e publicações salvas              | Meu Perfil → Seus favoritos                           |
| 5.7 | Controle de privacidade             | Exportar, corrigir, solicitar atendimento, excluir conta e retirar participação | Privacidade e controle; testes de exclusão/exportação |

Arquivos principais: `src/modules/profile.js`, `server/modules/accounts.js`.

## Módulo 6

| ID   | Funcionalidade do PDF                    | Implementação                                                                         | Como conferir                                 |
| ---- | ---------------------------------------- | ------------------------------------------------------------------------------------- | --------------------------------------------- |
| 6.1  | Painel administrativo                    | Painel protegido por papel administrativo no servidor                                 | Gestão; teste de acesso negado a professor    |
| 6.2  | Gerenciador de notícias e legislação     | Criação, edição, rascunho, revisão, publicação e arquivamento                         | Gestão → Notícias e direitos; teste editorial |
| 6.3  | Sistema de validação humana              | Declaração explícita, curador identificado e bloqueio sem fonte/resumo                | Gestão → Revisar; testes de validação         |
| 6.4  | Gerenciador de concursos e seleções      | Formulário completo de editais, fontes, prazos e situação                             | Gestão → Editais                              |
| 6.5  | Sistema de atualização de bases públicas | Importações de CNPJ/CNAE/Censo, arquivo normalizado, agendador e histórico            | Gestão → Importações; CLI e testes            |
| 6.6  | Verificador de qualidade dos dados       | Detecção de duplicidades, fontes antigas, coordenadas faltantes e conflitos           | Gestão → Qualidade; testes de importação      |
| 6.7  | Gerenciador de enquetes e pesquisas      | Criação de instrumentos, publicação, encerramento e proteção de perguntas respondidas | Gestão → Pesquisas; teste de imutabilidade    |
| 6.8  | Painel estatístico administrativo        | Contas, acervo, respostas, estados da moderação, importações e acessos agregados      | Gestão → Indicadores                          |
| 6.9  | Exportador de relatórios                 | CSV/JSON agregado, impressão/PDF e exportação de apontamentos de qualidade            | Resultados → exportações; Gestão → Qualidade  |
| 6.10 | Histórico de revisões e fontes           | Registro de revisões, fontes, autoria, publicação e ações administrativas             | Gestão → Histórico; teste de revisão pública  |

Arquivos principais: `src/modules/admin.js`, `server/modules/admin.js`.

## Adições solicitadas na conversa

- Tema claro/escuro persistente no dispositivo.
- Preservação do logo, cores, cards arredondados e grade adaptativa.
- Código separado por módulos, persistência SQLite e testes.
- Repositório privado `anddrad3/voz-do-professor` e workflow de verificação.

O arquivo `requisitos.json` mantém a matriz legível por ferramentas; um teste verifica a presença exata dos 66 identificadores.
