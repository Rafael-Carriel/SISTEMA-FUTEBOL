# Conta pessoal e acesso aos futebóis

Uma pessoa cria uma conta com e-mail, Google ou telefone. Depois do login,
em **Meus futebóis**, pode criar um futebol ou entrar usando um código.
Uma conta pode participar de vários grupos, com permissões diferentes em cada um.

## Papéis

- **Responsável:** criador do futebol, administrador permanente. Pode adicionar
  administradores. Transferência de responsabilidade não está implementada.
- **Administrador:** gerencia elenco, partidas, pagamentos e membros daquele grupo.
- **Jogador/membro:** consulta elenco, gols e assistências. Não modifica a gestão.

O registro de jogador no elenco é independente da conta de acesso. O administrador
pode cadastrar jogadores que não usam o aplicativo. Entrar com código não cria
automaticamente uma ficha de jogador e não associa estatísticas por nome ou e-mail.

## Entrada e convites

Na área de administradores, **Gerar código de entrada** cria um código compartilhável
de 12 caracteres, válido por sete dias. **Substituir código** revoga o anterior.
O código é digitado em **Meus futebóis → Entrar com código** após o login.
Ele sempre concede o papel de jogador; a promoção é feita pelo administrador.
Quem já participa mantém seu papel ao usar o código novamente.

Quem tiver o código poderá entrar. Ao remover alguém e desejar impedir seu retorno
com o mesmo código, substitua o código também. Não há lista de bloqueio nesta versão.
O fluxo anterior de convites por e-mail foi retirado da interface; não há envio de e-mails.

## Segurança e publicação

As regras usam o documento de membro de cada futebol como fonte de autorização,
sem privilégios administrativos globais. O criador não pode ser removido ou rebaixado.
Os códigos ficam separados dos metadados dos grupos; só administradores consultam
as configurações que mostram o código atual. A consulta direta de um código exige login.

Publicar o aplicativo exige publicar também `firestore.rules`. Os dados antigos
de `players`, `matches` e `payments` sem `orgId` precisam ser associados ao grupo correto
antes da publicação: a antiga permissão temporária para esses dados foi removida.
Também é necessário verificar se o criador de cada grupo antigo ainda possui seu
documento de membro com papel `admin`.

Em 17/09/2026, antes da publicação solicitada, foram associados ao único futebol
existente (`ddf`) 14 jogadores, uma partida e 14 pagamentos legados. O responsável
foi verificado como administrador. A atualização preservou os demais campos e usou
precondições de versão; a cópia de segurança está em
`work/pre-group-migration-2026-09-17.json`, fora do Git e do hosting.

A listagem atual de grupos ainda consulta os metadados de todas as organizações e
verifica a associação do usuário. Em escala maior, substituir por um índice de grupos
por usuário. Nenhuma lista de membros ou estatística fica pública por essa consulta.

## Monetização proposta (não implementada)

Cobrar por futebol, com acesso gratuito para os jogadores. O responsável administra
a assinatura do grupo, independentemente de quantas pessoas apenas acompanham.

- **Grátis:** elenco, partidas e estatísticas básicas.
- **Pro:** gestão financeira, relatórios, temporadas e personalização.
- **Organizadores:** vários futebóis e visão consolidada, numa etapa posterior.

Como hipótese inicial para entrevistas e teste de disposição a pagar, avaliar
R$ 29,90 por futebol/mês. Esse valor não é uma referência de mercado nem uma projeção
de rentabilidade. Validar custos e interesse com organizadores antes de fixar o preço.
Não restringir funções existentes ou cobrar usuários sem comunicar os planos.

Uma implementação futura precisa de checkout, confirmação de pagamento no servidor,
assinatura vinculada ao grupo e limites validados no servidor. A documentação de
[assinaturas SaaS da Stripe](https://docs.stripe.com/saas) descreve modelos de preço
fixo por plano; o provedor de pagamento ainda não foi escolhido.

## Validação

`npm test` executa testes locais. Para incluir os testes reais de regras, iniciar
o emulador com Java 21 disponível:

```sh
firebase emulators:exec --only firestore --project demo-na-trave-access "npm test"
```

Os testes de regras são ignorados quando o emulador não está disponível. Eles cobrem
criação atômica, entrada por código, isolamento entre grupos, acesso de consulta,
promoção de administradores e proteção do responsável.
