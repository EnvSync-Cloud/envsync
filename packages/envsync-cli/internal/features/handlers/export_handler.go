package handlers

import (
	"context"
	"errors"

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
	if cmd.IsSet("app-id") {
		return errors.New("flag --app-id is not supported; use --app")
	}
	if cmd.IsSet("env-type-id") {
		return errors.New("flag --env-type-id is not supported; use --env")
	}

	envName := cmd.String("env")
	if cmd.IsSet("env-type") {
		legacy := cmd.String("env-type")
		if envName != "" && envName != legacy {
			return errors.New("only one of --env or --env-type may be provided")
		}
		if envName == "" {
			envName = legacy
		}
	}

	result, err := h.exportUseCase.Execute(ctx, exportuc.ExportOptions{
		AppName:         cmd.String("app"),
		EnvName:         envName,
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
