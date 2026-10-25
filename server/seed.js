import { saveRecord } from './domain.js';
import { now } from './db.js';
const date = new Date().toISOString().slice(0, 10);
export function seedDemo(db) {
  if (db.prepare("SELECT value FROM metadata WHERE key='demo-seeded-v1'").get()) return;
  const add = (kind, id, data) => {
    saveRecord(db, kind, data, 'Exemplo demonstrativo', id, true);
    db.prepare("UPDATE records SET status='published' WHERE id=?").run(id);
  };
  add('content', 'demo-direitos', {
    title: 'Informação para fortalecer a autonomia docente',
    type: 'Notícia',
    sourceName: 'Voz do Professor · demonstração',
    sourceUrl: 'https://www.gov.br/mec/pt-br',
    sourceDate: date,
    body: 'Um espaço para conhecer seus direitos, acompanhar decisões e encontrar caminhos para a valorização profissional. Explore as áreas da plataforma e personalize o que faz sentido para você.',
    tags: ['Autonomia', 'Valorização'],
    level: 'Todos',
  });
  add('content', 'demo-piso', {
    title: 'Piso salarial: acompanhe a norma e suas atualizações',
    type: 'Piso salarial',
    sourceName: 'Referência: Lei 11.738/2008',
    sourceUrl: 'https://planalto.gov.br/ccivil_03/_ato2007-2010/2008/lei/l11738.htm',
    sourceDate: date,
    body: 'Consulte a fonte oficial e acompanhe a curadoria do piso salarial. Valores, ano de referência e jornada aparecem aqui após o cadastro e a revisão de um responsável.',
    summary:
      'Este card demonstra a consulta ao piso. Nenhum valor salarial foi presumido. A publicação definitiva depende da conferência da norma vigente por um curador humano.',
    tags: ['Remuneração', 'Legislação'],
    level: 'Todos',
    history: [],
  });
  add('content', 'demo-carreira', {
    title: 'Sua carreira também é feita de informação',
    type: 'Plano de carreira',
    sourceName: 'Voz do Professor · demonstração',
    sourceUrl: 'https://www.franca.sp.gov.br/',
    sourceDate: date,
    city: 'Franca',
    state: 'SP',
    body: 'Progressão, formação, jornada e evolução salarial: organize as normas do seu município em um só lugar. Use os filtros para encontrar a legislação relevante para a sua trajetória.',
    summary:
      'Exemplo de plano de carreira. Os critérios e valores reais devem ser inseridos a partir da legislação municipal, com revisão humana e link para o documento.',
    tags: ['Carreira', 'Município'],
    level: 'Todos',
  });
  add('content', 'demo-conselho', {
    title: 'Decisões que chegam à sala de aula',
    type: 'Conselho de educação',
    sourceName: 'Referência: Conselho Nacional de Educação',
    sourceUrl: 'https://www.gov.br/mec/pt-br/cne',
    sourceDate: date,
    body: 'Resoluções e pareceres poderão ser acompanhados com explicações em linguagem simples, fontes e histórico de mudanças. Salve os temas de interesse e receba atualizações na sua central.',
    summary:
      'Modelo de publicação para decisões dos conselhos de educação. Este conteúdo não anuncia uma decisão real.',
    tags: ['Conselhos', 'Políticas'],
    level: 'Todos',
  });
  const schools = [
    ['Escola demonstrativa Centro', 'Municipal', -20.5386, -47.4009],
    ['Instituto demonstrativo Norte', 'Estadual', -20.5186, -47.3909],
    ['Colégio demonstrativo Sul', 'Privada', -20.5586, -47.4109],
  ];
  schools.forEach(([title, network, lat, lng], i) =>
    add('school', `demo-escola-${i}`, {
      title,
      network,
      lat,
      lng,
      city: 'Franca',
      state: 'SP',
      address: 'Endereço de demonstração — não é uma instituição real',
      cnae: '8513900',
      body: 'Registro fictício para testar mapa, filtros e favoritos. A presença no mapa não indica vaga aberta.',
      sourceName: 'Base demonstrativa',
      sourceUrl:
        'https://www.gov.br/inep/pt-br/acesso-a-informacao/dados-abertos/microdados/censo-escolar',
      sourceDate: date,
    }),
  );
  const future = (n) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);
  ['Concurso público', 'Processo simplificado', 'Seleção privada', 'Cadastro de reserva'].forEach(
    (type, i) =>
      add('opportunity', `demo-edital-${i}`, {
        title: `${type} · exemplo de oportunidade`,
        type,
        city: 'Franca',
        state: 'SP',
        discipline: ['Matemática', 'História', 'Português', 'Todas'][i],
        level: 'Ensino Fundamental',
        education: 'Licenciatura',
        body: 'Oportunidade fictícia para demonstrar o buscador e o calendário. Não há inscrições reais neste exemplo.',
        requirements:
          'Exemplo: licenciatura na área de atuação. Consulte sempre o edital oficial de uma seleção real.',
        documents: 'Documentação definida pelo edital.',
        opens: future(i === 3 ? 10 : -5),
        closes: future(20 + i * 7),
        examDate: future(60),
        sourceName: 'Edital demonstrativo',
        sourceUrl: 'https://www.franca.sp.gov.br/',
        sourceDate: date,
        lat: -20.5386,
        lng: -47.4009,
      }),
  );
  const surveys = [
    [
      'Enquete',
      'O que precisa de mais atenção na educação?',
      'Qual tema você considera prioritário?',
      ['Valorização', 'Infraestrutura', 'Autonomia'],
    ],
    [
      'Jornada',
      'Quanto do seu trabalho acontece fora da escola?',
      'Horas semanais de trabalho fora da escola',
      ['Até 5 horas', 'De 6 a 10 horas', 'Mais de 10 horas'],
    ],
    [
      'Vínculos',
      'Como é o seu vínculo de trabalho?',
      'Seu principal vínculo profissional',
      ['Efetivo', 'Temporário', 'CLT', 'Outro'],
    ],
    [
      'Remuneração',
      'Como você percebe sua remuneração?',
      'Como avalia a remuneração em relação ao trabalho?',
      ['Adequada', 'Parcialmente adequada', 'Insuficiente'],
    ],
    [
      'Infraestrutura',
      'De que condições a sua escola precisa?',
      'Como avalia a infraestrutura da escola?',
      ['Adequada', 'Precisa de melhorias', 'Insuficiente'],
    ],
    [
      'Materiais didáticos',
      'Qual é o espaço da sua autoria?',
      'Você consegue adaptar os materiais didáticos?',
      ['Sempre', 'Às vezes', 'Raramente'],
    ],
    [
      'Inteligência artificial',
      'IA e autonomia: como você vê essa relação?',
      'Como a IA participa do seu trabalho?',
      ['Não utilizo', 'Uso como apoio', 'Uso frequentemente'],
    ],
  ];
  surveys.forEach(([topic, title, label, options], i) =>
    add('survey', `demo-pesquisa-${i}`, {
      title,
      topic,
      body: 'Instrumento demonstrativo. As respostas deste ambiente servem somente para testar o funcionamento.',
      purpose:
        'Testar a coleta e a devolutiva agregada de experiências docentes, sem vínculo com a conta e sem publicar relatos individuais.',
      questions: [{ id: 'principal', label, options }],
    }),
  );
  db.prepare('INSERT INTO metadata VALUES(?,?)').run('demo-seeded-v1', now());
}
