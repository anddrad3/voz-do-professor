# Operação versão2

## Configuração

Copie `.env.example` para `.env`. Configure `DATABASE_PATH=data/public-v2.sqlite`, `DEMO_MODE=false`, `NODE_ENV=production`. Não reutilize bancos demo ou da versão1. As rotas de visitantes recebem somente GET/HEAD/OPTIONS; a escrita fica restrita às rotas autenticadas do proprietário. Nunca coloque `.env`, bancos, backups ou credenciais no diretório estático `dist/`.

## Painel web com segundo fator

Endereço: https://amerindia.alwaysdata.net/voz-do-professor/painel. Funciona no navegador do celular e do computador, sem atalho local, aplicativo pago ou computador ligado. O endereço não aparece no site público. Apenas conhecer a URL não concede acesso.

Na primeira configuração, crie a conta única com `npm run admin` (não repita na instalação existente). Provisione TOTP com `node scripts/admin-2fa.mjs /caminho/privado/segundo-fator.json`. O JSON é criado com permissão 0600 e contém a chave, URI otpauth e dez códigos de recuperação. Nunca coloque esse arquivo em `dist`, Git, logs ou URL. Cadastre a chave como TOTP no seu autenticador; os parâmetros são SHA-1, seis dígitos, 30 segundos, conforme [RFC 6238](https://www.rfc-editor.org/rfc/rfc6238). Guarde os códigos de recuperação separados do celular. Eles são de uso único e não dispensam a senha.

Configure `ADMIN_WEB_ENABLED=true`, `ADMIN_HTTPS=true`, `ADMIN_ORIGIN=https://amerindia.alwaysdata.net`, `BASE_PATH=/voz-do-professor`. O build usa `VITE_BASE_PATH=/voz-do-professor/`. A implantação recusa ativar o painel web sem origem HTTPS e segundo fator. Ative redirecionamento HTTPS no proxy. Não confie em cabeçalhos X-Forwarded-For recebidos do cliente. Seis tentativas de login por quinze minutos são controladas no banco para a conta única; reinícios e cabeçalhos forjados não zeram o limite. Um ataque pode temporariamente bloquear novos logins até expirar a janela.

No Alwaysdata, SSH e HTTP estão em máquinas diferentes. Para provisionar no processo que já administra SQLite, use temporariamente `ADMIN_2FA_SETUP_FILE=/home/amerindia/apps/voz-do-professor/shared/segundo-fator.json` no primeiro início. O programa só provisiona se não houver fator; não substitui arquivos ou credenciais existentes e encerra sessões antigas. Depois de copiar o arquivo por SSH para local privado e configurar o autenticador, remova essa variável. A chave fica no banco privado porque é necessária para validar TOTP; códigos de recuperação ficam apenas como hashes no banco. Proteja também os backups.

A senha existente permanece em `tmp/ACESSO-PAINEL.txt`. O guia local `tmp/ACESSO-PAINEL-WEB.txt` contém a chave de configuração e os códigos de recuperação. Esses arquivos não são publicados. Não é necessário executar o antigo `tmp/Abrir-painel.cmd`. A ponte SSH pode ser desativada com `ADMIN_ENABLED=false` e `ADMIN_BRIDGE_DIR=`; essas variáveis controlam o serviço local, enquanto `ADMIN_WEB_ENABLED` controla o painel HTTPS.

O login dura no máximo oito horas. Clique em Sair ao terminar. Se perder o autenticador, use um código de recuperação com a senha. Se perder também os códigos, a recuperação exige acesso à hospedagem: revogar sessões, remover somente as entradas de fatores/recuperação da conta e provisionar uma nova chave. Não existe recuperação pública por e-mail nem bypass sem segundo fator.

## Alwaysdata Free

Serviço Node.js 24, diretório `apps/voz-do-professor/current`, comando `node --max-old-space-size=96 server/index.js`. Ameríndia permanece em seu serviço separado. Banco e configurações privadas ficam fora de `dist`, em `apps/voz-do-professor/shared`. O painel usa o mesmo processo e plano existentes; nenhum novo serviço pago é necessário.

Foi criado o agendamento Alwaysdata **36421**, ativo, para acessar `/voz-do-professor/api/health` uma vez por hora. Ele inicia o processo após suspensão por inatividade. A aplicação continua respeitando os intervalos próprios das fontes (notícias/vagas 6h; legislação/CNPJ 24h), sem exigir visitas ou o computador do proprietário ligado. A execução pode ocorrer na próxima verificação horária após vencer o intervalo, e depende da disponibilidade das fontes. Nenhum serviço pago foi contratado.

Use exclusivamente uma conta cujo plano atual é **Free**, sem período promocional Plus e sem alterar assinatura. Endereço permitido é o `alwaysdata.net` da conta; pode usar uma rota de subpasta separada se a conta já hospeda outro site. Configure Node.js24 e comando `node server/index.js`, diretório próprio, sem substituir arquivos/configuração do outro projeto.

Para subpasta `/voz-do-professor/`: compile com `VITE_BASE_PATH=/voz-do-professor/` e configure `BASE_PATH=/voz-do-professor`. O servidor remove esse prefixo para servir API/arquivos. Proxy deve encaminhar só esse endereço à porta do serviço. `HOST` e `PORT` seguem variáveis/endereço fornecidos pelo Alwaysdata. Banco em diretório privado fora do release.

Construir localmente e instalar apenas dependências de produção reduz RAM/disco. Sem Docker no Alwaysdata. Rotinas de rede são limitadas; se necessário desative GDELT alterando código/fonte, sem contratar recursos extras. O processo não contém código para upgrades, compras ou cobrança. O fornecedor pode suspender um site que exceda limites; não conte com 100% de disponibilidade.

Confirme termos atuais: https://help.alwaysdata.com/en/admin-billing/billing/public-cloud-prices/ (1GB/256MB, sem fins lucrativos, domínio da conta). A condição “gratuito para sempre” não pode ser garantida contra futuras mudanças do fornecedor.

## E-mail e formulário

Defina `REPORT_EMAIL` e regenere o PDF com o mesmo e-mail. O placeholder `.invalid` é não funcional. Não automatize o envio nem solicite o endereço do participante no site. Após receber autorização por e-mail, copie só o texto público no painel e escolha anonimato. Remoção/correção também é recebida por PDF/e-mail, e executada no painel por “Retirar do site”.

## Dados, backup e privacidade

O novo banco só guarda publicações públicas, revisões, configurações, estado de importações, hash da senha, chave TOTP, hashes de recuperação, limite de tentativas e sessões administrativas. Não há tabelas de visitantes, respostas, favoritos, IP ou métricas de navegação. A hospedagem/proxy podem manter access logs próprios: configure a retenção mínima disponível e não adicione analytics. A caixa postal do responsável é um serviço separado e contém os e-mails recebidos.

`npm run backup` faz backup consistente do banco configurado. Proteja backups e não os publique. Backups anteriores da versão1 continuam sob responsabilidade do operador; não são copiados para a implantação nova. O código não apaga dados anteriores sem procedimento explícito.

Relatos retirados são arquivados reversivelmente e saem do catálogo; revisões do relato podem continuar no banco privado. Se houver pedido de eliminação definitiva, avalie a necessidade de excluir também revisões e backups, sem prometer apagamento da caixa de e-mail/provedores que a aplicação não controla.
