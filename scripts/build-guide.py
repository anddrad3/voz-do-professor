"""Gera o guia público. Requer ReportLab; fontes Arial ou DejaVu Sans."""
from pathlib import Path
from reportlab.pdfgen import canvas
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, PageBreak, Table, TableStyle, KeepTogether
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.colors import HexColor, white
from reportlab.lib.enums import TA_LEFT
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.utils import ImageReader
import shutil
ROOT=Path(__file__).resolve().parent.parent
OUT=ROOT/'output/pdf/guia-voz-do-professor.pdf'
OUT.parent.mkdir(parents=True,exist_ok=True)
regular=Path('C:/Windows/Fonts/arial.ttf')
bold=Path('C:/Windows/Fonts/arialbd.ttf')
if not regular.exists():
 regular=Path('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf');bold=regular.with_name('DejaVuSans-Bold.ttf')
pdfmetrics.registerFont(TTFont('Guide',str(regular)))
pdfmetrics.registerFont(TTFont('GuideBold',str(bold)))
pdfmetrics.registerFontFamily('Guide',normal='Guide',bold='GuideBold',italic='Guide',boldItalic='GuideBold')
INK=HexColor('#1f232a');RED=HexColor('#cf333b');MUTED=HexColor('#5d626b');PALE=HexColor('#f6f3ef')
BASE='https://amerindia.alwaysdata.net/voz-do-professor/'
styles={
 'kicker':ParagraphStyle('kicker',fontName='GuideBold',fontSize=9,leading=13,textColor=RED,spaceAfter=10),
 'title':ParagraphStyle('title',fontName='GuideBold',fontSize=26,leading=31,textColor=INK,spaceAfter=14),
 'intro':ParagraphStyle('intro',fontName='Guide',fontSize=12,leading=18,textColor=MUTED,spaceAfter=17),
 'h':ParagraphStyle('h',fontName='GuideBold',fontSize=13,leading=18,textColor=INK,spaceBefore=13,spaceAfter=6),
 'p':ParagraphStyle('p',fontName='Guide',fontSize=10.2,leading=15.3,textColor=INK,spaceAfter=9),
 'small':ParagraphStyle('small',fontName='Guide',fontSize=9,leading=13.5,textColor=MUTED,spaceAfter=7),
}
def P(text,style='p'):return Paragraph(text,styles[style])
def section(title,text):return [P(title,'h'),P(text)]
def link(path,label):return f'<link href="{BASE}{path}" color="#ba2934"><u>{label}</u></link>'
def box(title,text):
 t=Table([[P(title,'h')],[P(text)]],colWidths=[475]);t.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,-1),PALE),('BOX',(0,0),(-1,-1),.6,HexColor('#ded9d2')),('LEFTPADDING',(0,0),(-1,-1),14),('RIGHTPADDING',(0,0),(-1,-1),14),('BOTTOMPADDING',(0,-1),(-1,-1),12)]));return t
pages=[]
def page(n,title,intro,body):
 if pages:pages.append(PageBreak())
 pages.extend([P(f'GUIA DE USO  /  {n:02d}','kicker'),P(title,'title'),P(intro,'intro'),*body])
