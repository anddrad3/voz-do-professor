# Formulário offline

`public/formularios/voz-do-professor.pdf` é um PDF AcroForm preenchível, de uma página, para relatos, sugestões, remoção/correção e outros pedidos. O arquivo não tem JavaScript, ações de envio nem conexão com o servidor. A pessoa baixa, preenche no dispositivo, salva e envia o anexo manualmente no próprio serviço de e-mail. O navegador e leitores de PDF variam no suporte a formulários: confira o arquivo salvo antes de enviá-lo.

O endereço `relatos@exemplo.invalid` é propositalmente não funcional. Não anuncie o recebimento de mensagens enquanto o endereço real não estiver configurado no site **e no PDF**. Para gerar novamente:

```powershell
python -m pip install reportlab pypdf
python scripts/generate-forms.py --email relatos@seu-dominio.com
```

O parâmetro `--output caminho/arquivo.pdf` permite escolher outro destino. Execute o comando na implantação sempre que trocar o endereço de atendimento. O script valida nomes canônicos dos seis campos, os nove widgets (quatro opções de um mesmo grupo), aparências e ausência de ações de envio.

O nome/pseudônimo é opcional, com uma opção explícita de publicar sem nome. Sem nome, a publicação também deve ser anônima. A autorização vale **somente para relatos**, nunca para sugestões, remoção/correção ou outros assuntos. A publicação não pode incluir contato nem o PDF original. Não há campo de e-mail: o contato é o remetente da mensagem recebida. O PDF explica que anonimato na publicação não esconde esse remetente do administrador nem do provedor de e-mail.

Campos estáveis: `tipo_pedido` (`relato`, `sugestao`, `remocao_correcao`, `outros`), `nome_opcional`, `publicar_anonimamente`, `mensagem`, `publicacao_referencia` e `autorizacao_relato`. As caixas de seleção usam `/Yes` quando marcadas. Nenhuma opção de consentimento vem marcada por padrão.

O texto da mensagem aceita até 1.500 caracteres. Mensagens maiores podem continuar no corpo do e-mail; verifique se o relato inteiro aparece antes de imprimir, pois campos de texto multilinha podem rolar internamente dependendo do leitor. Não inclua dados de alunos ou de terceiros.
