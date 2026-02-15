# EnvSync Web 🌐

The web dashboard for [EnvSync Cloud](https://github.com/envsync-cloud) - seamlessly sync your environment configurations across web applications.

> **Built with [Loveable](https://loveable.dev)** ❤️  
> A modern React frontend for managing your environment variables with style.

## ✨ What is EnvSync?

EnvSync keeps your `.env` files, configuration secrets, and environment variables perfectly synchronized across development, staging, and production environments.

**Key Benefits:**
- 🔒 **Secure** - End-to-end encryption for sensitive data
- ⚡ **Fast** - Real-time synchronization across environments  
- 🌐 **Web-first** - Built for modern web development workflows
- 🔧 **Developer-friendly** - Intuitive web interface

## 🛠️ Tech Stack

- **React** - UI library
- **Vite** - Build tool and dev server
- **TailwindCSS** - Utility-first CSS framework
- **React Query** - Data fetching and state management
- **Zod** - TypeScript-first schema validation

## 🚀 Quick Start

### Prerequisites
- [Bun](https://bun.sh/) - JavaScript runtime and package manager

### Installation

```bash
git clone https://github.com/envsync-cloud/envsync-web.git
cd envsync-web
```

```bash
bun install
```

### Environment Setup

Create a `.env` file:

```env
VITE_API_BASE_URL=https://api.envsync.cloud
```

### Development

```bash
bun dev
```

Visit `http://localhost:8080` to see your EnvSync dashboard! 🎉

## 📝 Available Scripts

```bash
# Start development server
bun dev

# Build for production
bun run build

# Preview production build
bun run preview

# Run linting
bun run lint
```

## 📁 Project Structure

```
envsync-web/
├── src/
│   ├── components/    # Reusable UI components
│   ├── pages/         # Dashboard pages
│   ├── hooks/         # Custom React hooks
│   ├── lib/           # API clients & utilities
|   ├── layout/        # Web Layouts
|   └── contexts/      # React Context API
└─── public/            # Static assets
```

## 🔧 Configuration

### Required Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `VITE_API_BASE_URL` | EnvSync API backend URL | `https://api.envsync.cloud` |

## 🏗️ Build & Deploy

```bash
bun run build
```

```bash
bun run preview
```

Deploy the `dist/` directory to any static hosting service (Vercel, Netlify, etc.).

## 🌟 EnvSync Ecosystem

- **[envsync-cli](https://github.com/envsync-cloud/envsync-cli)** - Command line interface
- **[envsync-api](https://github.com/envsync-cloud/envsync-api)** - REST API and backend services  
- **[envsync-landing](https://github.com/envsync-cloud/envsync-landing)** - Landing page
- **envsync-web** - Web dashboard (this repo)

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
- 📖 **Blog:** [blog.envsync.com](https://blog.envsync.com)

---

**Making environment configuration simple, secure, and synchronized** 🌟

Built with ❤️ by the EnvSync team using [Loveable](https://loveable.dev)