page(1,'Informação para quem ensina','Conheça o Voz do Professor e comece a usar a plataforma em poucos passos.',[
 *section('O que é o projeto','O Voz do Professor reúne notícias, direitos, oportunidades e experiências docentes para fortalecer a informação profissional, a autonomia e a valorização de quem ensina. É um produto técnico-tecnológico de pesquisa com foco na educação básica e na região de Franca (SP).'),
 *section('Autoria e pesquisa','Idealização e desenvolvimento: <b>Matheus da Silva Andrade</b>, mestrando em Planejamento e Análise de Políticas Públicas, na Faculdade de Ciências Humanas e Sociais da Unesp, câmpus de Franca. Orientação: <b>Prof. Dr. Genaro Alvarenga Fonseca</b>.'),
 box('Comece por aqui','<b>1.</b> Abra '+link('#/perfil','Minha Sala de Aula')+' e salve sua região.<br/><b>2.</b> Explore '+link('#/direitos','Direitos e Notícias')+' ou '+link('#/oportunidades','Oportunidades')+'.<br/><b>3.</b> Para uma consulta nova com IA, escolha os filtros e uma pergunta.<br/><b>4.</b> Confira as fontes e guarde o que interessa na sua Sala de Aula.'),
 *section('Acesso aberto, sem cadastro','Não é necessário criar conta. Preferências, favoritos e consultas salvas ficam neste navegador. A IA organiza informações com referências; a autoria pedagógica e as decisões de ensino permanecem com o professor.'),
 P('Edição 3.1.1 · 28 de outubro de 2026<br/>'+link('','Abrir o Voz do Professor'),'small'),
])
page(2,'Notícias, direitos e piso','Um formulário reúne os filtros do catálogo e os campos da consulta individual.',[
 *section('Explore as categorias','Em '+link('#/direitos','Direitos e Notícias')+', escolha as pílulas Recentes, Notícia, Legislação, Piso salarial, Plano de carreira ou Conselho de educação. Os cards identificam categoria, fonte e data. Abra o título para ler o conteúdo e conferir a origem.'),
 *section('Filtrar o catálogo não chama a IA','Preencha país, estado, cidade, assunto e nível de ensino e clique em <b>Filtrar publicações do site</b>. Essa ação procura no acervo já publicado e não consome uma consulta de IA. Se não houver resultado, use <b>Limpar filtros</b> ou amplie a região. A ausência de classificação por cidade não prova ausência de informação sobre ela.'),
 *section('Fazer uma pesquisa nova com IA','Escolha a região e os demais campos. Leia as declarações de elegibilidade e de envio dos filtros ao Google. Marque-as somente se concordar e clique em uma das perguntas propostas. A contribuição para estatísticas é opcional. As consultas individuais atendem regiões do Brasil; o catálogo também tem fontes internacionais.'),
 *section('Consultar o piso salarial','Selecione <b>Piso salarial</b>, confira estado, cidade e rede e use <b>Consultar piso na minha região</b>. Outros botões ajudam a comparar rede e jornada, conferir reajustes ou encontrar a norma. Distinga o piso nacional do vencimento local: ano, jornada, carreira e vínculo podem mudar o valor aplicável.'),
 box('Confira antes de usar','Resumos e respostas por IA podem conter erros. Abra <b>Fontes consultadas</b> ou <b>Conferir fonte original</b> e verifique data, vigência e contexto. Uma notícia sobre uma proposta não torna essa proposta lei. O site não oferece aconselhamento jurídico individual.'),
 *section('Ler do seu jeito','Use os controles de grade ou lista e o botão de modo claro/escuro. Quando disponível, <b>Ouvir</b> inicia a leitura pelo navegador e <b>Citar</b> prepara a referência da publicação.'),
])
page(3,'Vagas e concursos','Escolha a área conforme a oportunidade que está procurando.',[
 *section('Oportunidades: comece pela rede privada','A área '+link('#/oportunidades','Oportunidades')+' abre com a rede <b>Privada</b>. Informe cidade, estado, cargo e nível. A busca orienta a IA a consultar páginas de recrutamento, sites de instituições e anúncios públicos de perfis institucionais. Você pode mudar a rede ou escolher Todas.'),
 *section('Entenda o tipo de resultado','<b>Vaga anunciada:</b> há uma oportunidade específica identificada na fonte.<br/><b>Banco de talentos:</b> o empregador recebe perfis para possíveis vagas futuras.<br/><b>Trabalhe conosco:</b> é um canal de candidatura, sem comprovar vaga aberta.<br/>Se não houver evidência atual de vagas privadas, a resposta deve dizer isso, sem substituí-las por concursos.'),
 *section('Perguntas objetivas','Use os botões para ver oportunidades, requisitos, prazos ou canais oficiais de contato. A candidatura acontece no site ou canal indicado pelo empregador, não no Voz do Professor. Confira se o anúncio ainda está ativo antes de enviar currículo ou documentos.'),
 *section('Concursos públicos','Em '+link('#/concursos','Concursos públicos')+', filtre os comunicados já disponíveis ou faça uma consulta nova com IA. Confira o edital original, o cargo, o município e as datas. Um resultado de prova ou uma homologação não significa que as inscrições estejam abertas. A cobertura automática das fontes é parcial.'),
 *section('Guardar oportunidades','Após receber uma resposta, clique em <b>Salvar na Minha Sala de Aula</b>. A consulta, os links e as vagas mencionadas ficam guardados juntos no navegador. Cards publicados também podem ser salvos pelo marcador de favoritos. Links e prazos devem ser conferidos novamente quando você voltar.'),
 box('Radar de Escolas: em preparação','O '+link('#/radar','Radar de Escolas')+' mantém filtros e localização, mas a nova base de instituições ainda está em desenvolvimento. Não há consulta ativa ao CNPJ nem garantia de vagas por proximidade.'),
])
page(4,'Minha Sala de Aula','Sua região, favoritos, consultas e alertas ficam reunidos em um único espaço.',[
 *section('Defina sua região uma vez','Abra '+link('#/perfil','Minha Sala de Aula')+', escolha país, estado e cidade, ajuste seus interesses e clique em <b>Salvar neste navegador</b>. Essa região preenche os outros formulários. Você pode mudar um filtro para uma consulta sem alterar sua preferência salva.'),
 *section('Usar minha localização','O botão pede autorização ao navegador. A cidade é sugerida pela sede municipal mais próxima, usando uma base no próprio site e cálculo local. Confira e corrija a sugestão se necessário, principalmente em divisas e áreas rurais. As coordenadas de GPS não são enviadas à IA. Recusar a permissão não impede escolher a cidade manualmente.'),
 *section('Publicações favoritas','Use o marcador do card ou o botão <b>Salvar</b> nos detalhes para guardar notícias, leis e publicações. Elas aparecem em <b>Publicações que você salvou</b>. O marcador permite remover o favorito. Uma cópia local pode ficar desatualizada; verifique a fonte e os avisos ao abri-la.'),
 *section('Consultas salvas','O botão <b>Salvar na Minha Sala de Aula</b> guarda a resposta inteira com seus links. São até 20 consultas por 90 dias. Use <b>Apagar esta consulta</b> para removê-la. Repetir a mesma pergunta com os mesmos filtros durante a sessão pode reutilizar a resposta por até seis horas, sem nova chamada à IA.'),
 *section('Novidades e alertas','A seção <b>Novidades para sua região</b> compara o catálogo com seus interesses quando você abre o site. Marque itens como lidos ou salve-os. Não são enviados e-mails, notificações push ou alertas com o site fechado. O antigo endereço Meus Alertas abre esta mesma Sala de Aula.'),
 box('O que “salvo no navegador” significa','Não há sincronização entre computador e celular ou entre navegadores. Limpar os dados locais pode apagar tudo; a navegação privada pode descartar o conteúdo ao fechar. Quem usa o mesmo navegador pode ver os itens. <b>Apagar meus dados locais</b> limpa essas preferências e coleções. Consultas novas e atualização do catálogo precisam de internet.'),
])
page(5,'Relatos e participação','O envio é feito por você, pelo seu serviço de e-mail. O site não recebe o arquivo.',[
 *section('Como enviar um relato','<b>1.</b> Abra '+link('#/voz','Voz do Professor')+' e baixe o formulário editável.<br/><b>2.</b> Salve uma cópia no seu dispositivo e abra em um leitor de PDF com suporte a formulários.<br/><b>3.</b> Selecione Enviar relato, escreva a mensagem e escolha nome, pseudônimo ou anonimato.<br/><b>4.</b> Confira a autorização de publicação, salve e reabra o PDF para verificar se os campos foram preservados.<br/><b>5.</b> Anexe-o a uma mensagem e envie para <b>vozdoprofessoroficial@gmail.com</b>.'),
 *section('Sugestão, correção ou remoção','Use o mesmo PDF e selecione o motivo adequado. Para corrigir ou remover uma publicação, inclua seu link ou código. Essa opção não autoriza publicar o pedido. Seu contato será o endereço remetente do e-mail; não há necessidade de cadastrar uma conta no site.'),
 *section('Anonimato na publicação','Você pode omitir o nome ou pedir publicação sem identificação. O endereço de e-mail continuará visível ao responsável e ao provedor de e-mail. Evite dados de alunos, terceiros e detalhes que identifiquem pessoas. O responsável revisa e publica manualmente apenas o texto autorizado e a identificação pública escolhida.'),
 *section('Pesquisas e escuta docente','Quando houver uma pesquisa publicada, leia o objetivo, as orientações e o consentimento do instrumento antes de participar. Não presuma que uma publicação de pesquisa seja um resultado ou uma resposta coletada. O site não lê automaticamente os formulários recebidos por e-mail.'),
 box('Se o PDF não salvar seus campos','Baixe o arquivo antes de preencher. Experimente um leitor de PDF que aceite campos editáveis e use Salvar como. Reabra a cópia para conferir o texto antes de enviá-la. Guarde uma cópia do envio e não coloque senhas ou documentos pessoais no formulário.'),
 P(link('formularios/voz-do-professor.pdf','Baixar formulário de relato, sugestão ou remoção'),'small'),
])
page(6,'Estatísticas e dúvidas','Saiba o que os números representam e como resolver os problemas mais comuns.',[
 *section('Como ler as estatísticas','Em '+link('#/estatisticas','Estatísticas')+', escolha o mês inicial e final, até 24 meses, e clique em <b>Aplicar período</b>. Os gráficos mostram publicações por categoria, mês e localidade. Relatos e pesquisas são contados como publicações, sem análise dos textos privados ou das respostas enviadas por e-mail.'),
 *section('Assuntos mais procurados','Somente consultas concluídas com consentimento estatístico opcional alimentam os contadores por tema, estado e mês. Grupos menores que cinco ficam ocultos. Ausência no gráfico não significa zero; os valores não são visitantes únicos nem representam todos os professores. A IA interpreta contagens do catálogo. Filtrar gráficos não gera chamadas à IA.'),
 *section('Por que a IA pode pedir para aguardar?','Existem limites de consultas, velocidade e orçamento, separados entre si. A configuração desta edição permite até 30 consultas por conexão em 24 horas e 60 chamadas globais, com reserva para o catálogo. Conexões compartilhadas podem dividir a cota. Respeite o prazo informado, evite cliques repetidos e consulte os conteúdos e respostas já salvos.'),
 *section('O uso tem cobrança para mim?','O visitante não paga para consultar. A API é custeada pelo projeto e pode ser pausada ao atingir o orçamento. O painel administrativo apresenta uma <b>estimativa em dólares americanos (US$)</b>, não reais nem uma fatura. Consumo pequeno em dinheiro não elimina limites de chamadas.'),
 *section('Não apareceu resultado','Confira cidade, estado e rede; use Limpar filtros ou amplie a região. Nem toda fonte tem dados locais. O catálogo é atualizado a partir das 08h de Brasília, com até 20 notícias inéditas conforme as fontes e o orçamento. Falhas externas podem reduzir a quantidade. Consultas por IA não garantem encontrar uma vaga ou norma atual.'),
 *section('Atualizações, fontes e privacidade','Consulte '+link('#/transparencia','Transparência')+' para conhecer o projeto, as fontes e seus limites. Funções podem ser temporariamente desativadas. Nenhum sistema é infalível: confira o original antes de tomar decisões. Para sugestões e correções, utilize o formulário e o e-mail descritos na página anterior.'),
 P('Este guia descreve a edição 3.1.1. O site pode receber melhorias após esta data.','small'),
])
def decorate(c,doc):
 w,h=doc.pagesize
 c.setFillColor(RED);c.rect(0,h-8,w,8,fill=1,stroke=0)
 c.setFont('GuideBold',9);c.setFillColor(RED);c.drawString(46,h-35,'VOZ DO PROFESSOR')
 c.setFont('Guide',8);c.setFillColor(MUTED);c.drawRightString(w-46,h-35,'GUIA DA PLATAFORMA')
 c.setStrokeColor(HexColor('#ded9d2'));c.line(46,43,w-46,43)
 c.setFont('Guide',8);c.drawString(46,29,'Edição 3.1.1  |  28/10/2026');c.drawRightString(w-46,29,f'{doc.page} / 6')
 c.linkURL(BASE,(46,20,290,42),relative=0,thickness=0)
doc=SimpleDocTemplate(str(OUT),pagesize=(595.28,841.89),rightMargin=46,leftMargin=46,topMargin=61,bottomMargin=57,title='Voz do Professor - Guia de uso',author='Matheus da Silva Andrade',subject='Funcionalidades e instruções para usuários da plataforma')
doc.build(pages,onFirstPage=decorate,onLaterPages=decorate)
public=ROOT/'public/guias';public.mkdir(exist_ok=True);shutil.copyfile(OUT,public/OUT.name)
print(str(OUT))
