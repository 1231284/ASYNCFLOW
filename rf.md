# Requisitos Funcionais (RF) e Plano de Testes - ASYNCFLOW

Este documento descreve os Requisitos Funcionais reais implementados na aplicação **ASYNCFLOW** e apresenta o respetivo plano de testes detalhado para a sua validação.

---

## 📋 Requisitos Funcionais Implementados

### RF-01: Gestão Transicional de Estados de Tarefas (Workflow)
* **Descrição**: O sistema ASYNCFLOW disponibiliza um mecanismo dinâmico e reativo para a progressão do ciclo de vida das tarefas (issues), permitindo a transição do seu estado de forma síncrona entre as fases predefinidas do fluxo de trabalho: `To Do` (Pendente), `In Progress` (Em Curso) e `Done` (Concluído).
* **Mecanismos de Interação (Inputs)**: A transição de estado é desencadeada por dois métodos na interface do utilizador:
  1. **Arrastar e Largar (Drag-and-Drop)**: Movimentação do cartão representativo da tarefa entre as colunas do Quadro Kanban.
  2. **Alteração no Painel de Detalhes (Drawer)**: Modificação direta através de um componente dropdown de seleção na vista expandida da tarefa.
* **Regras de Negócio e Validação**:
  - O sistema valida no backend se o estado de destino enviado é um ID de estado válido cadastrado na base de dados (`To Do`, `In Progress` ou `Done`). As transições entre estes três estados são irrestritas.
  - Após a validação, a base de dados é atualizada imediatamente, refletindo as alterações em tempo real no quadro e no painel.

### RF-02: Criação e Parametrização de Itens de Trabalho (Issues)
* **Descrição**: O sistema ASYNCFLOW permite a instanciação e persistência de novas tarefas (issues) associadas a um projeto específico, mapeando metadados obrigatórios de categorização.
* **Campos Estruturados e Atributos**: O formulário de criação exige os seguintes dados:
  1. **Project**: Projeto associado.
  2. **Summary**: Resumo descritivo da issue (obrigatório).
  3. **Issue Type**: Tipo de item (`Task`, `Bug`, `Story`).
  4. **Description**: Detalhamento técnico (opcional).
  5. **Priority**: Escala de prioridade (`Low`, `Medium`, `High`, `Critical`).
* **Regras de Negócio e Validação**:
  - **Validação de Integridade**: O backend rejeita a criação caso o `Summary` esteja vazio ou caso os IDs de `IssueType`, `Priority` ou `TaskStatus` sejam inválidos.
  - **Indexação Sequencial Automática**: No momento de inserção (gerido sob transação no Postgres), o sistema gera e atribui uma chave sequencial única composta pelo acrónimo do projeto em maiúsculas e um número incremental (ex: `ASYNC-1`, `ASYNC-2`).
  - **Inicialização**: A issue é guardada com o estado e prioridade selecionados pelo utilizador (por padrão inicia em `To Do`).

### RF-03: Mecanismo de Atribuição e Gestão de Responsáveis (Assignee & Collaboration)
* **Descrição**: O sistema gere a propriedade operacional de cada tarefa, definindo os utilizadores associados à sua criação (Reporter) e à sua execução (Assignee).
* **Atributos**:
  1. **Reporter**: Identifica o utilizador que criou a issue. É atribuído automaticamente a partir da sessão autenticada e é imutável.
  2. **Assignee**: Dropdown dinâmico que vincula a tarefa a um membro do projeto. Pode ser inicializado como não atribuído (`Unassigned`).
* **Regras de Negócio e Validação**:
  - **Restrição de Escopo**: O utilizador selecionado como `Assignee` deve obrigatoriamente fazer parte da lista de participantes ativos do projeto.
  - **Reatribuição Dinâmica**: O responsável pode ser alterado a qualquer momento em qualquer etapa do workflow.

### RF-04: Painel de Interação e Histórico de Comentários (Collaboration & Comment Thread)
* **Descrição**: Permite aos utilizadores autenticados anexar comentários de texto a uma issue específica, consolidando um histórico cronológico de debate técnico.
* **Atributos**:
  - **Comment Body**: Texto inserido pelo utilizador.
  - **Author**: Utilizador autenticado da sessão (atribuído automaticamente pelo servidor).
  - **Timestamp**: Carimbo temporal em UTC gerado automaticamente pelo servidor na inserção.
