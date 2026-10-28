package handlers

import (
	"context"

	exportuc "github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/features/usecases/export"
	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/utils"
	"github.com/urfave/cli/v3"
)

type ExportHandler struct {
	exportUseCase exportuc.ExportUseCase
}

func NewExportHandler(exportUseCase exportuc.ExportUseCase) *ExportHandler {
	return &ExportHandler{
		exportUseCase: exportUseCase,
	}
}

func (h *ExportHandler) Export(ctx context.Context, cmd *cli.Command) error {
	result, err := h.exportUseCase.Execute(ctx, exportuc.ExportOptions{
		AppID:           cmd.String("app-id"),
		EnvTypeID:       cmd.String("env-type-id"),
		EnvTypeName:     cmd.String("env-type"),
		ConfigPath:      cmd.String("config"),
		Format:          cmd.String("format"),
		EnableSecrets:   cmd.String("enable-secrets"),
		IsSecretManaged: cmd.String("is-secret-managed"),
		PrivateKeyFile:  cmd.String("private-key-file"),
	})
	if err != nil {
		return err
	}

	content, err := exportuc.SerializeResult(result)
	if err != nil {
		return err
	}

	if outputPath := cmd.String("output"); outputPath != "" {
		if err := utils.WriteFile(content, outputPath); err != nil {
			return err
		}
		return nil
	}

	_, err = cmd.Writer.Write([]byte(content))
	return err
}
