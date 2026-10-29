// This module uses only the public aggregates already displayed. No API or AI call.
export async function buildStatisticsPdf(report) {
  const { jsPDF } = await import('jspdf');
  const pdf = new jsPDF({ unit: 'mm', format: 'a4' });
  pdf.setProperties({
    title: 'Voz do Professor - Relatório estatístico',
    author: 'Voz do Professor',
    subject: `${report.from} a ${report.to}`,
  });
  const width = 174,
    left = 18;
  let y = 0;
  const clean = (value) =>
    String(value ?? '')
      .replace(/[–—]/g, '-')
      .replace(/→/g, '>')
      .replace(/[\u200B-\u200D]/g, '');
  const newPage = () => {
    if (y) pdf.addPage();
    pdf.setFillColor(28, 28, 33);
    pdf.rect(0, 0, 210, 24, 'F');
    pdf.setTextColor(255, 255, 255);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(13);
    pdf.text('VOZ DO PROFESSOR', left, 15);
    y = 36;
  };
  const room = (n) => {
    if (y + n > 275) newPage();
  };
  const text = (value, { size = 10, bold = false, gap = 4 } = {}) => {
    pdf.setFont('helvetica', bold ? 'bold' : 'normal');
    pdf.setFontSize(size);
    pdf.setTextColor(40, 40, 48);
    const lines = pdf.splitTextToSize(clean(value), width);
    for (const line of lines) {
      room(size * 0.45 + 2);
      pdf.setFont('helvetica', bold ? 'bold' : 'normal');
      pdf.setFontSize(size);
      pdf.setTextColor(40, 40, 48);
      pdf.text(line, left, y);
      y += size * 0.45 + 1;
    }
    y += gap;
  };
  newPage();
  text('Relatório de estatísticas', { size: 21, bold: true, gap: 6 });
  text(`Período: ${report.from} a ${report.to}`, { size: 12, bold: true });
  text(
    `Estado: ${report.state || 'Todos / nacional'} | Categoria do catálogo: ${report.category || 'Todas'}`,
  );
  text(
    `Gerado em ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })} (Brasília).`,
  );
  text(
    `${report.total} publicações | ${report.stories} relatos | ${report.surveys} instrumentos de pesquisa publicados`,
    { bold: true, gap: 8 },
  );
  const groups = [
    ['Composição do catálogo', report.types],
    ['Publicações por mês', report.timeline],
    ['Localidade das publicações', report.places],
    ['Assuntos mais consultados com IA', report.queryTopics],
    ['Estados informados nas consultas', report.queryPlaces],
    ['Consultas por mês', report.queryTimeline],
  ];
  for (const [title, values] of groups) {
    room(35);
    text(title, { size: 13, bold: true });
    if (!values.length) {
      text('Sem dados suficientes para exibição. Ausência não significa zero.');
      continue;
    }
    const max = Math.max(1, ...values.map((v) => v.value));
    const total = values.reduce((sum, v) => sum + v.value, 0);
    for (const row of values) {
      if (y + 22 > 275) {
        newPage();
        text(`${title} (continuação)`, { size: 13, bold: true });
      }
      text(
        `${row.label}: ${row.value}${title === 'Composição do catálogo' && total ? ` (${((row.value / total) * 100).toFixed(1)}%)` : ''}`,
        { gap: 0 },
      );
      pdf.setFillColor(235, 235, 239);
      pdf.rect(left, y, width, 2.5, 'F');
      pdf.setFillColor(215, 53, 65);
      if (row.value) pdf.rect(left, y, (width * row.value) / max, 2.5, 'F');
      y += 8;
    }
    y += 4;
  }
  if (report.insight) {
    room(35);
    text('Leitura dos números por IA', { size: 13, bold: true });
    text(report.insight.summary);
    text(`${report.insight.model} | ${report.insight.generatedAt}`, { size: 9 });
  }
  room(50);
  text('Fonte, metodologia e limites', { size: 13, bold: true });
  text(
    'Fonte: catálogo público e contadores agregados do Voz do Professor. Publicações são contadas pela entrada no site; consultas pelo mês de Brasília. Categoria filtra apenas as publicações, não os temas das consultas. Estado filtra ambos; registros nacionais sem estado não são atribuídos a um estado específico.',
  );
  text(
    'Grupos de consultas com menos de cinco registros não aparecem. Os números não são visitantes únicos nem uma amostra representativa dos professores. A participação estatística era opcional antes de 29/10/2026; desde a versão 3.2, a ciência da contagem é requisito da consulta com IA. Relatos e pesquisas são contados como publicações, sem análise de mensagens privadas ou formulários enviados por e-mail.',
  );
  text(
    'Este relatório reproduz os filtros e totais públicos exibidos. Não contém nome, foto, cidade, pergunta, histórico pessoal ou dados de administração. Gerar o PDF não aciona a IA.',
  );
  const url = 'https://amerindia.alwaysdata.net/voz-do-professor/#/estatisticas';
  room(16);
  pdf.setFontSize(9);
  pdf.setTextColor(160, 35, 45);
  pdf.textWithLink('Abrir as estatísticas e consultar dados atualizados', left, y, { url });
  y += 8;
  for (let page = 1; page <= pdf.getNumberOfPages(); page++) {
    pdf.setPage(page);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8);
    pdf.setTextColor(95, 95, 105);
    pdf.text(`Voz do Professor | ${report.from} a ${report.to}`, left, 287);
    pdf.text(`${page} / ${pdf.getNumberOfPages()}`, 192, 287, { align: 'right' });
  }
  return pdf;
}
