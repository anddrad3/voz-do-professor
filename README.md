# Voz do Professor

Site publicado: [Voz do Professor](https://amerindia.alwaysdata.net/voz-do-professor/).

Plataforma de informação docente com cards adaptativos, temas claro/escuro, catálogo público e administração privada. Versão 2: **sem contas de visitantes, sem upload e sem coleta de relatos ou respostas no servidor**.

## Rodar

Node.js 24+. `npm ci`, `npm run build`, `npm run dev`. Abra http://127.0.0.1:5173. O ambiente de desenvolvimento usa `data/demo-v2.sqlite` e exemplos identificados; fontes automáticas também podem trazer dados reais. `AUTO_SYNC=false` desativa conexões às fontes durante testes offline.

## O que fica no navegador

Preferências, região, favoritos e alertas lidos ficam no localStorage, com fallback em memória se estiver bloqueado. Não são enviados ao servidor. Busca, filtros, distância e comparação de alertas são processados localmente sobre o catálogo público. Geolocalização só é solicitada depois de um clique e suas coordenadas ficam no aparelho. Não há envio de e-mail, SMS ou push. Limpar o navegador perde essas preferências. Usuários do mesmo perfil de navegador podem vê-las.

## Participação por PDF

Na área Voz do Professor há um PDF AcroForm preenchível: relato, sugestão, remoção/correção ou outros pedidos. Nome opcional, anonimato na publicação e autorização específica para publicar relato. O participante salva o documento localmente e envia pelo próprio e-mail; **o site não recebe o arquivo**. O remetente continuará visível ao administrador/provedor de e-mail.

O endereço `relatos@exemplo.invalid` é propositalmente fictício e não recebe mensagens. Ao definir o endereço real, altere `REPORT_EMAIL` e gere o formulário novamente com `scripts/generate-forms.py --email endereco@dominio`. Isso é uma configuração inicial, não uma etapa por relato. Veja [formulário offline](docs/formulario-offline.md).

## Painel exclusivo do proprietário

**Acesso pelo celular ou computador:** https://amerindia.alwaysdata.net/voz-do-professor/painel. Não há botão administrativo no site público nem cadastro de visitantes. Não é necessário manter o computador ligado ou executar um túnel SSH.

O login do proprietário exige senha e um código do autenticador (TOTP, seis dígitos, 30 segundos). Há dez códigos de recuperação de uso único, que substituem o código do autenticador; a senha continua obrigatória. A configuração inicial e os códigos ficam em arquivos privados, fora do Git e do diretório público. Consulte [operação](docs/operacao.md).

O painel permite adicionar/revisar/publicar/retirar relatos, corrigir registros, acompanhar sincronizações e habilitar/desabilitar ferramentas, individualmente ou todas. A autenticação usa hash scrypt, cookies Secure/HttpOnly/SameSite Strict, CSRF, verificação de origem e limite persistente de tentativas. O segundo fator impede reutilização de códigos aceitos. Relatos recebidos por e-mail e contatos não devem ser copiados para o cadastro: publique somente o texto autorizado.

O modo local continua disponível para desenvolvimento quando `ADMIN_WEB_ENABLED=false`. A implantação online usa `ADMIN_WEB_ENABLED=true`, `ADMIN_HTTPS=true` e origem HTTPS explícita; ela recusa iniciar sem segundo fator provisionado. Não exponha a porta local de administração no proxy.

## Atualizações automáticas, sem IA

- Agência Brasil/EBC e GOV.UK: títulos, datas, fonte e link. Primeiro parágrafo próprio da EBC com autoria; fotos apenas quando o crédito principal identifica Agência Brasil/EBC, sem parceiros ou direitos reservados. Cache local de até 60 fotos, 1,5 MB cada; o visitante não conecta ao provedor da imagem.
- GDELT: metadados globais complementares; falhas preservam o catálogo. País é o país do veículo. Não há garantia de notícia em cada país/cidade.
- Legislação: referências ECA, LDB e BNCC; monitoramento diário das fontes oficiais. API ALEAC para normas educacionais estaduais. LexML federal/estadual integrado, mas indisponível na validação por verificação de segurança. Não há cobertura completa de todos os estados; falhas e datas aparecem no painel.
- Estado/cidade: correspondência textual determinística no título, usando nomes IBGE. Casos ambíguos ficam sem classificação; isso é indicado no filtro.
- Jobicy e Remotive: anúncios de educação/formação com atribuição e link. Os limites das fontes são respeitados (6h entre consultas). Não inventamos prazos, salários ou vínculo entre CNPJ e empresa anunciante.
- CNPJ: Python padrão, leitura HTTP Range de arquivos oficiais da Receita, estabelecimentos ativos com CNAE 85. Em hospedagem pequena, até 500 registros por lote diário, 24 MB comprimidos, 120 s e catálogo máximo de 3000. **É cobertura parcial**, com rodízio entre os dez arquivos. Não baixamos o arquivo nacional completo nem coletamos QSA, CPF, e-mail ou telefone. Ative `RFB_SYNC=true` em produção.
- No detalhe da instituição, o site busca vagas de mesmo nome no catálogo das APIs. Coincidência de nome não é prova de vínculo com o CNPJ. Não há rastreamento irrestrito de sites, acesso privado ou garantia de achar todas as vagas.

[Fontes, licenças e limites](docs/automacao.md). [Matriz dos 66 itens e alterações expressas](docs/requisitos.md).

## Publicação sem cobrança

Preparado para Node 24 + SQLite no Alwaysdata Free. O plano gratuito atualmente tem 1 GB de disco e 256 MB de RAM, é para uso não lucrativo e restringe endereços ao subdomínio alwaysdata.net da conta. Não configure upgrade, cartão ou serviços externos pagos. Esses limites exigem catálogo e sincronização limitados. O fornecedor pode alterar regras; não há garantia técnica de gratuidade eterna ou disponibilidade 100%.

O código usa um único processo Node para público e painel administrativo. `PORT`/`HOST` devem seguir o proxy; `ADMIN_PORT` fica em loopback. `BASE_PATH` e `VITE_BASE_PATH` permitem hospedar em subpasta sem substituir outro site. Detalhes em [Operação](docs/operacao.md).

## Validação e módulos

`npm run check`, `npm test`, `npm run build`, `python -m unittest discover -s tests -p "*_test.py"`, `npm audit --omit=dev`.

- `src/`: interface pública e painel com entradas separadas.
- `shared/`: filtros e configuração de ferramentas.
- `server/app.js`: catálogo público somente leitura e rotas administrativas autenticadas.
- `server/modules/automation.js`: integrações permitidas, limites e cache de catálogo.
- `scripts/rfb-sync.py`: descoberta CNAE com orçamento estrito de recursos.
- `public/formularios/`: PDF que não envia dados ao site.

Bancos antigos da versão 1 não são migrados nem publicados automaticamente. O banco padrão novo é `data/public-v2.sqlite`; arquivos de teste/desenvolvimento ficam ignorados no Git. Font Awesome Free (ícones gratuitos) é compilado localmente; grade/lista e tema são preferências do navegador.

Relatos publicados e credenciais administrativas continuam sendo dados do servidor. Sem login público não significa invulnerabilidade; configure também logs/retenção na hospedagem.
