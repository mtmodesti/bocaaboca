# SPEC - Sistema Boca a Boca (SDD)

## Como usar este arquivo
1. Preencha as seções abaixo com o maximo de detalhes possivel.
2. Quando terminar, me peça: "leia o SPEC.md e implemente a fase 1".
3. Eu vou seguir exatamente esta especificacao para construir o sistema por etapas.

---

## 1) Visao do Produto
- Nome do sistema: Boca a boca
- Problema que resolve: Usuários conseguem se cadastrar como vendedor ou como cliente. Vendedores podem anunciar seu serviço (pedreiro, jardinagem, motoboy...) e clientes conseguem ver a lista dos serviços cadastrados e entrar em contato para contratar o serviço através de mensagens no próprio app. Dados pessoais dos vendedores e clientes não poderão ser divulgados.
- Publico-alvo: Pessoas que querem divular seus serviços e pessoas que querem contratar serviços de maneira rápida sem burocria
- Objetivo principal (1 frase): Conectar clientes e prestadores de serviços

## 2) Escopo
### Em escopo (o que vai existir)
- Tela inicial com lista dos serviços cadastrados.
- Tela de login para usuário entrar no sistema.
- Tela de cadastro onde o usuário define seu perfil como vendedor ou cliente.
- Usuário pode se cadastrar por e-mail e não pode existir duas contas com mesmo e-mail.
- Caso logado como vendedor, tela onde pode cadastrar seu serviço, máximo de 1.
- Caso logado como cliente, ao ver os serviços cadastrados, poderá enviar mensagens ao vendedor
- Todo vendedor deverá poder ver mensagens recebidas e poderá resposnder ao cliente em uma espécie de chat assincrono. Pode ser um array de mensagens para não ficar muito pesado e deverá ser exibido em forma de chat nos dois lados.
- Perfil vendedor poderá remover seus serviços cadastrados, e também editar.
- Deverá ser possível upload de uma foto perfil, que deverá ser salva no perfil do cliente no firebase no formato mais leve, pode converter para base 64 ou qualquer formato que seja leve e possível recuperar para exibir depois.
- tela onde o usuário poderá editar seus dados de registro, e também o seu perfil de um modelo para outro.
- Passwords deverão sempre ser enviados de forma criptografada para não aparecer no payload
- Colocar modal de loading e informações de erro em funções assincronas
- Usuário cadastrado como cliente ou venderdor não poderá criar outro registro de perfil diferente, pois e-mail será repetido
- Caso vendedor, deverá poder também salvar 1 foto do seu serviço que será salva igual a foto de perfil, de forma leve

### Fora de escopo (o que NAO vai existir agora)
- 
- 
- 

## 3) Requisitos Funcionais
Liste cada requisito com identificador unico.

- RF-001: e-mail de registro do usuário
- RF-002: criptografia em dados sensíveis

## 4) Requisitos Nao Funcionais
- RNF-001 (Performance):
- RNF-002 (Seguranca):
- RNF-003 (Usabilidade):
- RNF-004 (Disponibilidade):
- RNF-005 (LGPD/Privacidade):

## 5) Perfis de Usuario e Permissoes
### Perfis
- Admin:Consegue visualizar e acessar e editar todas funções
- Usuario comum: Cliente e vendedor, edita somente suas próprias informações
- Convidado (se houver): Consegue apenas visualizar os serviços cadastrados na tela inicial

### Matriz de permissao (resumo)
- Quem pode criar:Pessoar com perfil de vendedor
- Quem pode editar: Apenas o própio dono do perfil e admin
- Quem pode excluir: dono do perfil e admin
- Quem pode visualizar: Todos

## 6) Fluxos Principais (User Stories)
Use formato: "Como [perfil], quero [acao], para [beneficio]".

- US-001:
- Criterios de aceite:
  - Dado que entro no site deslogado
  - Quando acessar a tela inicial
  - Entao consigo ver todos serviços cadastrados

- US-002:
- Criterios de aceite:
  - Dado que entrei como perfil de prestador de serviço
  - Quando acessar o site, poderei entrar em uma seção onde irei cadastrar meu serviço
  - Entao deverá ser exibido na lista de serviços disponíveis do site

- US-003:
- Criterios de aceite:
  - Dado que entrei como perfil de cliente
  - Quando acessar o site, enviar mensagens ao prestador de serviços
  - Entao será possível esclarecer dúvidas

- US-004
- Criterios de aceite:
    - Dado que entrei como perfil de prestador de serviço
    - Quando acessar meu perfil e existir alguma mensagem de cliente
    - Então conseguirei responder de forma privada e direta o mesmo

## 7) Modelo de Dados (Firestore)
Pode decidir como achar melhor

### Colecao: usuarios
crie conforme achar necessário

### Outras colecoes
crie conforme achar necessário

### Regras importantes
- Campos obrigatorios: password e email
- Indices necessarios: você decide
- Relacionamentos (se houver):

## 8) Regras de Negocio
- RN-001:
- RN-002:
- RN-003:

## 9) Telas e Experiencia
- Tela 1 (nome):
  - Objetivo:
  - Componentes:
  - Acoes do usuario:
- Tela 2 (nome):
  - Objetivo:
  - Componentes:
  - Acoes do usuario:

## 10) Integracoes
- Firebase Auth: nao
- Firestore: sim
- Storage: nao
- Cloud Functions: nao
- APIs externas:

## 12) Definition of Done
Uma fase so termina quando:
- [x] Build sem erros
- [x] Fluxos principais funcionando
- [x] Validacoes implementadas
- [x] Tratamento de erro visivel no front
- [ ] Testes minimos executados

"Leia o SPEC.md e implemente a Fase 1 completa. Se faltar informacao, assuma a opcao mais simples e documente no final."