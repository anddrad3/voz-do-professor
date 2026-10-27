# IA, fontes e orçamento de teste — 27/10/2026

## Ativação

O proprietário autorizou a implementação paga após receber uma estimativa. A geração comum com Gemini 3.5 Flash-Lite já foi validada no plano gratuito. A busca Google dos modelos atuais exige plano pago nesta conta. O código permite ativá-la somente com `AI_BILLING_MODE=paid`, `GEMINI_PAID_TIER_CONFIRMED=true` e `AI_INTERACTIVE_ENABLED=true`, após verificar Prepay e recarga automática desligada. Ativação concluída em 27/10/2026 na conta principal. O usuário realizou pré-pagamento de R$ 150 (mínimo exibido na região); recarga automática conferida como desativada. Teto mensal do projeto no Google: R$ 25, sujeito a até dez minutos de atraso. Orçamento local acumulado permanece US$ 4,50. Consulta real com busca e fontes validada em produção.

A assinatura Google One Standard de armazenamento não inclui créditos de API. O cartão salvo não é autorização para recargas ou outros serviços.

## Catálogo diário

O Alwaysdata desperta o serviço nas horas cheias; o processo confere `America/Sao_Paulo` e inicia uma atualização após as 08h, uma única vez por data. O começo ocorre durante esse minuto; publicação termina após as consultas. Se o serviço estiver indisponível, tenta no próximo início. A marcação SQLite impede repetição após reinício ou falha. O botão administrativo respeita o mesmo limite.

São selecionadas **até 20 notícias inéditas**, com datas de até 30 dias e deduplicação por URL/título: Franca e região, São Paulo, Brasil e internacional. Quantidade menor é normal quando faltam fontes utilizáveis. Junto ao lote entram até três referências legislativas e três comunicados de concursos. São referências, não certificações de vigência ou de inscrição aberta. A IA recebe somente título/ementa/trecho permitido, produz um parágrafo original e não escolhe URLs ou endpoints. IDs desconhecidos são descartados. Não usamos Google Search no catálogo público.

Fontes regionais: RSS da Unidade Regional de Ensino de Franca e Agência SP. Metadados públicos são referenciados; não copiamos suas matérias ou fotos. A Prefeitura de Franca/Unesp apresentaram certificados inválidos na verificação: não contornamos TLS. A Agência Brasil fornece conteúdo próprio com atribuição; fotos apenas com crédito explícito validado. GOV.UK usa Open Government Licence. ALEAC oferece ementas; ECA/LDB/BNCC são referências oficiais identificadas. Concursos vêm de IFSP/IFRS; a cobertura não é nacionalmente completa.

Fontes indisponíveis são listadas em Automação. O banco conserva o catálogo anterior. Máximo de 500 itens com IA e 60 fotos; histórico de execuções por 90 dias. Dados antigos manuais e relatos não são removidos pela limpeza.

## Limites e dados

Chave apenas no `.env` privado do servidor, nunca no bundle, Git, PDF ou painel. Limite padrão: 13 chamadas por 24 horas/dia do provedor, três reservadas para o catálogo, duas por minuto e três por conexão. Falhas contam, sem repetição ou troca automática de modelo. Recusas 400/401/402/403/404/429 pausam chamadas por 24 horas.

Em modo pago, só Gemini 3.5 Flash-Lite está autorizado, com preços verificados em 27/10/2026 (US$ 0,30/milhão de entrada, US$ 2,50/milhão de saída incluindo raciocínio, US$ 0,014/busca). A estimativa cobra internamente TODAS as buscas, mesmo dentro da franquia Google de 5.000/mês, para não depender de consumo externo do projeto. Isso pode interromper os chats antes do saldo real.

Reserva SQLite atômica antes de cada chamada: US$ 0,15 para consulta, US$ 0,04 para lote diário. Resposta com metadados válidos substitui a reserva pelo custo estimado; falha ou medição ausente mantém a reserva. Sem contagem de buscas, presume dez. O orçamento total é US$ 4,50, acumulado e sem renovação mensal. Reiniciar, trocar de mês ou pausar/retomar não zera o uso. O painel mostra estimativa, reservas, tokens, buscas e permite pausar novas chamadas.

