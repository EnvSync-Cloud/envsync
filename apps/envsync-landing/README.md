# EnvSync Landing 🚀

The official landing page for [EnvSync Cloud](https://envsync.cloud) - seamlessly sync your environment configurations across web applications.

> **Built with [Loveable](https://loveable.dev)** ❤️  
> A modern, responsive landing page showcasing the power of environment synchronization.

## ✨ What is EnvSync?

EnvSync keeps your `.env` files, configuration secrets, and environment variables perfectly synchronized across development, staging, and production environments.

**Key Benefits:**
- 🔒 **Secure** - End-to-end encryption for sensitive data
- ⚡ **Fast** - Real-time synchronization across environments  
- 🌐 **Web-first** - Built for modern web development workflows
- 🔧 **Developer-friendly** - Simple CLI and intuitive web interface

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
git clone https://github.com/EnvSync-Cloud/envsync-landing.git
cd envsync-landing
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

Visit `http://localhost:8080` to see the landing page! 🎉

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
envsync-landing/
├── src/
│   ├── components/    # Reusable UI components
│   ├── sections/      # Landing page sections
│   ├── hooks/         # Custom React hooks
│   ├── lib/           # Utilities & configurations
│   └── helpers/       # Helper functions
├── public/            # Static assets & images
└── dist/              # Production build
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

## 🎨 Landing Page Features

- **Hero Section** - Compelling introduction to EnvSync
- **Features Showcase** - Highlight key benefits and capabilities
- **How It Works** - Step-by-step process explanation
- **Call-to-Action** - Drive conversions and sign-ups
- **Responsive Design** - Optimized for all devices

## 🌟 EnvSync Ecosystem

- **[envsync-cli](https://github.com/EnvSync-Cloud/envsync/packages/envsync-cli)** - Command line interface
- **[envsync-web](https://github.com/EnvSync-Cloud/envsync-web)** - Web dashboard for managing configurations
- **[envsync-api](https://github.com/EnvSync-Cloud/envsync-api)** - REST API and backend services  
- **envsync-landing** - Landing page (this repo)

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

- 📧 **Email:** hi@envsync.cloud
- 📖 **Blog:** [blog.envsync.cloud](https://blog.envsync.cloud)

---

**Making environment configuration simple, secure, and synchronized** 🌟

Built with ❤️ by the EnvSync team using [Loveable](https://loveable.dev)
