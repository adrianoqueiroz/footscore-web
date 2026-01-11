# ⚽ FootScore

Web App mobile-first para registro de palpites esportivos entre amigos com design premium em Dark Mode.

## 🚀 Tecnologias

- **React 18** + **TypeScript**
- **Vite** - Build tool
- **Tailwind CSS** - Estilização
- **Framer Motion** - Animações
- **Lucide React** - Ícones
- **date-fns** - Manipulação de datas
- **@react-oauth/google** - Integração Google OAuth

## 📦 Instalação

```bash
npm install
```

## ⚙️ Configuração

### Ambiente de Desenvolvimento

1. **Clone o repositório:**
```bash
git clone <repository-url>
cd bolao
```

2. **Configure o ambiente de desenvolvimento:**
```bash
# Configurar para desenvolvimento local
./switch-env.sh dev
```

3. **Verifique a configuração:**
```bash
./switch-env.sh status
```

4. **Instale dependências e execute:**
```bash
npm install
npm run dev
```

### Ambiente de Produção

1. Atualize a URL da API no arquivo `env.production`:
```bash
# Edite env.production e substitua:
# VITE_API_BASE_URL=https://seuservico.azurewebsites.net/api
```

2. Configure para produção:
```bash
./switch-env.sh prod
```

### Alternar entre Ambientes

```bash
# Ver configuração atual
./switch-env.sh status

# Desenvolvimento
./switch-env.sh dev

# Produção
./switch-env.sh prod
```

### Configuração Manual (Alternativa)

1. **Arquivos de ambiente incluídos no repositório:**
- `env.development` - Configuração completa para desenvolvimento
- `env.production` - Template para produção (atualize a URL da API)

2. Crie o arquivo `.env` usando os templates:
```bash
# Para desenvolvimento
cp env.development .env

# Para produção (após atualizar a URL)
cp env.production .env
```

3. Configure as variáveis de ambiente no arquivo `.env`:
```env
VITE_API_BASE_URL=http://localhost:3000/api
VITE_GOOGLE_CLIENT_ID=seu-google-client-id-aqui
```

