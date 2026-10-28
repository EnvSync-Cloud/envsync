package export

import (
	"context"
	"errors"
	"fmt"
	"os"
	"strings"

	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/constants"
	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/domain"
	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/services"
	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/telemetry"
	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/utils"
)

type exportUseCase struct {
	appService    services.ApplicationService
	envTypeSvc    services.EnvTypeService
	secretService services.SecretService
	configService services.SyncService
}

func NewExportUseCase() ExportUseCase {
	return &exportUseCase{
		appService:    services.NewAppService(),
		envTypeSvc:    services.NewEnvTypeService(),
		secretService: services.NewSecretService(),
		configService: services.NewSyncService(),
	}
}

func (uc *exportUseCase) Execute(ctx context.Context, opts ExportOptions) (ExportResult, error) {
	ctx, span := telemetry.Tracer().Start(ctx, "export.execute")
	defer span.End()

	if err := uc.validateOptions(opts); err != nil {
		return ExportResult{}, err
	}

	projectCfg, err := uc.resolveConfig(opts)
	if err != nil {
		return ExportResult{}, err
	}

	appID := firstNonEmpty(opts.AppID, projectCfg.AppID)
	if appID == "" {
		return ExportResult{}, errors.New("app-id is required when no config fallback is available")
	}

	app, err := uc.appService.GetAppByID(ctx, appID)
	if err != nil {
		return ExportResult{}, fmt.Errorf("failed to resolve application %q: %w", appID, err)
	}

	envType, err := uc.resolveEnvType(ctx, appID, opts, projectCfg)
	if err != nil {
		return ExportResult{}, err
	}

	secretsEnabled, err := resolveMode(opts.EnableSecrets, app.EnableSecrets)
	if err != nil {
		return ExportResult{}, fmt.Errorf("invalid enable-secrets value: %w", err)
	}

	managedSecrets, err := resolveMode(opts.IsSecretManaged, app.IsManagedSecret)
	if err != nil {
		return ExportResult{}, fmt.Errorf("invalid is-secret-managed value: %w", err)
	}
	if !secretsEnabled {
		managedSecrets = false
	}

	syncService := services.NewSyncServiceWithConfig(domain.SyncConfig{
		AppID:     appID,
		EnvTypeID: envType.ID,
	})

	remoteEnv, err := syncService.ReadRemoteEnv(ctx)
	if err != nil {
		return ExportResult{}, fmt.Errorf("failed to read environment variables: %w", err)
	}

	values := make(map[string]string, len(remoteEnv))
	for _, env := range remoteEnv {
		values[env.Key] = env.Value
	}

	if secretsEnabled {
		secrets, resolvedManagedSecrets, err := uc.resolveSecretsForExport(ctx, app, envType.ID, opts)
		if err != nil {
			return ExportResult{}, err
		}
		managedSecrets = resolvedManagedSecrets

		for key, value := range secrets {
			values[key] = value
		}
	}

	return ExportResult{
		Format:              normalizeFormat(opts.Format),
		ResolvedAppID:       appID,
		ResolvedEnvTypeID:   envType.ID,
		ResolvedEnvTypeName: envType.Name,
		SecretsEnabled:      secretsEnabled,
		ManagedSecrets:      managedSecrets,
		Environment:         values,
	}, nil
}

func (uc *exportUseCase) resolveSecretsForExport(
	ctx context.Context,
	app domain.Application,
	envTypeID string,
	opts ExportOptions,
) (map[string]string, bool, error) {
	mode := strings.ToLower(strings.TrimSpace(firstNonEmpty(opts.IsSecretManaged, "auto")))

	switch mode {
	case "true":
		secrets, err := uc.resolveSecrets(ctx, app.ID, envTypeID, true, "")
		return secrets, true, err
	case "false":
		if opts.PrivateKeyFile == "" {
			return nil, false, errors.New("private-key-file is required when secrets are enabled and not managed")
		}
		secrets, err := uc.resolveSecrets(ctx, app.ID, envTypeID, false, opts.PrivateKeyFile)
		return secrets, false, err
	default:
		if app.IsManagedSecret {
			secrets, err := uc.resolveSecrets(ctx, app.ID, envTypeID, true, "")
			if err == nil {
				return secrets, true, nil
			}
			if opts.PrivateKeyFile == "" {
				return nil, true, err
			}
		}

		if opts.PrivateKeyFile != "" {
			secrets, err := uc.resolveSecrets(ctx, app.ID, envTypeID, false, opts.PrivateKeyFile)
			if err == nil {
				return secrets, false, nil
			}
			if !app.IsManagedSecret {
				if fallbackSecrets, fallbackErr := uc.resolveSecrets(ctx, app.ID, envTypeID, true, ""); fallbackErr == nil {
					return fallbackSecrets, true, nil
				}
			}
			return nil, false, err
		}

		// Auto mode fallback: if metadata says self-managed but the app is actually
		// server-managed, prefer a successful managed reveal over a hard failure.
		if !app.IsManagedSecret {
			secrets, err := uc.resolveSecrets(ctx, app.ID, envTypeID, true, "")
			if err == nil {
				return secrets, true, nil
			}
		}

		return nil, false, errors.New("private-key-file is required when secrets are enabled and not managed")
	}
}

