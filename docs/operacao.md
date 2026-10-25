# Operação e implantação

## Configuração

O processo lê `.env` se existir, sem sobrescrever variáveis já fornecidas pelo ambiente. Não envie `.env`, banco, backups ou senhas ao GitHub.

| Variável                | Uso                                                                   |
| ----------------------- | --------------------------------------------------------------------- |
| `NODE_ENV`              | `production` ativa cookie Secure, HSTS e chave obrigatória            |
| `PORT`, `HOST`          | Porta 3001 e endereço de escuta; use 0.0.0.0 em contêiner             |
| `APP_ORIGIN`            | Origem HTTPS exata, sem barra final, usada para verificar requisições |
| `DATABASE_PATH`         | Caminho SQLite persistente; padrão `data/voz.sqlite`                  |
| `DATA_ENCRYPTION_KEY`   | 64 caracteres hexadecimais, obrigatórios em produção                  |
| `PRIVACY_CONTACT`       | Identificação e contato público do responsável por privacidade        |
| `DEMO_MODE`             | `false` em produção; demonstração é mantida em banco separado         |
| `IMPORT_MANIFEST`       | Manifesto de arquivos locais a importar periodicamente                |
| `IMPORT_INTERVAL_HOURS` | Intervalo entre execuções; padrão 24 horas                            |

Gere a chave uma vez, em um terminal privado:

```sh
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Guarde-a no gerenciador de segredos do servidor. Trocar a chave sem migrar os textos impede a leitura dos relatos existentes. Em desenvolvimento, uma chave local é criada e guardada no banco; essa opção não é aceita em produção. Um banco marcado pela carga demonstrativa também é rejeitado na inicialização de produção.

## Docker e HTTPS

```sh
docker build -t voz-do-professor .
docker run -d --name voz-do-professor --restart unless-stopped --env-file .env -p 127.0.0.1:3001:3001 -v voz-data:/app/data -v voz-backups:/app/backups voz-do-professor
docker exec -it voz-do-professor npm run admin
```

Configure um proxy como Caddy ou Nginx para encaminhar o seu domínio HTTPS a `127.0.0.1:3001`. `APP_ORIGIN` deve coincidir com esse domínio. Cookies de produção exigem HTTPS. O contêiner roda sem root. O volume precisa permitir escrita pelo usuário `node`.

Use uma instância por banco SQLite. Não compartilhe um arquivo SQLite entre réplicas em diferentes máquinas. Para crescimento horizontal, migre a persistência e sessões para um banco gerenciado antes de adicionar réplicas.

## Administração

1. `npm run admin` cria um responsável identificado e uma senha aleatória.
2. Faça login e abra **Gestão**.
3. Cadastre ou importe registros. Cada item entra em **Rascunho**.
4. Abra **Revisar**, confira fonte e conteúdo e marque a declaração de validação humana.
5. Publique. O servidor registra o nome do curador, data, revisão e fontes; alertas compatíveis são gerados.
6. Editar um registro publicado o retira da circulação até uma nova revisão. Arquivar não apaga o histórico.

Em escolas, confirme separadamente os canais de candidatura. Em pesquisas, defina finalidade e perguntas por categorias; perguntas não podem ser alteradas depois da primeira resposta. Crie uma nova pesquisa para mudar o instrumento.

Recuperação administrativa de senha é feita pelo operador no servidor, após verificar a identidade da pessoa. A plataforma não envia e-mail de recuperação. Para gerar um novo hash, use a função `passwordHash` de `server/security.js`, atualize somente a conta verificada e revogue suas sessões. Não armazene senhas em scripts ou histórico de comandos. Para promover uma conta existente, use um console local autorizado e parametrização SQL; não existe endpoint público que altera o papel de usuário.

## Backup e restauração

```sh
npm run backup
```

O comando usa a API de backup consistente do SQLite, inclusive com WAL ativo. Guarde uma cópia criptografada do arquivo gerado e da chave de criptografia em destinos separados. Faça restaurações de ensaio periodicamente.

Para restaurar: pare o servidor, preserve o banco atual em outro local, restaure o backup no caminho de `DATABASE_PATH`, confira permissões e a chave original e reinicie. Arquivos `-wal`/`-shm` antigos não devem ser reutilizados com um banco restaurado. Não copie apenas o arquivo SQLite de uma instância ativa como substituto do backup consistente.

Defina a política de retenção antes da abertura pública. Exemplo de parâmetro operacional: backups diários com retenção de 30 dias, descarte protegido e controle de acesso. Essa política **não é aplicada automaticamente** pelo aplicativo. Ao restaurar um backup antigo, reaplique exclusões solicitadas desde a data da cópia.

## Proteções e limites

- Senhas: scrypt com salt aleatório; sessões de 7 dias com token armazenado somente por hash, HttpOnly, SameSite e Secure em produção.
- Mutações autenticadas exigem CSRF; requisições com origem diferente são rejeitadas. A API valida campos e URLs e serve erros sem stack pública.
- Relatos livres: AES-256-GCM, acesso administrativo e sem publicação individual.
- Respostas: sem vínculo com usuário, e-mail, IP ou horário exato; somente mês, território informado e respostas por categorias. Comprovantes são armazenados como hash.
- O limite de requisições usa um hash temporário do endereço de conexão somente em memória. Atrás de um proxy, o limite é compartilhado pelos visitantes; configure limites por cliente no proxy e revise volumes antes de produção. Não confie em `X-Forwarded-For` enviado diretamente pelo público.
- Logs do aplicativo não registram corpos de requisições; configure proxy e infraestrutura para não guardar identificadores junto das pesquisas.
- Resultados com menos de 10 participantes são ocultados. Células positivas pequenas implicam supressão integral e complementar entre nacional e territórios. A coleta voluntária não é uma amostra representativa nem utiliza privacidade diferencial; novas versões de relatórios ainda exigem avaliação de risco de comparação temporal.
- Participações anônimas não podem ser deduplicadas por conta sem reduzir a anonimização. Há limitação de taxa e orientação de resposta única; não declare as respostas como pessoas únicas verificadas.
- Informações públicas ficam disponíveis sem conta. A conta é exigida somente para personalização e gestão.

## Verificações

`GET /api/health` confirma a conexão com SQLite. O painel de Gestão mostra importações, registros por situação e carregamentos de página sem identificação de visitante. O workflow de CI executa sintaxe, testes, build e auditoria de dependências de produção.

A versão inicial foi verificada com testes em bancos isolados e revisão de interface no navegador. Docker e publicação em um domínio de produção dependem de infraestrutura a configurar pelo operador; não confunda push do código com implantação do serviço.
