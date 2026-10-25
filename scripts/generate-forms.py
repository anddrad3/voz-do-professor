"""Generate the offline, fillable contact form. Never sends data or adds PDF actions."""

import argparse
import re
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas
from pypdf import PdfReader


ROOT = Path(__file__).resolve().parent.parent
RED = colors.HexColor("#dc2626")
INK = colors.HexColor("#18181b")
MUTED = colors.HexColor("#52525b")
LINE = colors.HexColor("#d4d4d8")
PALE = colors.HexColor("#fafafa")
EXPECTED = {"tipo_pedido", "nome_opcional", "publicar_anonimamente", "mensagem", "publicacao_referencia", "autorizacao_relato"}


def generate(output: Path, email: str) -> None:
    if not re.fullmatch(r"[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}", email):
        raise ValueError("Informe um endereço de e-mail válido.")
    if len(email) > 65:
        raise ValueError("Use um endereço de e-mail de até 65 caracteres para preservar o layout.")
    output.parent.mkdir(parents=True, exist_ok=True)
    c = canvas.Canvas(str(output), pagesize=A4, pageCompression=1)
    c.setTitle("Voz do Professor - formulário offline preenchível")
    c.setAuthor("Voz do Professor")
    c.setSubject("Relato, sugestão, remoção ou correção, sem envio ao site")
    form = c.acroForm

    def text(x, y, value, size=10, font="Helvetica", color=INK):
        c.setFillColor(color)
        c.setFont(font, size)
        c.drawString(x, y, value)

    def label(y, number, title):
        text(42, y, number, 10, "Helvetica-Bold", RED)
        text(64, y, title, 11, "Helvetica-Bold")

    def field(name, tooltip, y, height, maxlen, multiline=False):
        form.textfield(name=name, tooltip=tooltip, x=42, y=y, width=511,
                       height=height, borderStyle="solid", borderWidth=0.7,
                       borderColor=LINE, fillColor=PALE, textColor=INK,
                       fontName="Helvetica", fontSize=10, maxlen=maxlen,
                       fieldFlags="multiline" if multiline else "", forceBorder=True)

    def check(name, tooltip, x, y):
        form.checkbox(name=name, tooltip=tooltip, x=x, y=y, size=12,
                      checked=False, buttonStyle="check", borderWidth=0.8,
                      borderColor=MUTED, fillColor=colors.white, textColor=RED,
                      forceBorder=True)

    c.setFillColor(RED)
    c.rect(42, 789, 32, 4, stroke=0, fill=1)
    text(84, 786, "FORMULÁRIO OFFLINE", 10, "Helvetica-Bold", RED)
    text(42, 751, "Voz do Professor", 27, "Helvetica-Bold")
    text(42, 730, "Sua mensagem, enviada por você. Nenhum envio pelo site.", 11, color=MUTED)

    c.setFillColor(PALE)
    c.setStrokeColor(LINE)
    c.roundRect(42, 619, 511, 94, 8, stroke=1, fill=1)
    text(56, 694, "COMO ENVIAR", 9, "Helvetica-Bold", RED)
    text(56, 677, "1. Baixe, preencha e salve este PDF no seu dispositivo.", 10)
    text(56, 661, "2. Abra seu e-mail e anexe o arquivo salvo a uma nova mensagem.", 10)
    text(56, 644, "Destino:", 10, "Helvetica-Bold")
    text(101, 644, email, 10, "Helvetica-Bold")
    if email.lower().endswith(".invalid"):
        text(56, 630, "EXEMPLO NÃO FUNCIONAL: aguarde o endereço real divulgado pelo site.", 8, "Helvetica-Bold", RED)
    else:
        text(56, 630, "O site não recebe este formulário; o envio é feito pelo seu serviço de e-mail.", 8, color=MUTED)

    label(596, "01", "O que você deseja? Selecione uma opção.")
    for value, caption, x, y in [
        ("relato", "Enviar relato", 42, 574),
        ("sugestao", "Enviar sugestão", 290, 574),
        ("remocao_correcao", "Remover ou corrigir publicação", 42, 553),
        ("outros", "Outro assunto", 290, 553),
    ]:
        form.radio(name="tipo_pedido", tooltip="Tipo de pedido", value=value,
                   selected=False, x=x, y=y, size=12, buttonStyle="circle",
                   borderColor=MUTED, fillColor=colors.white, textColor=RED,
                   borderWidth=0.8, forceBorder=True)
        text(x + 18, y + 2, caption, 10)

    label(530, "02", "Nome ou pseudônimo (opcional)")
    field("nome_opcional", "Nome ou pseudônimo opcional; pode deixar em branco", 497, 25, 100)
    check("publicar_anonimamente", "Solicito publicação sem nome; somente para relatos", 42, 477)
    text(60, 479, "Quero que meu relato seja publicado sem nome.", 10)
    text(42, 463, "Sem nome informado, a publicação também será anônima.", 8.5, color=MUTED)

    label(442, "03", "Sua mensagem")
    text(42, 426, "Escreva o relato, a sugestão ou o que deseja remover/corrigir. Até 1.500 caracteres.", 8.5, color=MUTED)
    field("mensagem", "Sua mensagem (até 1500 caracteres)", 247, 169, 1500, True)

    label(226, "04", "Link ou código da publicação (para remoção/correção)")
    field("publicacao_referencia", "Link ou código da publicação a remover ou corrigir", 192, 25, 220)

    check("autorizacao_relato", "Autorizo publicar somente o relato, respeitando a opção de anonimato", 42, 168)
    text(60, 171, "Se escolhi enviar um relato, autorizo a publicação do texto após revisão,", 9)
    text(60, 158, "respeitando minha opção de anonimato. Meu contato não será publicado.", 9)
    text(42, 140, "Sugestões, pedidos de remoção/correção e outros assuntos não autorizam publicação.", 8.5, color=MUTED)

    c.setStrokeColor(LINE)
    c.line(42, 126, 553, 126)
    text(42, 110, "ANTES DE ENVIAR", 9, "Helvetica-Bold", RED)
    text(42, 94, "Evite dados de alunos, de terceiros e detalhes que identifiquem você, caso prefira anonimato.", 8.5)
    text(42, 81, "Anonimato na publicação não oculta seu e-mail do administrador nem do provedor de e-mail.", 8.5)
    text(42, 68, "Não há campo de e-mail: o contato será o remetente da mensagem que você enviar.", 8.5)
    text(42, 41, "Preencha localmente. Confira o arquivo salvo antes de anexar. Guarde uma cópia do envio.", 8, color=MUTED)
    text(539, 41, "1/1", 8, color=MUTED)
    c.save()
    validate(output)


