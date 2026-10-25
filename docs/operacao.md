# Operação versão2

## Configuração

Copie `.env.example` para `.env`. Configure `DATABASE_PATH=data/public-v2.sqlite`, `DEMO_MODE=false`, `NODE_ENV=production`. Não reutilize bancos demo ou da versão1. O serviço público recebe somente GET/HEAD/OPTIONS. Nunca coloque `.env`, bancos, backups ou credenciais no diretório estático `dist/`.

O painel usa `ADMIN_PORT=3002`, sempre127.0.0.1. Crie a senha uma vez com `npm run admin` no servidor e guarde em gerenciador. Não existe criação de conta pelo site nem segunda conta via comando.

Para abrir de outro computador:

```sh
ssh -N -L 3002:127.0.0.1:3002 usuario@ssh-usuario.alwaysdata.net
```

Depois abra http://127.0.0.1:3002. Se usar chave, acrescente `-i caminho-da-chave`. `ADMIN_ORIGIN` deve coincidir com essa origem local. O cookie é HttpOnly e SameSite Strict; a conexão remota é protegida pelo túnel SSH. Não publique a porta do painel. `ADMIN_ENABLED=false` desativa a escuta administrativa.

## Alwaysdata Free

Publicação verificada em 25/10/2026: https://amerindia.alwaysdata.net/voz-do-professor/, conta `amerindia`, plano Free. Serviço público Node.js 24, diretório `apps/voz-do-professor/current`, comando `node --max-old-space-size=96 server/index.js`. O site Ameríndia permanece em seu serviço separado. Dados privados em `apps/voz-do-professor/shared`.

Nesta implantação, o painel usa **socket Unix privado**, sem porta administrativa de rede. O Alwaysdata executa SSH e HTTP em servidores distintos, portanto o túnel convencional para localhost não funciona. O cliente `scripts/admin-bridge.mjs` encaminha somente rotas administrativas permitidas pela conexão SSH já autorizada e pela pasta privada `shared/admin-bridge` (0700; arquivos 0600). Somente o processo HTTP acessa o banco. Senha, CSRF, origem e limite de tentativas continuam obrigatórios. Pedidos/respostas transitórios são removidos ao terminar ou expirar; uma falha de armazenamento pode atrasar a limpeza até a próxima execução. Não são registrados em logs. Um comprometimento da conta de hospedagem pode expor dados administrativos transitórios.

No computador do proprietário, dê dois cliques em `tmp/Abrir-painel.cmd`, mantenha a janela aberta e entre em `http://127.0.0.1:3002/voz-do-professor/`. A senha está em `tmp/ACESSO-PAINEL.txt`, fora do Git. O primeiro carregamento pode levar alguns segundos devido ao armazenamento compartilhado. Clique em Sair e feche a janela ao terminar. São necessários Node.js 24, SSH e a chave já instalada neste computador. Não compartilhe a senha ou a chave.

Equivalente por terminal: `node scripts/admin-bridge.mjs usuario@ssh-host caminho-da-chave caminho-known_hosts`. A origem/Host local são restritos a `127.0.0.1:3002`; o cliente rejeita requisições de outras origens e encerra ao perder SSH. A chave do servidor é validada; não desative essa verificação. `ADMIN_BRIDGE_DIR` habilita a ponte no servidor; vazio mantém o modo loopback para desenvolvimento. Não coloque essa pasta dentro de `dist`.

Foi criado o agendamento Alwaysdata **36421**, ativo, para acessar `/voz-do-professor/api/health` uma vez por hora. Ele inicia o processo após suspensão por inatividade. A aplicação continua respeitando os intervalos próprios das fontes (notícias/vagas 6h; legislação/CNPJ 24h), sem exigir visitas ou o computador do proprietário ligado. A execução pode ocorrer na próxima verificação horária após vencer o intervalo, e depende da disponibilidade das fontes. Nenhum serviço pago foi contratado.

Use exclusivamente uma conta cujo plano atual é **Free**, sem período promocional Plus e sem alterar assinatura. Endereço permitido é o `alwaysdata.net` da conta; pode usar uma rota de subpasta separada se a conta já hospeda outro site. Configure Node.js24 e comando `node server/index.js`, diretório próprio, sem substituir arquivos/configuração do outro projeto.

Para subpasta `/voz-do-professor/`: compile com `VITE_BASE_PATH=/voz-do-professor/` e configure `BASE_PATH=/voz-do-professor`. O servidor remove esse prefixo para servir API/arquivos. Proxy deve encaminhar só esse endereço à porta do serviço. `HOST` e `PORT` seguem variáveis/endereço fornecidos pelo Alwaysdata. Banco em diretório privado fora do release.

Construir localmente e instalar apenas dependências de produção reduz RAM/disco. Sem Docker no Alwaysdata. Rotinas de rede são limitadas; se necessário desative GDELT alterando código/fonte, sem contratar recursos extras. O processo não contém código para upgrades, compras ou cobrança. O fornecedor pode suspender um site que exceda limites; não conte com 100% de disponibilidade.

Confirme termos atuais: https://help.alwaysdata.com/en/admin-billing/billing/public-cloud-prices/ (1GB/256MB, sem fins lucrativos, domínio da conta). A condição “gratuito para sempre” não pode ser garantida contra futuras mudanças do fornecedor.

## E-mail e formulário

Defina `REPORT_EMAIL` e regenere o PDF com o mesmo e-mail. O placeholder `.invalid` é não funcional. Não automatize o envio nem solicite o endereço do participante no site. Após receber autorização por e-mail, copie só o texto público no painel e escolha anonimato. Remoção/correção também é recebida por PDF/e-mail, e executada no painel por “Retirar do site”.

## Dados, backup e privacidade

O novo banco só guarda publicações públicas, revisões, configurações, estado de importações, hash da senha e sessões administrativas. Não há tabelas de visitantes, respostas, favoritos, IP ou métricas de navegação. A hospedagem/proxy podem manter access logs próprios: configure a retenção mínima disponível e não adicione analytics. A caixa postal do responsável é um serviço separado e contém os e-mails recebidos.

`npm run backup` faz backup consistente do banco configurado. Proteja backups e não os publique. Backups anteriores da versão1 continuam sob responsabilidade do operador; não são copiados para a implantação nova. O código não apaga dados anteriores sem procedimento explícito.

Relatos retirados são arquivados reversivelmente e saem do catálogo; revisões do relato podem continuar no banco privado. Se houver pedido de eliminação definitiva, avalie a necessidade de excluir também revisões e backups, sem prometer apagamento da caixa de e-mail/provedores que a aplicação não controla.
