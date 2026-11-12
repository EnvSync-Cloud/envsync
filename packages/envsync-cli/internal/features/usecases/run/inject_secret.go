package run

import (
	"context"
	"os"

	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/domain"
	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/services"
	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/telemetry"
	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/utils"
)

type injectSecretUseCase struct {
	secretService services.SecretService
}

func NewInjectSecretUseCase() InjectSecretsUseCase {
	secretService := services.NewSecretService()
	return &injectSecretUseCase{
		secretService: secretService,
	}
}

func (i *injectSecretUseCase) Execute(ctx context.Context) (result map[string]string, err error) {
	ctx, end := telemetry.StartSpan(ctx, "run.inject_secret")
	defer end(&err)

	managedSecret := ctx.Value("managedSecret").(bool)
	privateKeyPath := ctx.Value("privateKeyPath").(string)
	ref := ctx.Value("projectRef").(domain.ProjectEnvRef)

	secrets, err := i.getAllSecrets(ctx, ref)
	if err != nil {
		return nil, err
	}

	var decryptedSecrets []domain.Secret
	if !managedSecret {
		privatePEM, err := i.extractPrivateKey(privateKeyPath)
		if err != nil {
			return nil, err
		}

		// If it is not managed then decrypt using the key provided
		decryptedSecrets, err = i.decryptSecretsLocally(secrets, privatePEM)
		if err != nil {
			return nil, err
		}
	} else {
		// If it is managed then decrypt using the managed secret decryption logic
		decryptedSecrets, err = i.decryptManagedSecrets(ctx, secrets, ref)
		if err != nil {
			return nil, err
		}
	}

	injectedSecrets, err := i.injectToEnvironment(decryptedSecrets)
	if err != nil {
		return nil, err
	}

	return injectedSecrets, nil
}

func (i *injectSecretUseCase) getAllSecrets(ctx context.Context, ref domain.ProjectEnvRef) ([]domain.Secret, error) {
	secrets, err := i.secretService.GetAllSecrets(ctx, ref)
	if err != nil {
		return nil, err
	}

	return secrets, nil
}

func (i *injectSecretUseCase) decryptSecretsLocally(secrets []domain.Secret, privateKeyPEM string) ([]domain.Secret, error) {
	for idx := range secrets {
		decryptedValue, err := utils.SmartDecrypt(secrets[idx].Value, privateKeyPEM)
		if err != nil {
			return nil, err
		}
		secrets[idx].Value = decryptedValue
	}
	return secrets, nil
}

func (i *injectSecretUseCase) extractPrivateKey(keyPath string) (string, error) {
	privateKey, err := utils.ReadFile(keyPath)
	if err != nil {
		return "", err
	}
	return privateKey, nil
}

func (i *injectSecretUseCase) decryptManagedSecrets(ctx context.Context, secrets []domain.Secret, ref domain.ProjectEnvRef) ([]domain.Secret, error) {
	keys := make([]string, len(secrets))
	for i, secret := range secrets {
		keys[i] = secret.Key
	}

	decryptedSecrets, err := i.secretService.RevelSecrets(ctx, ref, keys)
	if err != nil {
		return nil, err
	}

	return decryptedSecrets, nil
}

func (i *injectSecretUseCase) injectToEnvironment(secrets []domain.Secret) (map[string]string, error) {
	injectedSecrets := make(map[string]string)
	for _, secret := range secrets {
		if err := os.Setenv(secret.Key, secret.Value); err != nil {
			return nil, err
		}
		injectedSecrets[secret.Key] = secret.Value
	}

	return injectedSecrets, nil
}
