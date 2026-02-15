#!/bin/bash

set -e

BINARY_PATH="$1"
OUTPUT_DIR="completions"

# Create completions directory
mkdir -p "$OUTPUT_DIR"

echo "Generating shell completions..."

# Generate completions for different shells
# Note: urfave/cli/v3 uses different completion commands
"$BINARY_PATH" completion bash > "$OUTPUT_DIR/envsync.bash" 2>/dev/null || echo "Bash completion not supported"
"$BINARY_PATH" completion zsh > "$OUTPUT_DIR/envsync.zsh" 2>/dev/null || echo "Zsh completion not supported"
"$BINARY_PATH" completion fish > "$OUTPUT_DIR/envsync.fish" 2>/dev/null || echo "Fish completion not supported"
"$BINARY_PATH" completion powershell > "$OUTPUT_DIR/envsync.ps1" 2>/dev/null || echo "PowerShell completion not supported"

# Alternative syntax that might work with urfave/cli/v3
"$BINARY_PATH" generate-completion bash > "$OUTPUT_DIR/envsync.bash" 2>/dev/null || true
"$BINARY_PATH" generate-completion zsh > "$OUTPUT_DIR/envsync.zsh" 2>/dev/null || true
"$BINARY_PATH" generate-completion fish > "$OUTPUT_DIR/envsync.fish" 2>/dev/null || true
"$BINARY_PATH" generate-completion powershell > "$OUTPUT_DIR/envsync.ps1" 2>/dev/null || true

echo "Shell completions generated in $OUTPUT_DIR/"
