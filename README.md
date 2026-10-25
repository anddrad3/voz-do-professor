# Voz do Professor

Plataforma de informação, autonomia e valorização docente. Reúne direitos e notícias, radar de escolas, oportunidades, escuta, pesquisas, alertas, perfil e administração.

O projeto mantém a identidade do protótipo: fundo escuro, vermelho de destaque, cards arredondados e grade adaptativa de uma, duas ou três colunas. Inclui modo claro com preferência persistente, navegação por teclado e leitura em voz alta conforme suporte do navegador.

## Executar no computador

Requer **Node.js 24 ou superior**. Não precisa de serviço externo de banco de dados.

```sh
npm ci
npm run dev
```

Abra **http://127.0.0.1:5173**. O servidor de API roda na porta 3001. O ambiente de desenvolvimento usa `data/demo.sqlite`, com exemplos claramente identificados. São exemplos fictícios de escolas e seleções; não representam vagas ou notícias reais. As pesquisas demonstrativas coletam somente dados para teste.

Para criar o primeiro administrador do ambiente de desenvolvimento:

```powershell
$env:DATABASE_PATH = 'data/demo.sqlite'
npm run admin
```

No Linux/macOS, use `DATABASE_PATH=data/demo.sqlite npm run admin`. Informe seu e-mail e seu nome público de curadoria. O comando gera uma senha aleatória e a mostra uma única vez. Nenhuma senha administrativa acompanha o repositório. Acesse **Meu Perfil** com essa conta; a opção **Gestão** aparecerá no menu.

## Módulos

| Área                | Recursos                                                                                                                            |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Direitos e Notícias | Notícias, biblioteca normativa, piso salarial, carreira municipal, conselhos, explicadores, busca, histórico e fontes com curadoria |
| Radar de Escolas    | Mapa, filtros por cidade/UF/rede/raio, perfil institucional, indicadores, favoritos e recrutamento verificado                       |
| Oportunidades       | Concursos, temporários, seleções privadas, reserva, filtros profissionais, remuneração, calendário, ICS, edital e alertas           |
| Voz do Professor    | Relatos anônimos, sugestões, enquetes, seis temas de pesquisa, painel coletivo e relatórios protegidos                              |
| Conta               | Cadastro gratuito opcional, perfil, região, preferências, notificações, favoritos, exportação e exclusão de dados                   |
| Gestão              | Rascunhos, revisão humana, publicação, arquivamento reversível, importações, qualidade, pesquisas, métricas e histórico             |

A [matriz de requisitos](docs/requisitos.md) relaciona **cada um dos 66 itens do PDF** à implementação e à forma de conferência.

## Organização do código

```text
src/
  app.js                  navegação, sessão, tema e ações comuns
  api.js                  comunicação com a API e estado de interface
  ui.js                   componentes e escape de conteúdo
  styles.css              identidade visual e responsividade
  modules/                catálogo, escuta, perfil, gestão e transparência
server/
  app.js                  API HTTP e proteção de requisições
  db.js                   esquema SQLite e consultas comuns
  domain.js               validações e regras de negócio
  security.js             senhas, sessões, CSRF e criptografia
  modules/                contas, pesquisas, gestão e importações
scripts/                  execução, administrador, importação, backup e checks
tests/                    testes de domínio e integração HTTP
docs/                     requisitos, operação, fontes e protótipo preservado
.github/workflows/ci.yml   validação em cada push e pull request
```

O protótipo original está preservado em `docs/prototipo-original.html`. Seus antigos dados fictícios não são publicados como informações verificadas.

## Testar e construir

```sh
npm run check
npm test
npm run build
npm audit
```

Os testes usam bancos em memória e contas fictícias. Conferem permissões, CSRF, sessão, isolamento de favoritos e notificações, revisão humana, filtros, alertas, importação, criptografia, supressão estatística e exclusão por comprovante. A interface é compilada para `dist/`, servida pelo mesmo processo da API em produção.

## Publicação em servidor

O GitHub guarda o código. **GitHub Pages sozinho não executa este sistema**, pois contas, SQLite, importações e pesquisas precisam do servidor Node.js.

1. Execute `npm ci` e `npm run build`.
2. Copie `.env.example` para `.env` e configure a URL HTTPS, o contato de privacidade e uma chave de criptografia de 32 bytes. Use um banco novo, separado da demonstração.
3. Crie o administrador com `npm run admin` apontando para o mesmo banco de produção.
4. Execute `npm start` atrás de um proxy HTTPS e mantenha `data/` em volume persistente.
5. Importe as bases oficiais e publique somente os registros conferidos por uma pessoa responsável.

Há um `Dockerfile` para essa execução. Instruções de configuração, backup, restauração e operação estão em [Operação](docs/operacao.md).

## Dados reais e limites operacionais

As funcionalidades estão implementadas, mas a instalação não vem com o cadastro nacional de escolas nem com uma redação que valide notícias e editais automaticamente. O importador aceita arquivos da Receita, Censo e CSVs normalizados; o agendador reprocessa as fontes locais configuradas. Downloads nacionais, adequação ao leiaute da edição utilizada e conferência editorial são responsabilidades operacionais descritas em [Importações](docs/importacoes.md).

Alertas são entregues na central interna da plataforma. Não há envio de e-mail, SMS ou WhatsApp. Mapa depende do OpenStreetMap; leitura em voz alta depende das vozes do navegador. Relatórios podem ser baixados em CSV/JSON e impressos ou salvos como PDF pelo navegador.

Antes de abrir ao público, configure o responsável pelo tratamento de dados, retenção e contato; carregue fontes reais e valide o fluxo com professores. As proteções técnicas não substituem a governança de uma pesquisa ou uma avaliação jurídica de conformidade.
