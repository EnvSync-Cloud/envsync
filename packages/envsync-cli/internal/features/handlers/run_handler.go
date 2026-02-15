package handlers

import (
	"context"
	"errors"
	"strings"

	"github.com/EnvSync-Cloud/envsync-cli/internal/features/usecases/run"
	"github.com/urfave/cli/v3"
)

type RunHandler struct {
	redactUseCase       run.RedactUseCase
	injectEnvUseCase    run.InjectEnvUseCase
	injectSecretUseCase run.InjectSecretsUseCase
	appUseCase          run.FetchAppUseCase
	readConfigUseCase   run.ReadConfigUseCase
}

func NewRunHandler(
	ruc run.RedactUseCase,
	iuc run.InjectEnvUseCase,
	isuc run.InjectSecretsUseCase,
	auc run.FetchAppUseCase,
	rcuc run.ReadConfigUseCase,
) *RunHandler {
	return &RunHandler{
		redactUseCase:       ruc,
		injectEnvUseCase:    iuc,
		injectSecretUseCase: isuc,
		appUseCase:          auc,
		readConfigUseCase:   rcuc,
	}
}

func (h *RunHandler) Run(ctx context.Context, cmd *cli.Command) error {
	c := strings.Split(cmd.String("command"), " ")

	configData, err := h.readConfigUseCase.Execute(ctx)
	if err != nil {
		return err
	}

	app, err := h.appUseCase.Execute(ctx, configData.AppID)
	if err != nil {
		return err
	}

	envs, err := h.injectEnvUseCase.Execute(ctx)
	if err != nil {
		return err
	}

	if app.EnableSecrets {
		if !cmd.IsSet("private-key") && !app.IsManagedSecret {
			return errors.New("private-key flag is required when secrets are enabled")
		}

		ctx = context.WithValue(ctx, "managedSecret", app.IsManagedSecret)
		ctx = context.WithValue(ctx, "privateKeyPath", cmd.String("private-key"))
		ctx = context.WithValue(ctx, "appID", configData.AppID)
		ctx = context.WithValue(ctx, "envTypeID", configData.EnvTypeID)

		secrets, err := h.injectSecretUseCase.Execute(ctx)
		if err != nil {
			return err
		}

		for key, value := range secrets {
			envs[key] = value
		}
	}

	_ = h.redactUseCase.Execute(ctx, c, envs)

	return nil
}
