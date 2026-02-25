# EnvSync API 🚀

The REST API backend for [EnvSync Cloud](https://envsync.cloud) - seamlessly sync your environment configurations across web applications.

> **High-performance API built with modern technologies** ⚡  
> Secure, scalable, and developer-friendly backend services.

## ✨ What is EnvSync?

EnvSync keeps your `.env` files, configuration secrets, and environment variables perfectly synchronized across development, staging, and production environments.

**Key Benefits:**

- 🔒 **Secure** - End-to-end encryption for sensitive data
- ⚡ **Fast** - Real-time synchronization across environments
- 🌐 **Web-first** - Built for modern web development workflows
- 🔧 **Developer-friendly** - RESTful API with comprehensive documentation

## 🛠️ Tech Stack

- **Hono** - Fast web framework for the edge
- **Bun** - JavaScript runtime and package manager
- **TypeScript** - Type-safe development
- **ESBuild** - Ultra-fast bundler
- **SpacetimeDB** - Integrated database and server logic
- **Keycloak 26.x** - Authentication and authorization (OIDC)
- **Redis** - Caching and session storage
- **S3-compatible storage (RustFS)** - File storage
- **SMTP** - Email services
- **Docker** - Containerization

## 📚 API Documentation

Interactive API documentation is available at: **[https://api.envsync.cloud/docs](https://api.envsync.cloud/docs)** 📖

## 🚀 Quick Start

### Prerequisites

- [Bun](https://bun.sh/) - JavaScript runtime and package manager
- [Docker](https://docker.com/) - For running services locally (SpacetimeDB, Keycloak, Redis, RustFS, Mailpit)

### Installation

```bash
git clone https://github.com/EnvSync-Cloud/envsync-api.git
cd envsync-api
```

```bash
bun install
```

### Environment Setup

Env is controlled from the **monorepo root**. Create a `.env` at the repo root from the template:

```bash
# From monorepo root
cp .env.example .env
```

Configure your environment variables:

```env
# Application
NODE_ENV=development
PORT=4000

# SpacetimeDB
STDB_URL=http://localhost:1234
STDB_DB_NAME=envsync-kms
STDB_ROOT_KEY=your-root-key

# S3 configuration
S3_BUCKET=envsync-bucket
S3_REGION=us-east-1
S3_ACCESS_KEY=rustfsadmin
S3_SECRET_KEY=rustfsadmin
S3_BUCKET_URL=http://localhost:19000
S3_ENDPOINT=http://localhost:19000

# Redis configuration
CACHE_ENV=development
REDIS_URL=redis://localhost:6379

# SMTP configuration
SMTP_HOST=localhost
SMTP_PORT=1025
SMTP_SECURE=false
SMTP_USER=
SMTP_PASS=
SMTP_FROM=noreply@envsync.cloud

# Keycloak configuration (auto-configured via init)
KEYCLOAK_URL=http://localhost:8080
KEYCLOAK_REALM=envsync
KEYCLOAK_ADMIN_USER=admin
KEYCLOAK_ADMIN_PASSWORD=admin
KEYCLOAK_WEB_CLIENT_ID=envsync-web
KEYCLOAK_WEB_CLIENT_SECRET=  # auto-filled by init
KEYCLOAK_CLI_CLIENT_ID=envsync-cli
KEYCLOAK_API_CLIENT_ID=envsync-api
KEYCLOAK_API_CLIENT_SECRET=  # auto-filled by init
KEYCLOAK_WEB_REDIRECT_URI=http://localhost:8001/api/access/web/callback
KEYCLOAK_WEB_CALLBACK_URL=http://localhost:8001/api/access/web/callback
KEYCLOAK_API_REDIRECT_URI=http://localhost:8001/api/access/api/callback
```

### Development with Docker Compose

Start the development environment:

```bash
docker-compose up -d
```

This will start:

- 🗄️ SpacetimeDB
- 🔑 Keycloak
- 🔴 Redis cache
- 📦 RustFS (S3-compatible storage)
- 📧 Mailpit (local email testing)

### Run the API

```bash
bun run dev
```

The API will be available at `http://localhost:4000` 🎉

## 📝 Available Scripts

```bash
# Start development server
bun run dev

# Build for production
bun run build

# Start production server
bun start

# Database migrations are handled automatically by SpacetimeDB

# Init RustFS bucket + retrieve Keycloak client secrets
bun run scripts/cli.ts init
```

## 📁 Project Structure

```
envsync-api/
├── src/
│   ├── routes/         # API route handlers
│   ├── controllers/    # Business logic controllers
│   ├── middleware/     # Custom middleware
│   ├── services/       # Business logic services
│   ├── utils/          # Utility functions
│   ├── types/          # TypeScript definitions
│   ├── app/            # Entry point
│   └── libs/           # Libraries and helpers
└── docker-compose.yml  # Development services
```

## 🔧 Configuration

### Required Environment Variables

| Category     | Variable            | Description          |
| ------------ | ------------------- | -------------------- |
| **App**      | `NODE_ENV`          | Environment mode     |
| **App**      | `PORT`              | Server port          |
| **STDB**     | `STDB_URL`          | SpacetimeDB URL      |
| **STDB**     | `STDB_DB_NAME`      | SpacetimeDB database name |
| **STDB**     | `STDB_ROOT_KEY`     | SpacetimeDB root encryption key |
| **S3**       | `S3_BUCKET`         | S3 bucket name       |
| **S3**       | `S3_ACCESS_KEY`     | S3 access key        |
| **S3**       | `S3_SECRET_KEY`     | S3 secret key        |
| **Redis**    | `REDIS_URL`         | Redis connection URL |
| **Keycloak** | `KEYCLOAK_URL`      | Keycloak server URL  |
| **Keycloak** | `KEYCLOAK_REALM`    | Keycloak realm name  |
| **SMTP**     | `SMTP_HOST`         | SMTP server host     |
| **SMTP**     | `SMTP_FROM`         | Email sender address |

## 🐳 Docker Deployment

### Run with Docker Compose

```bash
docker-compose -f docker-compose.yml up -d
```

## 🔒 Authentication

This API uses **Keycloak** for authentication and authorization:

- 🔑 **JWT tokens** for API access
- 👥 **Role-based access control** (RBAC)
- 🔐 **OAuth 2.0 / OIDC** for web, API, and CLI flows
- 📱 **Device authorization** for CLI login

## 🌟 EnvSync Ecosystem

- **[envsync-cli](https://github.com/EnvSync-Cloud/envsync/packages/envsync-cli)** - Command line interface
- **[envsync-web](https://github.com/EnvSync-Cloud/envsync-web)** - Web dashboard for managing configurations
- **envsync-api** - REST API and backend services (this repo)
- **[envsync-landing](https://github.com/EnvSync-Cloud/envsync-landing)** - Landing page

## 🤝 Contributing

We're building the future of environment management!

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 💬 Support & Community

- 📧 **Email:** hi@envsync.com
- 📖 **Blog:** [docs.envsync.com](https://blog.envsync.com)
- 🐛 **Issues:** [GitHub Issues](https://github.com/EnvSync-Cloud/envsync-api/issues)

---

**Making environment configuration simple, secure, and synchronized** 🌟

Built with ❤️ by the EnvSync team