* **Regras de Negócio e Validação**:
  - **Integridade**: Cada comentário está estritamente vinculado a uma issue válida por restrição de chave estrangeira (FK).
  - **Ordenação Cronológica**: Os comentários de uma issue são listados por ordem cronológica ascendente (do mais antigo para o mais recente).

### RF-05: Visualização Dinâmica e Interativa do Quadro Kanban
* **Descrição**: Interface bidimensional estruturada em colunas que agrega e renderiza visualmente as tarefas do projeto ativo.
* **Elementos**:
  - **Colunas**: Três raias fixas correspondentes aos estados: `To Do`, `In Progress` e `Done`.
  - **Cartões**: Exibem a chave da issue (ex: `ASYNC-1`), o tipo (com ícone correspondente), indicador visual de prioridade (código de cores) e avatar/nome do responsável (`Assignee`).
* **Regras de Negócio**:
  - Integração assíncrona com a API de mudança de estado (RF-01), atualizando a interface dinamicamente pós-confirmação do servidor.

### RF-06: Motor de Filtragem Rápida e Pesquisa Textual (Board Filtering)
* **Descrição**: Mecanismo reativo de filtros para facilitar a localização de tarefas.
* **Componentes**:
  1. **Barra de Pesquisa**: Campo de texto livre posicionado no topo.
  2. **Filtro "Only My Issues"**: Interruptor (toggle) rápido.
* **Regras de Negócio**:
  - **Pesquisa Reativa**: Filtra tarefas por correspondência parcial (*substring*) e insensível a maiúsculas/minúsculas (*case-insensitive*) no resumo (`Summary`) e na descrição (`Description`).
  - **Only My Issues**: Oculta todos os cartões cujo `AssigneeId` seja diferente do ID do utilizador autenticado.

### RF-07: Gestão de Participantes e Controlo de Acessos (RBAC)
* **Descrição**: Permite a administração de membros de equipa num projeto com base em três perfis de acesso no projeto:
  1. **Administrator**: Acesso total. Edita definições, remove o projeto, convida/remove membros e atualiza perfis.
  2. **Manager**: Permissões de gestão intermédias. Pode convidar/remover membros (não pode convidar administradores, nem remover outros administradores/managers). Não pode alterar papéis nem eliminar o projeto.
  3. **Normal**: Leitura e execução de tarefas. Pode criar issues, comentar e sair do projeto. Não gere membros nem definições.
* **Regras de Negócio e Validação**:
  - O backend valida o perfil do utilizador no contexto do projeto (`[ProjectAuthorize]`) antes de executar operações de escrita.
  - Botões administrativos (Adicionar Membro, Danger Zone de Eliminação) são ocultados/desativados no frontend para perfis sem a devida autoridade.

---

## 🧪 Plano de Testes de Validação (Testes de Aceitação)

Este plano descreve os testes manuais que comprovam a conformidade de cada requisito funcional.

### Teste para RF-01: Transições de Estado
1. **Procedimento (Drag & Drop)**: Iniciar sessão com qualquer utilizador, aceder ao Quadro Kanban de um projeto, arrastar uma tarefa da coluna `To Do` para `In Progress`.
   - *Resultado Esperado*: O cartão move-se com sucesso, a interface mostra um breve indicador de carregamento e o estado é persistido (ao recarregar a página, a tarefa mantém-se na coluna `In Progress`).
2. **Procedimento (Dropdown no Drawer)**: Clicar sobre uma tarefa para abrir o painel lateral de detalhes. No dropdown de estado, alterar de `In Progress` para `Done`.
   - *Resultado Esperado*: O estado é atualizado no painel e, ao fechar o painel, o cartão da tarefa foi movido automaticamente para a coluna `Done` no quadro.

### Teste para RF-02: Criação de Issues e Numeração Sequencial
1. **Procedimento**: No painel do projeto, clicar em "Create Issue". Deixar o campo "Summary" em branco e tentar submeter.
   - *Resultado Esperado*: A interface bloqueia a submissão ou a API retorna um erro indicando que o resumo é obrigatório.
