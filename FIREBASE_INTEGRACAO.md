# Integração Firebase

O projeto homephysio-virtualter usa Firestore Standard em southamerica-east1. O fluxo usa Authentication no painel e Firestore nos dois aplicativos, sem Cloud Functions.

1. O fisioterapeuta entra no painel e confirma o e-mail.
2. Em Pacientes, cadastra o nome e seleciona o cadastro.
3. Em Terapia, escolhe jogo, métricas e intensidade e ajusta os parâmetros. Salvar produz o primeiro código ou atualiza a terapia mantendo o código atual.
4. O paciente digita ou cola o código no cliente dos jogos. O cliente verifica o código no servidor antes de iniciar a sessão.
5. Em Gerar novo código, o fisioterapeuta confirma a substituição. A transação troca o código e invalida o antigo. O cliente também verifica o acesso durante a sessão.

O painel sorteia seis caracteres sem `0O6G4A1IL` e reserva o código em uma transação do Firestore. A reserva é única entre todos os profissionais. Cada conta tem seu próprio cadastro de pacientes. Códigos de seis caracteres já emitidos continuam válidos até serem substituídos, inclusive ao salvar novamente uma terapia com código fora do novo alfabeto. O documento acessível pelo código contém os parâmetros do jogo e identificadores técnicos. Use títulos sem nomes ou outros dados pessoais. Resultados permanecem no dispositivo. Registros locais da demonstração não são migrados automaticamente.

O pacote em packages/contracts é instalado pelos dois projetos. Mantenha homephysio-doc e virtualter-3 como pastas irmãs para instalar as dependências do painel.

As regras exigem e-mail verificado para gerenciar cadastros. Isso verifica o endereço da conta. A habilitação profissional ainda precisa de um processo próprio. Revise as regras e o tratamento dos dados antes do uso com pacientes reais.