def validate(output: Path) -> None:
    reader = PdfReader(output)
    fields = reader.get_fields() or {}
    if set(fields) != EXPECTED:
        raise AssertionError(f"Campos inesperados: {set(fields) ^ EXPECTED}")
    widgets = [annotation.get_object() for page in reader.pages
               for annotation in page.get("/Annots", [])
               if annotation.get_object().get("/Subtype") == "/Widget"]
    if len(widgets) != 9:
        raise AssertionError(f"Esperados 9 widgets; recebidos {len(widgets)}")
    for widget in widgets:
        parent = widget.get("/Parent")
        field = parent.get_object() if parent else widget
        if field.get("/T") not in EXPECTED or not widget.get("/AP", {}).get("/N"):
            raise AssertionError("Widget sem campo canônico ou aparência")
        if "/A" in widget or "/AA" in widget:
            raise AssertionError("O formulário não deve conter ações de envio")
    root = reader.trailer["/Root"]
    if "/OpenAction" in root or "/JavaScript" in root.get("/Names", {}):
        raise AssertionError("O PDF não deve conter scripts")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--email", default="relatos@exemplo.invalid")
    parser.add_argument("--output", type=Path, default=ROOT / "public/formularios/voz-do-professor.pdf")
    args = parser.parse_args()
    generate(args.output, args.email)
    print(f"PDF preenchível validado: {args.output}")
