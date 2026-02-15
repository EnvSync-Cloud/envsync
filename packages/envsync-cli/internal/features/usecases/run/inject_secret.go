package run

import (
	"context"
	"os"

	"github.com/EnvSync-Cloud/envsync-cli/internal/domain"
	"github.com/EnvSync-Cloud/envsync-cli/internal/services"
	"github.com/EnvSync-Cloud/envsync-cli/internal/utils"
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

func (i *injectSecretUseCase) Execute(ctx context.Context) (map[string]string, error) {
	managedSecret := ctx.Value("managedSecret").(bool)
	privateKeyPath := ctx.Value("privateKeyPath").(string)
	appID := ctx.Value("appID").(string)
	envTypeID := ctx.Value("envTypeID").(string)

	secrets, err := i.getAllSecrets(appID, envTypeID)
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
		decryptedSecrets, err = i.decryptManagedSecrets(secrets, appID, envTypeID)
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

func (i *injectSecretUseCase) getAllSecrets(appID, envTypeID string) ([]domain.Secret, error) {
	secrets, err := i.secretService.GetAllSecrets(appID, envTypeID)
	if err != nil {
		return nil, err
	}

	return secrets, nil
}

func (i *injectSecretUseCase) decryptSecretsLocally(secrets []domain.Secret, privateKeyPEM string) ([]domain.Secret, error) {
	for _, secret := range secrets {
		decryptedValue, err := utils.SmartDecrypt(secret.Value, privateKeyPEM)
		if err != nil {
			return nil, err
		}
		secret.Value = decryptedValue
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

func (i *injectSecretUseCase) decryptManagedSecrets(secrets []domain.Secret, appID, envTypeID string) ([]domain.Secret, error) {
	keys := make([]string, len(secrets))
	for i, secret := range secrets {
		keys[i] = secret.Key
	}

	decryptedSecrets, err := i.secretService.RevelSecrets(appID, envTypeID, keys)
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
