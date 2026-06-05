# ASYNCFLOW

**ASYNCFLOW** é uma aplicação web de alta fidelidade para gestão de projetos ágeis (no estilo Kanban/Jira). O projeto foi desenhado sob uma arquitetura modular robusta, com separação estrita entre a camada de dados, lógica de negócio e interface de utilizador.

---

## 🛠️ Tecnologias e Ferramentas

- **Backend (API)**: C# (.NET 8 Web API), Entity Framework Core (EF Core), JWT Bearer Authentication.
- **Frontend (Interface)**: React 19, TypeScript, Tailwind CSS v4 (estilização moderna e Glassmorphism), Lucide React.
- **Base de Dados**: PostgreSQL 15.
- **Orquestração e Servidores**: Docker, Docker Compose, Nginx.

---

## 📁 Estrutura do Projeto

O repositório está dividido em dois blocos principais:

```
/
├── backend/                  # Código fonte do servidor C# .NET 8
│   ├── AsyncFlow.sln         # Solução do Visual Studio / Rider
│   ├── AsyncFlow.Core/       # Entidades de Domínio e DTOs
│   ├── AsyncFlow.Infrastructure/  # DbContext do EF Core, Migrações e lógica do Postgres
│   └── AsyncFlow.API/        # Controladores (Controllers) da API e Filtros RBAC
│
├── frontend/                 # Aplicação SPA React (Vite + TS)
│   ├── src/components/       # Componentes visuais (Kanban, Issue Drawer, Settings)
│   ├── src/context/          # Contexto de Autenticação global
│   ├── src/index.css         # Design System com Tailwind CSS v4
│   ├── src/api.ts            # Cliente HTTP integrado com injeção de JWT
│   └── nginx.conf            # Configuração de rotas estáticas e proxy da API no Nginx
│
└── docker-compose.yml        # Orquestrador local dos containers
```

---

## ✨ Funcionalidades Principais

1. **Autenticação Segura & RBAC**:
   - Registro e login autenticados por tokens JWT armazenados com segurança.
   - **Role-Based Access Control (RBAC)** customizado no backend ([ProjectAuthorizeFilter]) com níveis de acesso: `Administrator`, `Manager` e `Normal`.
   - Menus e permissões de projetos e equipes no frontend adaptam-se dinamicamente conforme o papel do utilizador.
2. **Quadro Kanban Interativo**:
   - Organizado em 3 colunas clássicas: `To Do`, `In Progress` e `Done`.
   - Transições rápidas e performáticas usando **HTML5 Drag & Drop** nativo.
   - Filtro debounced de buscas por texto e opção "Only My Issues" (apenas minhas tarefas).
3. **Painel de Detalhes da Issue (Drawer)**:
   - Visualização e edição rápida dos dados da tarefa diretamente num painel deslizante.
   - Linha do tempo cronológica de comentários associados à tarefa com fotos de perfil.
4. **Gerador Segura de Chaves Sequenciais**:
   - Geração transacional no Postgres para garantir chaves únicas sequenciais (ex: `PROJ-1`, `PROJ-2`) mesmo sob solicitações simultâneas.

---

## 🚀 Como Executar o Projeto

### Pré-requisitos
- Ter o [Docker Desktop](https://www.docker.com/products/docker-desktop/) instalado e em execução no sistema.

### Método Recomendado (Docker Compose)
1. Certifique-se de que o **Docker Desktop** está em execução.
2. Abra um terminal na raiz do projeto e execute o comando:
   ```bash
   docker compose up -d --build
   ```
3. Aceda à aplicação no browser:
   - **Frontend**: [http://localhost:3000](http://localhost:3000)
   - **Documentação da API (Swagger)**: [http://localhost:5000/swagger/index.html](http://localhost:5000/swagger/index.html)

---

## 🔒 Utilizadores Seed (Demonstração)

Para facilitar a avaliação da segurança de papéis (RBAC) e teste das permissões, a base de dados vem pré-semeada com três utilizadores padrão:

| Utilizador (Email) | Palavra-passe | Papel no Projeto Padrão |
| :--- | :--- | :--- |
| `admin@asyncflow.com` | `admin123` | **Administrator** |
| `manager@asyncflow.com` | `manager123` | **Manager** |
| `user@asyncflow.com` | `user123` | **Normal** |

*Nota: Durante o desenvolvimento local (`npm run dev`), uma barra rápida de impersonação estará ativa no cabeçalho e na tela de login para permitir alternar entre estas contas sem necessidade de fazer logout manual. Em produção e builds finais (Docker), esta barra é ocultada automaticamente por motivos de segurança.*