2. **Procedimento**: Preencher o formulário com o Summary "Test Task 1", selecionar o tipo "Bug", prioridade "High" e submeter. Fazer o mesmo em seguida para "Test Task 2".
   - *Resultado Esperado*: As tarefas são criadas com sucesso. A primeira recebe a chave `SIGLA-1` (ex: `ASYNC-1`) e a segunda recebe `SIGLA-2` (ex: `ASYNC-2`). O estado inicial atribuído a ambas é `To Do`.

### Teste para RF-03: Atribuição de Responsáveis (Assignees)
1. **Procedimento**: Abrir a criação de uma issue. No dropdown de "Assignee", verificar os utilizadores disponíveis.
   - *Resultado Esperado*: Apenas são listados os utilizadores que pertencem formalmente à equipa do projeto (participantes). O criador é automaticamente registado como `Reporter` e este campo é meramente informativo (imutável).
2. **Procedimento**: Criar a tarefa sem responsável (selecionar `Unassigned`). Em seguida, abrir o painel de detalhes e atribuir a tarefa a um membro ativo.
   - *Resultado Esperado*: O cartão exibe a label correspondente a sem responsável e, após a atribuição, passa a exibir o nome/avatar do novo responsável.

### Teste para RF-04: Linha do Tempo de Comentários
1. **Procedimento**: Aceder aos detalhes de uma issue. Escrever o comentário "Primeiro comentário" e submeter. Em seguida, escrever "Segundo comentário" e submeter.
   - *Resultado Esperado*: Ambos os comentários são publicados com sucesso. O "Primeiro comentário" é listado no topo e o "Segundo comentário" logo abaixo (ordenação cronológica ascendente: do mais antigo para o mais recente). O nome e avatar do utilizador autenticado são exibidos como autor.

### Teste para RF-05: Apresentação do Kanban
1. **Procedimento**: Aceder ao Quadro Kanban.
   - *Resultado Esperado*: O ecrã está dividido em 3 colunas verticais (`To Do`, `In Progress`, `Done`). Cada cartão de tarefa apresenta o código sequencial único, ícone relativo ao tipo de issue, cor/rótulo de prioridade e responsável correspondente.

### Teste para RF-06: Filtros e Pesquisa em Tempo Real
1. **Procedimento**: No campo de pesquisa do quadro, introduzir um termo presente no resumo ou na descrição de apenas algumas tarefas (ex: "Bug").
   - *Resultado Esperado*: O quadro filtra os cartões reativamente, ocultando os que não contêm o termo introduzido (busca case-insensitive).
2. **Procedimento**: Clicar no toggle "Only My Issues" com o utilizador `user@asyncflow.com` ativo.
   - *Resultado Esperado*: Apenas são exibidos no quadro os cartões de tarefas que estão atribuídos a `user@asyncflow.com`.

### Teste para RF-07: Controlo de Permissões (RBAC)
1. **Procedimento (Perfil Normal)**: Impersonar ou iniciar sessão com o utilizador `user@asyncflow.com` (Normal) e aceder às Definições do Projeto (Settings).
   - *Resultado Esperado*: O utilizador visualiza as informações do projeto em modo de leitura. O botão de adicionar membros está oculto/desativado. Não tem acesso à "Danger Zone" para apagar o projeto.
2. **Procedimento (Perfil Manager)**: Iniciar sessão com `manager@asyncflow.com` (Manager) e aceder a Settings. Tentar convidar um novo membro com o papel "Administrator".
   - *Resultado Esperado*: O convite é bloqueado ou a API rejeita a operação com erro de permissões. O Manager só pode convidar membros normais ou managers, e só pode remover membros com perfil Normal.
3. **Procedimento (Perfil Administrator)**: Iniciar sessão com `admin@asyncflow.com` (Administrator) e aceder a Settings.
   - *Resultado Esperado*: O painel de gestão de equipa está totalmente desbloqueado (pode promover, demitir, convidar administradores e remover qualquer participante). A "Danger Zone" está disponível e permite eliminar o projeto.
