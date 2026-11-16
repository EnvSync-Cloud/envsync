package certificate

import (
	"context"

	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/domain"
	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/services"
	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/telemetry"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"
)

type checkOCSPUseCase struct {
	service services.CertificateService
}

func NewCheckOCSPUseCase() CheckOCSPUseCase {
	service := services.NewCertificateService()
	return &checkOCSPUseCase{service: service}
}

func (uc *checkOCSPUseCase) Execute(ctx context.Context, serialHex string) (ocspResult *domain.OCSPResult, err error) {
	ctx, end := telemetry.StartSpan(ctx, "certificate.check_ocsp",
		trace.WithAttributes(attribute.String("cert.serial", serialHex)))
	defer end(&err)

	if serialHex == "" {
		return nil, NewValidationError("certificate serial number is required", ErrSerialRequired)
	}

	result, err := uc.service.CheckOCSP(ctx, serialHex)
	if err != nil {
		return nil, NewServiceError("failed to check OCSP status", err)
	}

	return &result, nil
}
