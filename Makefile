SHELL := /bin/bash

RELEASE ?= envsync
NAMESPACE ?= envsync
KIND_CLUSTER_NAME ?= envsync
CHART_DIR ?= helm/envsync
VALUES_KIND ?= $(CHART_DIR)/values-kind.yaml
GENERATED_VALUES ?= .tmp/values-kind.generated.yaml
HELM ?= $(if $(wildcard $(CURDIR)/.tmp/bin/helm),$(CURDIR)/.tmp/bin/helm,$(shell command -v helm 2>/dev/null))

.DEFAULT_GOAL := help

.PHONY: help
help:
	@printf "EnvSync deployment helpers\n\n"
	@printf "Targets:\n"
	@printf "  %-20s %s\n" "prereqs-check" "Verify required local tooling"
	@printf "  %-20s %s\n" "kind-create" "Create the local Kind cluster"
	@printf "  %-20s %s\n" "kind-delete" "Delete the local Kind cluster"
	@printf "  %-20s %s\n" "helm-deps" "Build Helm chart dependencies"
	@printf "  %-20s %s\n" "helm-lint" "Lint the Helm chart"
	@printf "  %-20s %s\n" "helm-template" "Render the Helm chart locally"
	@printf "  %-20s %s\n" "helm-install-kind" "Install or upgrade the chart into Kind"
	@printf "  %-20s %s\n" "helm-uninstall" "Uninstall the release"
	@printf "  %-20s %s\n" "status" "Show workload status in the namespace"
	@printf "  %-20s %s\n" "port-forward-api" "Port-forward the API service to localhost:4000"

.PHONY: prereqs-check
prereqs-check:
	@missing=0; \
	for tool in kind kubectl openssl bun; do \
		if ! command -v $$tool >/dev/null 2>&1; then \
			echo "Missing required tool: $$tool"; \
			missing=1; \
		fi; \
	done; \
	if [ -z "$(HELM)" ] || [ ! -x "$(HELM)" ]; then \
		echo "Missing required tool: helm"; \
		echo "Install Helm from https://helm.sh/docs/intro/install/"; \
		missing=1; \
	fi; \
	if [ $$missing -ne 0 ]; then \
		exit 1; \
	fi

.PHONY: kind-create
kind-create: prereqs-check
	@if kind get clusters | grep -qx "$(KIND_CLUSTER_NAME)"; then \
		echo "Kind cluster '$(KIND_CLUSTER_NAME)' already exists"; \
	else \
		kind create cluster --name "$(KIND_CLUSTER_NAME)" --config kind-config.yaml; \
	fi

.PHONY: kind-delete
kind-delete:
	@kind delete cluster --name "$(KIND_CLUSTER_NAME)"

.PHONY: helm-deps
helm-deps: prereqs-check
	@"$(HELM)" dependency build "$(CHART_DIR)"

.PHONY: helm-lint
helm-lint: helm-deps
	@"$(HELM)" lint "$(CHART_DIR)"

.PHONY: generate-kind-values
generate-kind-values:
	@mkdir -p .tmp
	@cat > "$(GENERATED_VALUES)" <<EOF
zitadel:
  masterkey: "$(shell openssl rand -base64 24 | tr -d '\n' | cut -c1-32)"
  admin:
    password: "$(shell openssl rand -base64 18 | tr -d '\n' | cut -c1-18)"
minikms:
  rootKey: "$(shell openssl rand -hex 16)"
rustfs:
  accessKey: "rustfsadmin"
  secretKey: "$(shell openssl rand -base64 24 | tr -d '\n' | cut -c1-32)"
postgresql:
  auth:
    postgresPassword: "$(shell openssl rand -base64 24 | tr -d '\n' | cut -c1-32)"
    password: "$(shell openssl rand -base64 24 | tr -d '\n' | cut -c1-32)"
    replicationPassword: "$(shell openssl rand -base64 24 | tr -d '\n' | cut -c1-32)"
database:
  roles:
    zitadel:
      password: "$(shell openssl rand -base64 24 | tr -d '\n' | cut -c1-32)"
    openfga:
      password: "$(shell openssl rand -base64 24 | tr -d '\n' | cut -c1-32)"
    minikms:
      password: "$(shell openssl rand -base64 24 | tr -d '\n' | cut -c1-32)"
EOF

.PHONY: helm-template
helm-template: helm-deps generate-kind-values
	@"$(HELM)" template "$(RELEASE)" "$(CHART_DIR)" \
		--namespace "$(NAMESPACE)" \
		-f "$(VALUES_KIND)" \
		-f "$(GENERATED_VALUES)"

.PHONY: helm-install-kind
helm-install-kind: kind-create helm-deps generate-kind-values
	@kubectl create namespace "$(NAMESPACE)" --dry-run=client -o yaml | kubectl apply -f -
	@"$(HELM)" upgrade --install "$(RELEASE)" "$(CHART_DIR)" \
		--namespace "$(NAMESPACE)" \
		-f "$(VALUES_KIND)" \
		-f "$(GENERATED_VALUES)" \
		--wait \
		--timeout 20m

.PHONY: helm-uninstall
helm-uninstall:
	@"$(HELM)" uninstall "$(RELEASE)" --namespace "$(NAMESPACE)"

.PHONY: status
status:
	@kubectl get all,pvc,ingress,configmap,secret -n "$(NAMESPACE)"

.PHONY: port-forward-api
port-forward-api:
	@kubectl port-forward -n "$(NAMESPACE)" svc/$(RELEASE)-api 4000:4000
