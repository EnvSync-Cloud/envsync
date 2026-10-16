package commands

import (
	"context"
	"time"

	"github.com/urfave/cli/v3"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"
	"go.uber.org/zap"

	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/config"
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
	appHandler           *handlers.AppHandler
	authHandler          *handlers.AuthHandler
	configHandler        *handlers.ConfigHandler
	environmentHandler   *handlers.EnvironmentHandler
	syncHandler          *handlers.SyncHandler
	initHandler          *handlers.InitHandler
	runHandler           *handlers.RunHandler
	genPEMKeyHandler     *handlers.GenPEMKeyHandler
	gpgKeyHandler        *handlers.GpgKeyHandler
	certificateHandler   *handlers.CertificateHandler
	teamHandler          *handlers.TeamHandler
	accessHandler        *handlers.AccessHandler
	requestHandler       *handlers.RequestHandler
	serviceTokenHandler  *handlers.ServiceTokenHandler
	oidcHandler          *handlers.OidcHandler
	samlHandler          *handlers.SamlHandler
	rotationHandler      *handlers.RotationHandler
	dynamicSecretHandler *handlers.DynamicSecretHandler
	logForwardingHandler *handlers.LogForwardingHandler
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
	teamHandler *handlers.TeamHandler,
	accessHandler *handlers.AccessHandler,
	requestHandler *handlers.RequestHandler,
	serviceTokenHandler *handlers.ServiceTokenHandler,
	oidcHandler *handlers.OidcHandler,
	samlHandler *handlers.SamlHandler,
	rotationHandler *handlers.RotationHandler,
	dynamicSecretHandler *handlers.DynamicSecretHandler,
	logForwardingHandler *handlers.LogForwardingHandler,
) *CommandRegistry {
	return &CommandRegistry{
		appHandler:           appHandler,
		authHandler:          authHandler,
		configHandler:        configHandler,
		environmentHandler:   environmentHandler,
		syncHandler:          syncHandler,
		initHandler:          initHandler,
		runHandler:           runHandler,
		genPEMKeyHandler:     genPEMKeyHandler,
		gpgKeyHandler:        gpgKeyHandler,
		certificateHandler:   certificateHandler,
		teamHandler:          teamHandler,
		accessHandler:        accessHandler,
		requestHandler:       requestHandler,
		serviceTokenHandler:  serviceTokenHandler,
		oidcHandler:          oidcHandler,
		samlHandler:          samlHandler,
		rotationHandler:      rotationHandler,
		dynamicSecretHandler: dynamicSecretHandler,
		logForwardingHandler: logForwardingHandler,
	}
}

var version = "dev"

func (r *CommandRegistry) RegisterCLI() *cli.Command {
	root := &cli.Command{
		Name:                  "envsync",
		Usage:                 "EnvSync CLI for managing applications and configurations",
		Version:               version,
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
			TeamCommands(r.teamHandler),
			AccessCommands(r.accessHandler),
			RequestCommands(r.requestHandler),
			ServiceTokenCommands(r.serviceTokenHandler),
			OidcCommands(r.oidcHandler),
			SamlCommands(r.samlHandler),
			RotationCommands(r.rotationHandler),
			DynamicSecretCommands(r.dynamicSecretHandler),
			LogForwardingCommands(r.logForwardingHandler),
		},
	}
	return observe(root, "")
}

// observe wraps every command action in the tree with a root span named after
// the full command path ("cli/app/create") plus command start/finish logs, and
// records any error the action returns on that span before it becomes the exit
// status. Child spans created by use cases nest underneath because the span
// context flows through the action ctx.
func observe(c *cli.Command, parentPath string) *cli.Command {
	full := c.Name
	if parentPath != "" {
		full = parentPath + "/" + c.Name
	}
	if c.Action != nil {
		action := c.Action
		c.Action = func(ctx context.Context, cmd *cli.Command) (err error) {
			ctx, end := telemetry.StartSpan(ctx, "cli/"+full,
				trace.WithAttributes(attribute.String("cli.command", full)))
			defer end(&err)

			l := logger.FromContext(ctx)
			l.Info("command started", zap.String("command", full))
			err = action(ctx, cmd)
			if err == nil {
				l.Info("command finished", zap.String("command", full))
			}
			return err
		}
	}
	for _, sub := range c.Commands {
		observe(sub, full)
	}
	return c
}

func (r *CommandRegistry) beforeHook(ctx context.Context, cmd *cli.Command) (context.Context, error) {
	// Initialise app config
	_ = config.New()

	// Initialise OpenTelemetry (graceful degradation on failure)
	shutdown, lp, _ := telemetry.Init(ctx)
	ctx = context.WithValue(ctx, constants.TelemetryShutdownKey, shutdown)

	l := logger.NewLogger(lp)
	return context.WithValue(ctx, constants.LoggerKey, l), nil
}

func (r *CommandRegistry) afterHook(ctx context.Context, cmd *cli.Command) error {
	// Sync logger. This runs after the command action's span has ended, and
	// before the exporters shut down, so nothing written on the way out is
	// lost.
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