Isso não é garantia financeira: o provedor decide o número de buscas, pode mudar preços e tem atraso de contabilização. Prepay deve ter recarga automática DESLIGADA e limite de gasto no provedor quando disponível. Um vazamento de chave fora do site não passa pelos nossos limites. O total local não inclui chamadas feitas em outros programas ou no AI Studio. Nenhum dado financeiro ou cartão entra no site.

Chats, quando ativados, exigem consentimento, declaração de maioridade/profissional no Brasil, filtros enumerados e perguntas limitadas. Coordenadas, nome, e-mail e campos inesperados são recusados. Só haverá persistência local por escolha do usuário (20 consultas/90 dias). O servidor guarda contadores, estado da execução e hash temporário da conexão, nunca o texto da pergunta/resposta. HTTPS, validação de origem, corpo limitado e limites globais continuam aplicados. Cabeçalhos de IP enviados pelo cliente não são confiáveis; atrás do proxy, conexões podem compartilhar o mesmo limite conservador.

As condições gratuitas do Google permitem revisão humana e uso dos textos para melhoria de produtos; não enviar informação pessoal ou confidencial. Relatos manuais não entram em prompts de IA. A segurança do Gmail depende da senha, segundo fator e recuperação na própria conta; o site não recebe essa senha.

## Configuração

Gratuito: `AI_ENABLED=true`, `AI_BILLING_MODE=free`, `GEMINI_FREE_TIER_CONFIRMED=true`, `AI_INTERACTIVE_ENABLED=false`.

Pago, somente após verificar a conta: `AI_ENABLED=true`, `AI_BILLING_MODE=paid`, `GEMINI_PAID_TIER_CONFIRMED=true`, `GEMINI_FREE_TIER_CONFIRMED=false`, `AI_INTERACTIVE_ENABLED=true`, `AI_TOTAL_BUDGET_USD=4.5`, `AI_DAILY_LIMIT=13`, `GEMINI_MODEL=gemini-3.5-flash-lite`.

Ative somente na produção para evitar consumo duplicado. `PUBLIC_ORIGIN` é o host HTTPS sem subpasta. `.env.example` permanece desativado. O valor inicialmente proposto era US$ 5, mas a conta exigiu mínimo regional de R$ 150, pago diretamente pelo proprietário. Não há novas recargas autorizadas nem renovação automática do orçamento local.

## Referências

- [Preços e recursos gratuitos Gemini](https://ai.google.dev/gemini-api/docs/pricing)
- [Limites por projeto](https://ai.google.dev/gemini-api/docs/rate-limits)
- [Termos, dados e restrições de grounding](https://ai.google.dev/gemini-api/terms)
- [Agência SP](https://www.agenciasp.sp.gov.br/sobre/)
- [Agência Brasil](https://agenciabrasil.ebc.com.br/sobre)
- [Reutilização GOV.UK](https://www.gov.uk/help/reuse-govuk-content)
- [Agendamentos Alwaysdata](https://help.alwaysdata.com/en/docs/web-hosting/tasks/)

- [Faturamento, Prepay e atraso de contabilização](https://ai.google.dev/gemini-api/docs/billing)

## Estatísticas e conta responsável

A conta principal `matheusilvaandradecontato@gmail.com` foi escolhida para a ativação paga. `vozdoprofessoroficial@gmail.com` permanece como destino dos formulários. O estado efetivo de ativação deve ser conferido no painel.

O ciclo diário inclui uma segunda chamada, quando necessário, para interpretar contagens públicas dos últimos 12 meses. Nada de texto de relatos, perguntas ou contatos é enviado nessa etapa. As consultas contribuem somente mediante `statisticsConsent=true` separado e opcional. O contador mensal armazena tema, estado e quantidade; retém até 24 meses. Apenas grupos a partir de cinco são exibidos. Não mede pessoas únicas nem popularidade geral; a amostra é autoselecionada. As contagens das publicações refletem o catálogo atualmente publicado, não um histórico imutável de posts retirados.

A interpretação é vinculada a um hash dos números e do período: mudanças ou outros períodos ocultam o texto antigo. Uma falha do resumo não impede os gráficos nem desfaz o catálogo; não há nova chamada por visita ou filtro.
