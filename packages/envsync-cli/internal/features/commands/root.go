package commands

import (
	"context"
	"time"

	"github.com/urfave/cli/v3"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"
	"go.uber.org/zap"

	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/constants"
	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/features/handlers"
	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/logger"
	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/telemetry"
)

// ExecutionMode represents how the command should be executed
type ExecutionMode int

const (
	ExecutionModeJSON ExecutionMode = iota
	ExecutionModeCLI
)

type CommandRegistry struct {
	appHandler         *handlers.AppHandler
	authHandler        *handlers.AuthHandler
	configHandler      *handlers.ConfigHandler
	environmentHandler *handlers.EnvironmentHandler
	syncHandler        *handlers.SyncHandler
	initHandler        *handlers.InitHandler
	runHandler         *handlers.RunHandler
	genPEMKeyHandler   *handlers.GenPEMKeyHandler
	gpgKeyHandler      *handlers.GpgKeyHandler
	certificateHandler *handlers.CertificateHandler
}

func NewCommandRegistry(
	appHandler *handlers.AppHandler,
	authHandler *handlers.AuthHandler,
	configHandler *handlers.ConfigHandler,
	environmentHandler *handlers.EnvironmentHandler,
	syncHandler *handlers.SyncHandler,
	initHandler *handlers.InitHandler,
	runHandler *handlers.RunHandler,
	genPEMKeyHandler *handlers.GenPEMKeyHandler,
	gpgKeyHandler *handlers.GpgKeyHandler,
	certificateHandler *handlers.CertificateHandler,
) *CommandRegistry {
	return &CommandRegistry{
		appHandler:         appHandler,
		authHandler:        authHandler,
		configHandler:      configHandler,
		environmentHandler: environmentHandler,
		syncHandler:        syncHandler,
		initHandler:        initHandler,
		runHandler:         runHandler,
		genPEMKeyHandler:   genPEMKeyHandler,
		gpgKeyHandler:      gpgKeyHandler,
		certificateHandler: certificateHandler,
	}
}

func (r *CommandRegistry) RegisterCLI() *cli.Command {
	return &cli.Command{
		Name:                  "envsync",
		Usage:                 "EnvSync CLI for managing applications and configurations",
		Suggest:               true,
		EnableShellCompletion: true,
		Flags: []cli.Flag{
			&cli.BoolFlag{
				Name:    "json",
				Usage:   "Output in JSON format",
				Aliases: []string{"j"},
				Value:   false,
			},
		},
		Before: r.beforeHook,
		After:  r.afterHook,
		Action: RootCommand(),
		Commands: []*cli.Command{
			AppCommands(r.appHandler),
			AuthCommands(r.authHandler),
			ConfigCommands(r.configHandler),
			EnvironmentCommands(r.environmentHandler),
			PullCommand(r.syncHandler),
			PushCommand(r.syncHandler),
			InitCommand(r.initHandler),
			RunCommand(r.runHandler),
			GenereatePrivateKeyCommand(r.genPEMKeyHandler),
			GpgKeyCommands(r.gpgKeyHandler),
			CertificateCommands(r.certificateHandler),
		},
	}
}

func (r *CommandRegistry) beforeHook(ctx context.Context, cmd *cli.Command) (context.Context, error) {
	// Initialise OpenTelemetry (graceful degradation on failure)
	shutdown, lp, _ := telemetry.Init(ctx)
	ctx = context.WithValue(ctx, constants.TelemetryShutdownKey, shutdown)

	// Start root span for the CLI command
	cmdName := "cli"
	if cmd.Name != "" {
		cmdName = "cli/" + cmd.Name
	}
	var span trace.Span
	ctx, span = telemetry.Tracer().Start(ctx, cmdName,
		trace.WithAttributes(attribute.String("cli.command", cmd.Name)),
	)
	ctx = context.WithValue(ctx, constants.RootSpanKey, span)

	l := logger.NewLogger(lp)
	return context.WithValue(ctx, constants.LoggerKey, l), nil
}

func (r *CommandRegistry) afterHook(ctx context.Context, cmd *cli.Command) error {
	// End root span
	if span, ok := ctx.Value(constants.RootSpanKey).(trace.Span); ok && span != nil {
		span.End()
	}

	// Sync logger
	if l, ok := ctx.Value(constants.LoggerKey).(*zap.Logger); ok && l != nil {
		l.Sync()
	}

	// Shutdown telemetry with timeout
	if shutdown, ok := ctx.Value(constants.TelemetryShutdownKey).(func(context.Context) error); ok && shutdown != nil {
		shutdownCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		shutdown(shutdownCtx)
	}

	return nil
}

func RootCommand() cli.ActionFunc {
	return func(ctx context.Context, cmd *cli.Command) error {
		cmd.Writer.Write([]byte("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"))
		cmd.Writer.Write([]byte("Welcome to EnvSync CLI!\n"))
		cmd.Writer.Write([]byte("Use 'envsync --help' to see available commands.\n"))
		cmd.Writer.Write([]byte("For more information, visit: https://envsync.cloud/docs\n"))
		cmd.Writer.Write([]byte("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"))
		return nil
	}
}
