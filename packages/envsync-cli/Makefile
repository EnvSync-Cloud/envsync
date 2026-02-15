MAIN_PACKAGE := ./cmd/cli/main.go
BINARY_NAME := envsync
BACKEND_URL ?= http://localhost:8600/api

# ==================================================================================== #
# DEVELOPMENT
# ==================================================================================== #

## build: build the production code
.PHONY: build
build:
	@echo "Building binary"
	@go build -ldflags="-X github.com/EnvSync-Cloud/envsync-cli/internal/config.backendURL=$(BACKEND_URL)" -o bin/$(BINARY_NAME) $(MAIN_PACKAGE)

## install: install the binary
.PHONY: install
install:
	@sudo cp bin/$(BINARY_NAME) /usr/local/bin
	@echo "Installed binary ✅"

## run: run the production code
.PHONY: run
run:
	@echo "Running binary..."
	@go run $(MAIN_PACKAGE)

## dev: run the code development environment
.PHONY: dev
dev:
	@echo "Running development environment..."
	@go run $(MAIN_PACKAGE)

## watch: run the application with reloading on file changes
.PHONY: watch
watch:
	@if command -v air > /dev/null; then \
		    air; \
		    echo "Watching...";\
		else \
		    read -p "Go's 'air' is not installed on your machine. Do you want to install it? [Y/n] " choice; \
		    if [ "$$choice" != "n" ] && [ "$$choice" != "N" ]; then \
		        go install github.com/air-verse/air@latest; \
		        air; \
		        echo "Watching...";\
		    else \
		        echo "You chose not to install air. Exiting..."; \
		        exit 1; \
		    fi; \
		fi

## update: updates the packages and tidy the modfile
.PHONY: update
update:
	@go get -u ./...
	@go mod tidy -v


# ==================================================================================== #
# QUALITY CONTROL
# ==================================================================================== #

## tidy: format code and tidy modfile
.PHONY: tidy
tidy:
	@echo "Tidying up..."
	@go fmt ./...
	@go mod tidy -v

## lint: run linter
.PHONY: lint
lint:
	@echo "Linting..."
	@golangci-lint run

# ==================================================================================== #
# HELPERS
# ==================================================================================== #

## help: print this help message
.PHONY: help
help:
	@echo 'Usage:'
	@sed -n 's/^##//p' ${MAKEFILE_LIST} | column -t -s ':' |  sed -e 's/^/ /'
