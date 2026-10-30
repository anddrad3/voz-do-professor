import { readFileSync } from 'node:fs';
// Kept server-side: the detailed original matrix belongs to the authenticated panel.
const original = JSON.parse(
  readFileSync(new URL('../../docs/requisitos.json', import.meta.url), 'utf8'),
);
const groups = {
  1: [
    'Disponível com cobertura parcial',
    'Catálogo com fontes identificadas e consultas com IA. A cobertura depende das fontes e do orçamento; não certifica vigência ou exatidão.',
  ],
  2: [
    'Suspenso por decisão do projeto',
    'A engenharia de dados do Radar foi retirada a pedido. Permanecem filtros e aproximação local da cidade; não há base ativa de escolas, CNPJ, Censo Escolar ou mapa de vagas.',
  ],
  3: [
    'Adaptado para fontes e IA',
    'Concursos publicados têm cobertura parcial. Oportunidades privadas são consultas individuais com fontes; resultados e prazos devem ser conferidos na origem.',
  ],
  4: [
    'Adaptado para participação por e-mail',
    'O site não coleta formulários nem respostas. O participante envia o PDF por e-mail e o proprietário publica somente relatos autorizados.',
  ],
  5: [
    'Adaptado para armazenamento local',
    'Sem cadastro ou conta de visitante. Preferências, foto, nome, região, favoritos e chats salvos ficam neste navegador, sem sincronização entre aparelhos.',
  ],
  6: [
    'Disponível na administração privada',
    'Recursos sujeitos à autenticação, segundo fator, CSRF, validação no servidor e controles de uso. Consulte os limites descritos em cada ferramenta.',
  ],
};
const specific = {
  1.3: [
    'Adaptado para consulta com IA',
    'Piso consultado por localização e contexto, com fontes. Não há tabela fixa nem garantia de que o valor indicado seja aplicável ao vínculo do usuário.',
  ],
  1.5: [
    'Integrado a notícias e legislação',
    'A pílula exclusiva de Conselho de educação foi removida. Informações pertinentes permanecem nas outras categorias.',
  ],
  1.8: [
    'Histórico das publicações',
    'Exibe revisões armazenadas de uma publicação. Não equivale a uma base completa e consolidada de todas as alterações de cada lei.',
  ],
  1.9: [
    'Fontes identificadas',
    'Links, datas e origem ficam nos cards. Identificar a fonte não significa certificação independente de cada informação.',
  ],
  3.4: [
    'Adaptado para consulta com IA',
    'Bancos de talentos e cadastros de reserva aparecem nas respostas quando há fonte. Não há uma central separada ou inscrição pelo site.',
  ],
  3.5: [
    'Cobertura parcial',
    'A busca no catálogo e os filtros disponíveis permitem refinar resultados. Não existe filtro estruturado de disciplina em todos os chats.',
  ],
  3.7: [
    'Cobertura parcial',
    'Requisitos de formação podem aparecer nas respostas e nos editais. Não há filtro de escolaridade em todos os formulários.',
  ],
  3.8: [
    'Conforme a fonte',
    'Salário só pode ser usado quando informado pela fonte ou resposta referenciada; ausência não é estimativa de remuneração.',
  ],
  3.9: [
    'Calendário do catálogo',
    'Datas de editais cadastrados e exportação ICS quando disponíveis; chats não geram uma agenda universal de vagas.',
  ],
  4.3: [
    'Coleta online retirada',
    'Não há votação nem formulário enviado ao servidor. A antiga aba Pesquisas foi retirada do painel.',
  ],
  '4.10': [
    'Agregados públicos disponíveis',
    'Gráficos contabilizam publicações e consultas concluídas por tema, estado e mês. Não analisam respostas privadas a pesquisas.',
  ],
  4.11: [
    'Relatório estatístico agregado',
    'PDF com período, estado e categoria. Não é um diagnóstico representativo das condições de trabalho de toda a população docente.',
  ],
  4.12: [
    'Território agregado',
    'Publicações e consultas podem ser agrupadas por estado. Consultas não guardam GPS ou cidade; grupos com menos de cinco registros ficam ocultos.',
  ],
  4.13: [
    'PDF enviado por e-mail',
    'Sugestões e pedidos de remoção usam o mesmo formulário offline. Fotos podem ser anexadas à mensagem, nunca enviadas ao site.',
  ],
  4.14: [
    'Minimização de dados',
    'Anonimato na publicação não oculta o remetente do e-mail. O site mantém apenas dados necessários e agregados; a hospedagem e serviços externos têm políticas próprias.',
  ],
  5.1: [
    'Cadastro retirado por decisão do projeto',
    'A navegação pública não exige login. O aceite dos termos é guardado localmente.',
  ],
  6.3: [
    'Revisão humana dos relatos',
    'Relatos e correções manuais exigem revisão do proprietário. Notícias automáticas usam fontes permitidas e resumos por IA identificados.',
  ],
  6.5: [
    'Rotina diária com orçamento limitado',
    'Catálogo programado para 08h de Brasília, sem prometer resultados quando as fontes falham ou o orçamento se esgota. O Radar permanece suspenso.',
  ],
  6.6: [
    'Validações técnicas',
    'Validação de esquemas, fontes, limites e duplicidades; não é uma auditoria jurídica ou factual de todas as publicações.',
  ],
  6.7: [
    'Aba retirada por solicitação',
    'Não há gerenciamento de pesquisas acessível no painel atual; a matriz preserva este requisito original como histórico.',
  ],
  6.8: [
    'Operação e métricas agregadas',
    'Painel mostra rotinas, fontes, limites e estimativas de gasto. O observatório público exibe agregados, sem perfis individuais de visitantes.',
  ],
  6.9: [
    'PDF e ICS disponíveis',
    'Exportação do relatório estatístico, guia de uso, formulário offline e calendários quando houver datas. Não exporta dados individuais de usuários.',
  ],
};
export function requirementInfo() {
  return original.map((row) => {
    const [status, current] =
      specific[row.id] ||
      (['4.4', '4.5', '4.6', '4.7', '4.8', '4.9'].includes(row.id)
        ? [
            'Instrumento temático do projeto; sem coleta online',
            'Tema previsto no documento original. A plataforma atual não aplica questionário estruturado nem recebe respostas; eventuais instrumentos são tratados fora do site.',
          ]
        : groups[row.id.split('.')[0]]);
    return { ...row, status, current };
  });
}
