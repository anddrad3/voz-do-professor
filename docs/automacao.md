# Histórico da automação v2

Esta descrição documenta a versão anterior. A versão 3 substitui a rotina por [catálogo diário com IA](ia.md); a coleta CNPJ e a atualização de vagas por APIs antigas não são executadas pelo servidor atual.

# Automação, fontes e condições de uso

Verificação em 25/10/2026. Reutilização depende das condições de cada fonte; estar na internet não elimina direitos autorais nem obrigações de privacidade. A escolha técnica é minimizar: metadados e links, atribuição, sem corpos integrais das notícias, com trechos e fotos apenas nas condições de reprodução explicitadas abaixo. Isto documenta a análise de fontes, não oferece garantia jurídica universal.

| Fonte              | Condições oficiais                                    | Implementação                                                                                                                                                    |
| ------------------ | ----------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Agência Brasil/EBC | https://agenciabrasil.ebc.com.br/sobre                | RSS educação; manchete/data/link e fonte. Há restrições para conteúdo de parceiros; não importamos corpo ou foto.                                                |
| GOV.UK             | https://www.gov.uk/help/reuse-govuk-content           | Search API Department for Education; Open Government Licence, crédito.                                                                                           |
| GDELT              | https://www.gdeltproject.org/about.html               | Metadados com crédito GDELT e fonte original; direitos da matéria não são cedidos pelo indexador.                                                                |
| Jobicy             | https://github.com/Jobicy/remote-jobs-api             | API industry=education, crédito e link; intervalo6h (mais conservador que1h).                                                                                    |
| Remotive           | https://github.com/remotive-com/remote-jobs-api       | Sem cadastro obrigatório; crédito/link, máximo4 consultas/dia, atraso da fonte. Não há JobPosting/sitemap de vagas nem redistribuição para Google Jobs/LinkedIn. |
| Receita Federal    | https://www.gov.br/receitafederal/dados               | Estabelecimentos ativos com CNAE85; sem sócios/CPF/contatos. CNPJ alfanumérico preservado.                                                                       |
| IBGE               | https://servicodados.ibge.gov.br/api/docs/localidades | Lista de municípios/UF para reconhecer nomes citados; não inventa geolocalização da notícia.                                                                     |

O país da notícia é exibido como **país da fonte**, não necessariamente o país do fato. Localidades brasileiras são inferidas pelo nome no título; município com nome duplicado sem evidência de UF não é classificado. A ausência de município não elimina a matéria do feed geral.

Vagas sem datas de abertura/encerramento aparecem como “Consultar na fonte”. Salário só aparece em reais quando a fonte informa BRL; outras moedas ficam no anúncio de origem. Não exibimos texto integral dos anúncios. Registros automáticos de vagas com mais45dias são retirados; ausência num feed não é prova de encerramento.

## Cobertura CNPJ compatível com hospedagem gratuita

A fonte nacional completa tem vários GB comprimidos e não cabe no plano gratuito. A rotina usa ZIP remoto com requisições Range, lista o mês com todos os arquivos esperados, processa fluxo CSV e guarda somente um lote de estabelecimentos educacionais. Não extrai ZIP no disco. Se a fonte não aceitar HTTP206 ou mudar leiaute, a execução falha sem baixar o corpo integral.

Padrões:500 estabelecimentos/lote,24MB transferidos,120s, uma execução/dia, rodízio entre arquivos0..9, no máximo3000 instituições no catálogo. São amostras limitadas dos arquivos, **não uma varredura nacional completa**. O painel identifica cobertura parcial. Em bancos de produção reais, ausência no catálogo não comprova inexistência da instituição.

`python scripts/rfb-sync.py --database data/public-v2.sqlite` executa um lote. O agendamento no processo Node é habilitado por `RFB_SYNC=true`; Python3 precisa estar disponível. Os parâmetros permitem uso com outros orçamentos, mas elevar limites não faz parte da configuração gratuita entregue.

## Falhas e manutenção

A primeira atualização de fontes leves ocorre ao iniciar, depois verifica por hora e respeita6h por fonte. Não há IA. Erros ficam no painel e o catálogo anterior é preservado. APIs podem mudar/discontinuar; não é possível garantir operação sem nenhuma manutenção para sempre. Nenhum contrato/plano pago é criado pelo código.

Relatos são a única alimentação editorial rotineira exigida do proprietário. Publicações jurídicas detalhadas, resumos interpretativos, valores de piso e regras municipais não são inventados automaticamente a partir de manchetes: na ausência de dados estruturados confiáveis, a interface aponta para a fonte original.

## Legislação e reprodução de trechos (atualização de 25/10/2026)

- ECA e LDB: referências oficiais do Planalto; BNCC: portal do MEC. Uma referência aparece mesmo que o servidor de origem recuse a consulta automática. A data de última consulta só aparece quando a consulta teve sucesso. Comparação de hash identifica mudança de página, não certifica alteração normativa ou vigência.
- ALEAC: API pública documentada em https://app.al.ac.leg.br/dados-abertos, consulta diária de até 100 resultados, publicação de até 50 normas relacionadas à educação. Acervo pode ter defasagem. Ementa é oficial, não interpretação jurídica.
- LexML: SRU documentado pelo Senado, até 100 resultados/dia e 50 publicados. Filtra URN de normas federais, estaduais e distritais; exclui projetos, jurisprudência e normas municipais. Na validação, respondeu verificação de segurança, que não foi contornada. A integração tenta novamente no intervalo normal e mantém o cache; não se anuncia cobertura de todos os estados.
- Texto de atos oficiais: Lei 9.610/1998, art. 8º, IV. Isso não torna toda fotografia, notícia ou comentário jurídico livre de direitos. Fonte: https://www.planalto.gov.br/ccivil_03/leis/l9610.htm.
- Agência Brasil: https://agenciabrasil.ebc.com.br/sobre permite reprodução jornalística com fonte, com ressalvas a parceiros. O portal usa apenas primeiro parágrafo, identifica autor, link e data, remove HTML/pixels e rejeita autoria/licença incerta. Não usa a regra genérica de “dar crédito” como licença para copiar outros jornais.
- Fotos: só crédito principal terminando em Agência Brasil/EBC, rejeitando parceiros/reservados; arquivo JPEG até 1,5 MB, domínio EBC fixo, sem redirecionamentos, servido localmente e com crédito. Máximo de 60 arquivos (90 MB). O cache mais antigo pode ser removido e o card continua sem foto. Fotos do MEC/Divulgação/outros parceiros não entram automaticamente.
- Frequência e quantidade: notícias/vagas a cada 6 h, até 30 registros por fonte/execução; legislação a cada 24 h; CNPJ a cada 24 h. Cache geral de até 1500 registros automáticos e 3000 instituições. Relatos continuam exclusivamente manuais. Dependências de fontes externas exigem manutenção eventual; não é garantida operação eterna sem intervenção.
