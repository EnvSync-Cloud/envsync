package certificate

import (
	"context"

	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/repository/responses"
	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/services"
	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/telemetry"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"
)

type revokeCertUseCase struct {
	service services.CertificateService
}

func NewRevokeCertUseCase() RevokeCertUseCase {
	service := services.NewCertificateService()
	return &revokeCertUseCase{service: service}
}

func (uc *revokeCertUseCase) Execute(ctx context.Context, serialHex string, reason int) (revokeResult *responses.RevokeCertResponse, err error) {
	ctx, end := telemetry.StartSpan(ctx, "certificate.revoke_cert",
		trace.WithAttributes(attribute.String("cert.serial", serialHex)))
	defer end(&err)

	if serialHex == "" {
		return nil, NewValidationError("certificate serial number is required", ErrSerialRequired)
	}

	result, err := uc.service.RevokeCert(ctx, serialHex, reason)
	if err != nil {
		return nil, NewServiceError("failed to revoke certificate", err)
	}

	return &result, nil
}
