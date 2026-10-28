package export

import "context"

type ExportUseCase interface {
	Execute(context.Context, ExportOptions) (ExportResult, error)
}

type ExportOptions struct {
	AppID           string
	EnvTypeID       string
	EnvTypeName     string
	ConfigPath      string
	Format          string
	EnableSecrets   string
	IsSecretManaged string
	PrivateKeyFile  string
}

type ExportResult struct {
	Format              string
	ResolvedAppID       string
	ResolvedEnvTypeID   string
	ResolvedEnvTypeName string
	SecretsEnabled      bool
	ManagedSecrets      bool
	Environment         map[string]string
}
