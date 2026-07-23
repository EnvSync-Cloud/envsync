#!/bin/sh
set -e

REPO="EnvSync-Cloud/envsync"
BINARY="envsync"
INSTALL_DIR="/usr/local/bin"
GITHUB_URL="https://github.com/${REPO}/releases/latest/download"

detect_os() {
  case "$(uname -s)" in
    Linux*)  echo "linux" ;;
    Darwin*) echo "darwin" ;;
    MINGW*|MSYS*|CYGWIN*) echo "windows" ;;
    *) echo "unknown" ;;
  esac
}

detect_arch() {
  case "$(uname -m)" in
    x86_64|amd64)  echo "amd64" ;;
    aarch64|arm64)  echo "arm64" ;;
    *)              echo "unknown" ;;
  esac
}

main() {
  OS=$(detect_os)
  ARCH=$(detect_arch)

  if [ "$OS" = "unknown" ] || [ "$ARCH" = "unknown" ]; then
    echo "Error: Unable to detect OS or architecture"
    echo "  OS: $(uname -s), Arch: $(uname -m)"
    exit 1
  fi

  if [ "$OS" = "windows" ]; then
    echo "For Windows, use install.ps1 instead:"
    echo "  irm https://raw.githubusercontent.com/${REPO}/main/scripts/install.ps1 | iex"
    exit 1
  fi

  FILENAME="${BINARY}_${OS}_${ARCH}"
  if [ "$OS" = "windows" ]; then
    FILENAME="${FILENAME}.exe"
  fi

  DOWNLOAD_URL="${GITHUB_URL}/${FILENAME}"

  echo "Installing ${BINARY}..."
  echo "  OS:   ${OS}"
  echo "  Arch: ${ARCH}"
  echo "  URL:  ${DOWNLOAD_URL}"

  if [ -w "$INSTALL_DIR" ]; then
    curl -fsSL "$DOWNLOAD_URL" -o "${INSTALL_DIR}/${BINARY}"
    chmod +x "${INSTALL_DIR}/${BINARY}"
  else
    echo "Need sudo to install to ${INSTALL_DIR}"
    sudo curl -fsSL "$DOWNLOAD_URL" -o "${INSTALL_DIR}/${BINARY}"
    sudo chmod +x "${INSTALL_DIR}/${BINARY}"
  fi

  echo ""
  echo "Installed ${BINARY} to ${INSTALL_DIR}/${BINARY}"
  echo ""
  echo "Run 'envsync --help' to get started."
}

main "$@"
