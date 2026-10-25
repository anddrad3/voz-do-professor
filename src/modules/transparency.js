import { state } from '../api.js';
import { h, heading, notice } from '../ui.js';
export function transparency() {
  return (
    heading(
      'Fontes e privacidade',
      'Transparência',
      'Informação com origem identificada e participação fora do site.',
    ) +
    `<div class="grid"><article class="card"><h2>Sem contas de visitantes</h2><p>O site não recebe relatos, sugestões, e-mail, nome, perfil, favoritos ou coordenadas. Preferências e alertas ficam no navegador. A aplicação não grava IP nem histórico de navegação. A infraestrutura de hospedagem pode manter logs próprios; isso precisa ser configurado pelo responsável.</p><p>Mapa carrega somente ao clicar e conecta ao OpenStreetMap. Links externos e e-mail têm políticas próprias. Limpar os dados locais apaga seus favoritos e alertas lidos.</p></article><article class="card"><h2>Notícias automáticas, sem IA</h2><p>Agregamos títulos, datas e links de fontes autorizadas. Não copiamos matérias completas. Trechos próprios da Agência Brasil e fotos com crédito autorizado são identificados e servidos pelo próprio site. Conteúdo de parceiros com permissão incerta fica de fora. Agência Brasil/EBC, GOV.UK (Open Government Licence) e GDELT são identificados em cada card. País do veículo é diferente do local do acontecimento. Uma cidade só aparece quando há evidência no título e indicação da regra usada.</p></article><article class="card"><h2>Legislação oficial</h2><p>ECA e LDB remetem ao Planalto; a BNCC remete ao MEC. Consultas diárias verificam as páginas oficiais. Normas estaduais vêm de APIs legislativas disponíveis, com jurisdição explícita. A cobertura é parcial: a API do Acre está integrada e o LexML pode ficar indisponível. Não confundimos projetos com leis, nem certificamos a vigência a partir da ementa. Consulte sempre a fonte oficial.</p></article><article class="card"><h2>Empresas e oportunidades</h2><p>Instituições podem vir da base pública mensal do CNPJ: estabelecimentos ativos com atividade de educação, CNAE 85. Não coletamos sócios, CPF, e-mails ou telefones dessa base. O CNPJ não significa vaga aberta. Vagas vêm de APIs autorizadas, com data de consulta e link original; cobertura e localização podem ser incompletas.</p></article><article class="card"><h2>Relatos recebidos por e-mail</h2><p>Contato: ${h(state.config.contactEmail)}. O remetente é visível na caixa de e-mail do responsável. Só o texto autorizado e a identificação pública escolhida são cadastrados no painel. Não há upload ou armazenamento do PDF recebido no site. Para remoção/correção, use o mesmo PDF com a referência da publicação.</p></article></div>` +
    notice(
      'Automação reduz tarefas rotineiras, mas fontes externas podem sair do ar, mudar regras ou deixar dados incompletos. O painel informa a última execução e falhas. Nenhuma vaga é garantida.',
    )
  );
}
