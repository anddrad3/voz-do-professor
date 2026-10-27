# Voz do Professor

Site publicado: [Voz do Professor](https://amerindia.alwaysdata.net/voz-do-professor/).

Plataforma de informação docente com cards adaptativos, temas claro/escuro, catálogo público e administração privada. Versão 3: **sem contas de visitantes, sem upload e sem coleta de relatos ou respostas no servidor**.

## Rodar

Node.js 24+. `npm ci`, `npm run build`, `npm run dev`. Abra http://127.0.0.1:5173. O ambiente de desenvolvimento usa `data/demo-v2.sqlite` e exemplos identificados; fontes automáticas também podem trazer dados reais. `AUTO_SYNC=false` desativa conexões às fontes durante testes offline.

## O que fica no navegador

Preferências, região, favoritos e alertas lidos ficam no localStorage, com fallback em memória se estiver bloqueado. Na navegação normal não são enviados ao servidor. Ao solicitar uma consulta de IA, apenas os filtros informados e o assunto são enviados ao servidor e ao Google mediante consentimento. Busca local, filtros e comparação de alertas são processados no navegador. Geolocalização só é solicitada depois de um clique e suas coordenadas ficam no aparelho. Não há envio de e-mail, SMS ou push. Limpar o navegador perde essas preferências. Usuários do mesmo perfil de navegador podem vê-las.

## Participação por PDF

Na área Voz do Professor há um PDF AcroForm preenchível: relato, sugestão, remoção/correção ou outros pedidos. Nome opcional, anonimato na publicação e autorização específica para publicar relato. O participante salva o documento localmente e envia pelo próprio e-mail; **o site não recebe o arquivo**. O remetente continuará visível ao administrador/provedor de e-mail.

O formulário informa **vozdoprofessoroficial@gmail.com**. Para trocar esse endereço, altere `REPORT_EMAIL` e gere o formulário novamente com `scripts/generate-forms.py --email endereco@dominio`. Isso é uma configuração inicial, não uma etapa por relato. Veja [formulário offline](docs/formulario-offline.md).

## Painel exclusivo do proprietário

**Acesso pelo celular ou computador:** https://amerindia.alwaysdata.net/voz-do-professor/painel. Não há botão administrativo no site público nem cadastro de visitantes. Não é necessário manter o computador ligado ou executar um túnel SSH.

O login do proprietário exige senha e um código do autenticador (TOTP, seis dígitos, 30 segundos). Há dez códigos de recuperação de uso único, que substituem o código do autenticador; a senha continua obrigatória. A configuração inicial e os códigos ficam em arquivos privados, fora do Git e do diretório público. Consulte [operação](docs/operacao.md).

O painel permite adicionar/revisar/publicar/retirar/excluir relatos, corrigir registros, acompanhar sincronizações e habilitar/desabilitar ferramentas, individualmente ou todas. A autenticação usa hash scrypt, cookies Secure/HttpOnly/SameSite Strict, CSRF, verificação de origem e limite persistente de tentativas. O segundo fator impede reutilização de códigos aceitos. Relatos recebidos por e-mail e contatos não devem ser copiados para o cadastro: publique somente o texto autorizado.

O modo local continua disponível para desenvolvimento quando `ADMIN_WEB_ENABLED=false`. A implantação online usa `ADMIN_WEB_ENABLED=true`, `ADMIN_HTTPS=true` e origem HTTPS explícita; ela recusa iniciar sem segundo fator provisionado. Não exponha a porta local de administração no proxy.

## Versão 3: catálogo diário e consultas com fontes

Às 08h (America/Sao_Paulo), o servidor seleciona até 20 notícias ainda não resumidas: Franca e região, São Paulo, Brasil e internacional. Uma chamada Gemini 3.5 Flash-Lite resume o lote junto com até três referências de legislação e três comunicados de concursos. Há menos publicações quando as fontes não oferecem material verificável. Fonte, link, data e uso de IA são identificados. O processo não usa busca Google nem publica respostas de grounding no catálogo.

A geração gratuita do catálogo foi validada com fontes e Gemini reais. A busca Google exige plano pago nesta conta nova. O código agora suporta ativação pré-paga verificada, consultas guiadas e orçamento de teste acumulado de US$ 4,50. O estado efetivo da ativação aparece no painel; não confundir implementação com faturamento já habilitado. Os chats só ficam disponíveis com a configuração confirmada.

Fontes: Agência Brasil/EBC, GOV.UK, Agência SP, Unidade Regional de Ensino de Franca, ALEAC, IFSP e IFRS. As fontes regionais podem falhar; são registradas no painel sem contornar restrições ou certificados inválidos. A cobertura é parcial, inclusive para leis e concursos. Textos oficiais e editais devem ser conferidos na origem. O Radar conserva filtros e localização, mas a coleta CNPJ foi removida.

O painel inclui exclusão definitiva de relatos e histórico dos marcos reais do Git. Preferências e consultas salvas permanecem locais. O PDF envia instruções para **vozdoprofessoroficial@gmail.com**; não há upload nem envio automático.

[Arquitetura e limitações da IA](docs/ia.md). [Histórico das fontes anteriores](docs/automacao.md).

## Publicação sem cobrança

Preparado para Node 24 + SQLite no Alwaysdata Free. O plano gratuito atualmente tem 1 GB de disco e 256 MB de RAM, é para uso não lucrativo e restringe endereços ao subdomínio alwaysdata.net da conta. A hospedagem continua gratuita; a API Gemini é um serviço separado e pode ter cobrança quando ativada em modo pago autorizado. Esses limites exigem catálogo e sincronização limitados. O fornecedor pode alterar regras; não há garantia técnica de gratuidade eterna ou disponibilidade 100%.

O código usa um único processo Node para público e painel administrativo. `PORT`/`HOST` devem seguir o proxy; `ADMIN_PORT` fica em loopback. `BASE_PATH` e `VITE_BASE_PATH` permitem hospedar em subpasta sem substituir outro site. Detalhes em [Operação](docs/operacao.md).

## Validação e módulos

`npm run check`, `npm test`, `npm run build`, `npm audit --omit=dev`.

- `src/`: interface pública e painel com entradas separadas.
- `shared/`: filtros e configuração de ferramentas.
- `server/app.js`: catálogo público somente leitura e rotas administrativas autenticadas.
- `server/modules/automation.js`: integrações permitidas, limites e cache de catálogo.
- `server/modules/daily-ai.js`: seleção diária; `gemini.js`: provedor e limites; `regional-news.js`: prioridade editorial.
- `public/formularios/`: PDF que não envia dados ao site.

Bancos antigos da versão 1 não são migrados nem publicados automaticamente. O banco padrão novo é `data/public-v2.sqlite`; arquivos de teste/desenvolvimento ficam ignorados no Git. Font Awesome Free (ícones gratuitos) é compilado localmente; grade/lista e tema são preferências do navegador.

Relatos publicados e credenciais administrativas continuam sendo dados do servidor. Sem login público não significa invulnerabilidade; configure também logs/retenção na hospedagem.
