# Firestore - Fase 1

Este arquivo documenta o modelo assumido para a fase 1 do sistema Boca a Boca.

## Colecoes

### usuarios
Documento por usuario.

Campos:
- nome: string
- email: string (normalizado em lowercase)
- perfil: "cliente" | "vendedor" | "admin"
- passwordHash: string (SHA-256 em hex)
- fotoPerfilBase64: string opcional
- createdAt: number (Date.now)
- updatedAt: number (Date.now)

### servicos
Documento por servico.

Campos:
- vendedorId: string (id de usuarios)
- titulo: string
- categoria: string
- descricao: string
- fotoServicoBase64: string opcional
- createdAt: number
- updatedAt: number

Regra de negocio em app:
- 1 vendedor = maximo de 1 servico

### conversas
Documento por conversa cliente-vendedor sobre um servico.
ID adotado: clienteId_servicoId

Campos:
- clienteId: string
- vendedorId: string
- servicoId: string
- createdAt: number
- updatedAt: number
- lastMessageAt: number

Subcolecao:
- conversas/{conversaId}/mensagens

Campos de mensagens:
- remetenteId: string
- texto: string
- createdAt: number

## Indices sugeridos

Se o console do Firebase pedir indice, criar estes:
- servicos: vendedorId ASC, updatedAt DESC
- conversas: clienteId ASC, lastMessageAt DESC
- conversas: vendedorId ASC, lastMessageAt DESC

## Regras de seguranca (minimo recomendado)

Como a fase 1 nao usa Firebase Auth, as regras fortes de identidade ficam limitadas.
Para reduzir risco em ambiente de teste, use:
- leitura publica em servicos
- escrita em usuarios/servicos/conversas apenas em ambiente de desenvolvimento controlado

Para producao, migrar para Firebase Auth e Security Rules por uid antes de publicar.

## Fluxo implementado na fase 1

- Cadastro por email com validacao de duplicidade em usuarios
- Login por comparacao de hash da senha
- Perfil editavel com troca cliente/vendedor
- Upload de foto de perfil e foto do servico em base64 comprimido
- CRUD de 1 servico por vendedor
- Lista publica de servicos na home
- Chat assincrono por conversa com mensagens em subcolecao
- Loading global e mensagens de erro/sucesso no front