func (uc *exportUseCase) validateOptions(opts ExportOptions) error {
	format := normalizeFormat(opts.Format)
	if format != "dotenv" && format != "json" {
		return fmt.Errorf("unsupported format %q", opts.Format)
	}

	if opts.EnvTypeID != "" && opts.EnvTypeName != "" {
		return errors.New("only one of env-type-id or env-type may be provided")
	}

	if _, err := resolveMode(opts.EnableSecrets, false); err != nil {
		return fmt.Errorf("enable-secrets must be auto, true, or false")
	}

	if _, err := resolveMode(opts.IsSecretManaged, false); err != nil {
		return fmt.Errorf("is-secret-managed must be auto, true, or false")
	}

	return nil
}

func (uc *exportUseCase) resolveConfig(opts ExportOptions) (domain.SyncConfig, error) {
	needsConfig := opts.AppID == "" || (opts.EnvTypeID == "" && opts.EnvTypeName == "")
	if !needsConfig {
		return domain.SyncConfig{}, nil
	}

	configPath := opts.ConfigPath
	if configPath == "" {
		configPath = constants.DefaultProjectConfig
	}

	if _, err := os.Stat(configPath); err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return domain.SyncConfig{}, nil
		}
		return domain.SyncConfig{}, fmt.Errorf("failed to stat config file %q: %w", configPath, err)
	}

	cfg, err := uc.configService.ReadConfigDataFromPath(configPath)
	if err != nil {
		return domain.SyncConfig{}, fmt.Errorf("failed to read config file %q: %w", configPath, err)
	}
	return cfg, nil
}

func (uc *exportUseCase) resolveEnvType(
	ctx context.Context,
	appID string,
	opts ExportOptions,
	projectCfg domain.SyncConfig,
) (domain.EnvType, error) {
	if envTypeID := firstNonEmpty(opts.EnvTypeID, projectCfg.EnvTypeID); envTypeID != "" && opts.EnvTypeName == "" {
		envType, err := uc.envTypeSvc.GetEnvTypeByID(ctx, envTypeID)
		if err != nil {
			return domain.EnvType{}, fmt.Errorf("failed to resolve environment type %q: %w", envTypeID, err)
		}
		if envType.AppID != "" && envType.AppID != appID {
			return domain.EnvType{}, fmt.Errorf("environment type %q does not belong to app %q", envTypeID, appID)
		}
		return envType, nil
	}

	envTypeName := strings.TrimSpace(opts.EnvTypeName)
	if envTypeName == "" {
		return domain.EnvType{}, errors.New("env-type-id or env-type is required when no config fallback is available")
	}

	envTypes, err := uc.envTypeSvc.GetEnvTypesByAppID(ctx, appID)
	if err != nil {
		return domain.EnvType{}, fmt.Errorf("failed to list environment types for app %q: %w", appID, err)
	}

	var matches []domain.EnvType
	for _, envType := range envTypes {
		if strings.EqualFold(envType.Name, envTypeName) {
			matches = append(matches, envType)
		}
	}

	switch len(matches) {
	case 0:
		return domain.EnvType{}, fmt.Errorf("environment type %q was not found for app %q", envTypeName, appID)
	case 1:
		return matches[0], nil
	default:
		return domain.EnvType{}, fmt.Errorf("environment type %q is ambiguous for app %q", envTypeName, appID)
	}
}

func (uc *exportUseCase) resolveSecrets(
	ctx context.Context,
	appID, envTypeID string,
	managedSecrets bool,
	privateKeyFile string,
) (map[string]string, error) {
	if managedSecrets {
		rawSecrets, err := uc.secretService.GetAllSecrets(ctx, appID, envTypeID)
		if err != nil {
			return nil, fmt.Errorf("failed to list secrets: %w", err)
		}

		keys := make([]string, len(rawSecrets))
		for idx, secret := range rawSecrets {
			keys[idx] = secret.Key
		}

		revealedSecrets, err := uc.secretService.RevelSecrets(ctx, appID, envTypeID, keys)
		if err != nil {
			return nil, fmt.Errorf("failed to reveal managed secrets: %w", err)
		}

		return secretsToMap(revealedSecrets), nil
	}

	privateKey, err := utils.ReadFile(privateKeyFile)
	if err != nil {
		return nil, fmt.Errorf("failed to read private key file: %w", err)
	}

	rawSecrets, err := uc.secretService.GetAllSecrets(ctx, appID, envTypeID)
	if err != nil {
		return nil, fmt.Errorf("failed to list secrets: %w", err)
	}

	decrypted := make(map[string]string, len(rawSecrets))
	for _, secret := range rawSecrets {
		value, err := utils.SmartDecrypt(secret.Value, privateKey)
		if err != nil {
			return nil, fmt.Errorf("failed to decrypt secret %q: %w", secret.Key, err)
		}
		decrypted[secret.Key] = value
	}

	return decrypted, nil
}

func resolveMode(value string, defaultValue bool) (bool, error) {
	switch strings.ToLower(strings.TrimSpace(firstNonEmpty(value, "auto"))) {
	case "", "auto":
		return defaultValue, nil
	case "true":
		return true, nil
	case "false":
		return false, nil
	default:
		return false, errors.New("unsupported mode")
	}
}

func normalizeFormat(value string) string {
	if strings.TrimSpace(value) == "" {
		return "dotenv"
	}
	return strings.ToLower(strings.TrimSpace(value))
}

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if strings.TrimSpace(value) != "" {
			return strings.TrimSpace(value)
		}
	}
	return ""
}

func secretsToMap(secrets []domain.Secret) map[string]string {
	result := make(map[string]string, len(secrets))
	for _, secret := range secrets {
		result[secret.Key] = secret.Value
	}
	return result
}
