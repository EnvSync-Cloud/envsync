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

	app, err := uc.resolveApp(ctx, opts, projectCfg)
	if err != nil {
		return ExportResult{}, err
	}

	envType, err := uc.resolveEnvType(ctx, app, opts, projectCfg)
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
		AppName:     app.Name,
		EnvTypeName: envType.Name,
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
		secrets, resolvedManagedSecrets, err := uc.resolveSecretsForExport(ctx, app, envType.Name, opts)
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
		ResolvedAppID:       app.ID,
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
	envTypeName string,
	opts ExportOptions,
) (map[string]string, bool, error) {
	mode := strings.ToLower(strings.TrimSpace(firstNonEmpty(opts.IsSecretManaged, "auto")))

	switch mode {
	case "true":
		secrets, err := uc.resolveSecrets(ctx, app.Name, envTypeName, true, "")
		return secrets, true, err
	case "false":
		if opts.PrivateKeyFile == "" {
			return nil, false, errors.New("private-key-file is required when secrets are enabled and not managed")
		}
		secrets, err := uc.resolveSecrets(ctx, app.Name, envTypeName, false, opts.PrivateKeyFile)
		return secrets, false, err
	default:
		if app.IsManagedSecret {
			secrets, err := uc.resolveSecrets(ctx, app.Name, envTypeName, true, "")
			if err == nil {
				return secrets, true, nil
			}
			if opts.PrivateKeyFile == "" {
				return nil, true, err
			}
		}

		if opts.PrivateKeyFile != "" {
			secrets, err := uc.resolveSecrets(ctx, app.Name, envTypeName, false, opts.PrivateKeyFile)
			if err == nil {
				return secrets, false, nil
			}
			if !app.IsManagedSecret {
				if fallbackSecrets, fallbackErr := uc.resolveSecrets(ctx, app.Name, envTypeName, true, ""); fallbackErr == nil {
					return fallbackSecrets, true, nil
				}
			}
			return nil, false, err
		}

		// Auto mode fallback: if metadata says self-managed but the app is actually
		// server-managed, prefer a successful managed reveal over a hard failure.
		if !app.IsManagedSecret {
			secrets, err := uc.resolveSecrets(ctx, app.Name, envTypeName, true, "")
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

	if _, err := resolveMode(opts.EnableSecrets, false); err != nil {
		return fmt.Errorf("enable-secrets must be auto, true, or false")
	}

	if _, err := resolveMode(opts.IsSecretManaged, false); err != nil {
		return fmt.Errorf("is-secret-managed must be auto, true, or false")
	}

	return nil
}

func (uc *exportUseCase) resolveConfig(opts ExportOptions) (domain.SyncConfig, error) {
	needsConfig := opts.AppName == "" || opts.EnvName == ""
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

func (uc *exportUseCase) resolveApp(
	ctx context.Context,
	opts ExportOptions,
	projectCfg domain.SyncConfig,
) (domain.Application, error) {
	if name := firstNonEmpty(opts.AppName, projectCfg.AppName); name != "" {
		apps, err := uc.appService.GetAllApps(ctx)
		if err != nil {
			return domain.Application{}, fmt.Errorf("failed to resolve application %q: %w", name, err)
		}
		app, err := domain.FindAppByName(apps, name)
		if err != nil {
			return domain.Application{}, fmt.Errorf("failed to resolve application %q: %w", name, err)
		}
		return app, nil
	}

	if projectCfg.AppID != "" {
		app, err := uc.appService.GetAppByID(ctx, projectCfg.AppID)
		if err != nil {
			return domain.Application{}, fmt.Errorf("failed to resolve application %q: %w", projectCfg.AppID, err)
		}
		return app, nil
	}

	return domain.Application{}, errors.New("--app is required when no config fallback is available")
}

func (uc *exportUseCase) resolveEnvType(
	ctx context.Context,
	app domain.Application,
	opts ExportOptions,
	projectCfg domain.SyncConfig,
) (domain.EnvType, error) {
	envTypeName := firstNonEmpty(opts.EnvName, projectCfg.EnvTypeName)
	if envTypeName == "" && projectCfg.EnvTypeID != "" {
		envType, err := uc.envTypeSvc.GetEnvTypeByID(ctx, projectCfg.EnvTypeID)
		if err != nil {
			return domain.EnvType{}, fmt.Errorf("failed to resolve environment type %q: %w", projectCfg.EnvTypeID, err)
		}
		if envType.AppID != "" && envType.AppID != app.ID {
			return domain.EnvType{}, fmt.Errorf("environment type %q does not belong to app %q", projectCfg.EnvTypeID, app.Name)
		}
		envTypeName = envType.Name
	}
	if envTypeName == "" {
		return domain.EnvType{}, errors.New("--env is required when no config fallback is available")
	}

	envTypes, err := uc.envTypeSvc.GetEnvTypesByAppID(ctx, app.ID)
	if err != nil {
		return domain.EnvType{}, fmt.Errorf("failed to list environment types for app %q: %w", app.Name, err)
	}

	var matches []domain.EnvType
	for _, envType := range envTypes {
		if envType.Name == envTypeName {
			matches = append(matches, envType)
		}
	}

	switch len(matches) {
	case 0:
		return domain.EnvType{}, fmt.Errorf("environment type %q was not found for app %q", envTypeName, app.Name)
	case 1:
		return matches[0], nil
	default:
		return domain.EnvType{}, fmt.Errorf("environment type %q is ambiguous for app %q", envTypeName, app.Name)
	}
}

func (uc *exportUseCase) resolveSecrets(
	ctx context.Context,
	appName, envTypeName string,
	managedSecrets bool,
	privateKeyFile string,
) (map[string]string, error) {
	ref := domain.ProjectEnvRef{AppName: appName, EnvTypeName: envTypeName}
	if managedSecrets {
		rawSecrets, err := uc.secretService.GetAllSecrets(ctx, ref)
		if err != nil {
			return nil, fmt.Errorf("failed to list secrets: %w", err)
		}

		keys := make([]string, len(rawSecrets))
		for idx, secret := range rawSecrets {
			keys[idx] = secret.Key
		}

		revealedSecrets, err := uc.secretService.RevelSecrets(ctx, ref, keys)
		if err != nil {
			return nil, fmt.Errorf("failed to reveal managed secrets: %w", err)
		}

		return secretsToMap(revealedSecrets), nil
	}

	privateKey, err := utils.ReadFile(privateKeyFile)
	if err != nil {
		return nil, fmt.Errorf("failed to read private key file: %w", err)
	}

	rawSecrets, err := uc.secretService.GetAllSecrets(ctx, ref)
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
