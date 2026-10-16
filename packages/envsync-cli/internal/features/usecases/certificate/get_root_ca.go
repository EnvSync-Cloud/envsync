package certificate

import (
	"context"

	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/services"
	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/telemetry"
)

type getRootCAUseCase struct {
	service services.CertificateService
}

func NewGetRootCAUseCase() GetRootCAUseCase {
	service := services.NewCertificateService()
	return &getRootCAUseCase{service: service}
}

func (uc *getRootCAUseCase) Execute(ctx context.Context) (result string, err error) {
	ctx, end := telemetry.StartSpan(ctx, "certificate.get_root_ca")
	defer end(&err)

	certPEM, err := uc.service.GetRootCA(ctx)
	if err != nil {
		return "", NewServiceError("failed to get root CA", err)
	}

	return certPEM, nil
}
