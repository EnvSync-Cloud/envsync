package handlers

import (
	"context"
	"errors"
	"os"
	"strconv"
	"strings"

	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/features/usecases/run"
	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/presentation/formatters"
	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/presentation/spinner"
	"github.com/urfave/cli/v3"
)

type RunHandler struct {
	redactUseCase       run.RedactUseCase
	injectEnvUseCase    run.InjectEnvUseCase
	injectSecretUseCase run.InjectSecretsUseCase
	appUseCase          run.FetchAppUseCase
	readConfigUseCase   run.ReadConfigUseCase
	formatter           *formatters.RunFormatter
}

func NewRunHandler(
	ruc run.RedactUseCase,
	iuc run.InjectEnvUseCase,
	isuc run.InjectSecretsUseCase,
	auc run.FetchAppUseCase,
	rcuc run.ReadConfigUseCase,
	formatter *formatters.RunFormatter,
) *RunHandler {
	return &RunHandler{
		redactUseCase:       ruc,
		injectEnvUseCase:    iuc,
		injectSecretUseCase: isuc,
		appUseCase:          auc,
		readConfigUseCase:   rcuc,
		formatter:           formatter,
	}
}

func (h *RunHandler) Run(ctx context.Context, cmd *cli.Command) error {
	c := strings.Split(cmd.String("command"), " ")

	s := spinner.New("Reading config file...", true, os.Stdout)

	if !cmd.Bool("json") {
		s.Start()
	}
	configData, err := h.readConfigUseCase.Execute(ctx)
	if !cmd.Bool("json") {
		s.Stop()
	}
	if err != nil {
		return err
	}

	if err := h.formatter.FormatLog(cmd.Writer, "Fetched project configuration."); err != nil {
		return err
	}

	s = spinner.New("Loading...", true, os.Stdout)
	if !cmd.Bool("json") {
		s.Start()
	}
	app, err := h.appUseCase.Execute(ctx, configData.AppID)
	if !cmd.Bool("json") {
		s.Stop()
	}
	if err != nil {
		return err
	}

	if !cmd.Bool("json") {
		s.Start()
	}
	envs, err := h.injectEnvUseCase.Execute(ctx)
	if !cmd.Bool("json") {
		s.Stop()
	}
	if err != nil {
		return err
	}

	if err := h.formatter.FormatLog(cmd.Writer, "Injected "+strconv.Itoa(len(envs))+" environment variable(s)."); err != nil {
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

		if !cmd.Bool("json") {
			s.Start()
		}
		secrets, err := h.injectSecretUseCase.Execute(ctx)
		if !cmd.Bool("json") {
			s.Stop()
		}
		if err != nil {
			return err
		}

		if err := h.formatter.FormatLog(cmd.Writer, "Injected "+strconv.Itoa(len(secrets))+" secret(s)."); err != nil {
			return err
		}

		for key, value := range secrets {
			envs[key] = value
		}
	}

	if err := h.formatter.FormatRunningStatus(cmd.Writer); err != nil {
		return err
	}
	_ = h.redactUseCase.Execute(ctx, c, envs)

	return nil
}