3. Para obter o Google Client ID:
   - Acesse o [Google Cloud Console](https://console.cloud.google.com/)
   - Crie um novo projeto ou selecione um existente
   - Ative a API "Google+ API" ou "Google Identity Services"
   - Vá em "Credenciais" → "Criar credenciais" → "ID do cliente OAuth"
   - Selecione "Aplicativo da Web"
   - Adicione `http://localhost:5173` nas "Origens JavaScript autorizadas"
   - Copie o Client ID e cole no arquivo `.env`

## 🏃 Executar

```bash
npm run dev
```

O app estará disponível em `http://localhost:5173`

## 🚀 Deploy Automatizado via GitHub Actions

O projeto está configurado para fazer deploy automático no Azure Storage Account sempre que houver push na branch `main`.

### Configuração Inicial (Uma vez apenas)

1. **Criar Service Principal no Azure:**
   - Azure Portal → Azure Active Directory → App registrations → New registration
   - Nome: `github-actions-frontend-storage`
   - Criar Client Secret em Certificates & secrets
   - Adicionar role **Storage Blob Data Contributor** no Storage Account (Access Control → IAM)

2. **Configurar Secrets no GitHub:**
   - Acesse: `Settings` → `Secrets and variables` → `Actions`
   - Adicione os seguintes secrets:
     - `AZURE_CLIENT_ID` - Application (client) ID da Service Principal
     - `AZURE_TENANT_ID` - Tenant ID do Azure
     - `AZURE_SUBSCRIPTION_ID` - Subscription ID do Azure
     - `AZURE_STORAGE_ACCOUNT_NAME` - Nome do Storage Account

3. **Verificar Container $web:**
   - Deve existir no Storage Account com acesso público habilitado (Blob)

### O que o workflow faz automaticamente:

- ✅ Copia `env.production` para `.env`
- ✅ Instala dependências (`npm ci`)
- ✅ Faz build da aplicação (`npm run build`)
- ✅ Limpa arquivos antigos do container `$web`
- ✅ Faz upload dos arquivos da pasta `dist/` para o Azure Storage Account

### Deploy Manual (se necessário)

Se precisar fazer deploy manual:

1. **Fazer build da aplicação:**
```bash
cp env.production .env
npm run build
```

2. **Fazer upload da pasta `dist/` para o Azure Storage Account:**
   - Acesse o portal do Azure
   - Vá para seu Storage Account
   - Clique em "Data storage" → "Containers" → `$web`
   - Delete todos os arquivos antigos
   - Faça upload de todos os arquivos da pasta `dist/`

3. **Arquivos que devem ser enviados:**
   - `dist/index.html`
   - `dist/manifest.json`
   - `dist/sw.js`
   - `dist/assets/*` (todos os arquivos)
   - `dist/teams/*` (imagens dos times)

### Problemas Comuns:

- **Página inicial não carrega:** Deploy não foi feito corretamente
- **Arquivos 404:** Versão antiga ainda está no cache do Azure ou navegador
- **Rotas não funcionam:** Service Worker está interceptando rotas SPA
- **Workflow falha:** Verifique se todos os secrets estão configurados corretamente

## 🏗️ Estrutura do Projeto

```
src/
├── components/
│   └── ui/          # Componentes reutilizáveis (Button, Input, Stepper, etc)
├── pages/           # Telas principais (Login, Games, Tickets, Ranking, Admin)
├── services/        # Camada de serviços com mocks (auth, match, ticket)
├── mocks/           # Dados mockados
├── lib/             # Utilitários
└── types/           # Tipos TypeScript
```

## 🎯 Funcionalidades

### ✅ Implementado

- ✅ Login social com Google OAuth
- ✅ Integração completa com backend (API REST)
- ✅ Cadastro de telefone (obrigatório)
- ✅ Lista de jogos com steppers para placares
- ✅ Sistema de lock 30min antes do primeiro jogo
- ✅ Criação de tickets com múltiplos palpites
- ✅ Visualização de tickets do usuário
- ✅ Compartilhamento via WhatsApp
- ✅ Ranking de pontuação
- ✅ Painel Admin (validar tickets e inserir resultados)
- ✅ Bottom Navigation Bar
- ✅ Design Dark Mode premium
- ✅ Animações suaves com Framer Motion
- ✅ Skeletons de carregamento
- ✅ Persistência no localStorage

### 🔄 Próximos Passos

- WebSocket para atualizações em tempo real
- Notificações push

## 🎨 Design System

- **Background**: Dark Slate (`--background`)
- **Primary**: Emerald Green (`--primary`)
- **Mobile-First**: Otimizado para smartphones
- **Animações**: Transições suaves em todas as interações

## 📱 Fluxo de Usuário

1. **Login** → Entrar com Google
2. **Telefone** → Cadastrar WhatsApp (obrigatório)
3. **Jogos** → Preencher palpites com steppers
4. **Tickets** → Visualizar e compartilhar registros de palpites
5. **Ranking** → Ver classificação
6. **Admin** → Validar registros e inserir resultados

## 🔐 Regras de Negócio

- **Pontuação**: Placar Exato (3pts) | Vencedor/Empate (1pt) | Erro (0pts)
- **Multi-Registros**: Usuário pode criar vários registros de palpites por rodada
- **Lock**: Bloqueio 30min antes do primeiro jogo
- **Admin**: Validação de registros e inserção de resultados

## 📝 Backend

- Veja `backend-requests-prompt.md` para especificações completas da API

## 📝 Notas

- Os dados são persistidos no `localStorage` (usuário e token JWT)
- Todas as chamadas de API são feitas através do `api.service.ts`
- O número do WhatsApp do admin pode ser configurado no painel Admin
- Certifique-se de que o backend está rodando antes de iniciar o frontend

