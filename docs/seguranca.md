# Segurança e limites da versão 3.3

Nenhum sistema conectado é invulnerável. Conteúdo público pode ser lido ou copiado por visitantes. Estas medidas protegem a administração, os segredos e a integridade da aplicação; não prometem impedir toda invasão ou coleta externa.

- Visitantes não criam conta nem enviam relatos, formulários, fotos originais ou respostas de pesquisa ao servidor. O aceite dos termos e a personalização são locais ao navegador. Limpar os dados locais remove o aceite.
- Fotos de perfil são decodificadas e recortadas no aparelho. O original e seus metadados não são enviados. O proprietário salva somente o JPEG reduzido, com validação de formato e tamanho, em rota autenticada.
- Relatos e fotos anexadas são recebidos pelo provedor de e-mail. O remetente é conhecido pelo responsável; anonimato na publicação não equivale a anonimato no e-mail.
- Administração exige senha com scrypt, TOTP com proteção contra repetição, sessão com prazo, cookie HttpOnly/Secure/SameSite Strict, CSRF e controle de origem. O nome de exibição não altera a senha ou o segundo fator.
- Credenciais, banco, backups e configuração ficam fora da pasta pública. Uma lista explícita de arquivos publicados também impede servir esses arquivos caso sejam copiados por engano ao build. Mapas de código e caminhos desconhecidos retornam 404 sem revelar caminhos internos.
- CSP restringe scripts e conexões à própria origem, impede enquadramento externo e objetos embutidos. Câmera, microfone, pagamentos e USB ficam bloqueados; localização é permitida somente ao próprio site e depende de autorização do navegador.
- Limitadores têm quantidade máxima de entradas em memória e expiração; o servidor limita tempo de cabeçalhos e recebimento do corpo. Isso reduz alguns abusos, mas não substitui proteção da hospedagem contra ataques distribuídos.
- IA mantém validação estrita de entradas, controle de origem, limite de tamanho, cotas persistentes, limite de concorrência e reserva financeira antes de chamar o provedor. Não foram ampliados os orçamentos. O aviso dos termos não é uma barreira de autenticação.
- Histórico público de versões é reduzido. Hashes, links de desenvolvimento e a matriz detalhada dos 66 requisitos são enviados somente pelo endpoint administrativo autenticado.
- Testes cobrem autenticação, segundo fator, CSRF, exposição de arquivos, filtros, matriz privada, limites financeiros e memória do limitador. A auditoria de dependências de produção em 29/10/2026 não apontou vulnerabilidades conhecidas; isso não prova ausência de falhas futuras ou desconhecidas.

O responsável deve manter dependências atualizadas, preservar backups privados, proteger o e-mail e as contas de hospedagem/GitHub com segundo fator e revisar periodicamente acessos e regras do provedor. A hospedagem pode manter logs próprios, e serviços externos seguem suas políticas. Remover informações do site não apaga automaticamente cópias já obtidas por terceiros.
