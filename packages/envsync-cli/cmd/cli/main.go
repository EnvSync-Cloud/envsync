package main

import (
	"context"
	"log"
	"os"

	"github.com/EnvSync-Cloud/envsync-cli/internal/features/commands"
	"github.com/EnvSync-Cloud/envsync-cli/internal/features/handlers"
	appUseCases "github.com/EnvSync-Cloud/envsync-cli/internal/features/usecases/app"
	authUseCases "github.com/EnvSync-Cloud/envsync-cli/internal/features/usecases/auth"
	certUseCases "github.com/EnvSync-Cloud/envsync-cli/internal/features/usecases/certificate"
	configUseCases "github.com/EnvSync-Cloud/envsync-cli/internal/features/usecases/config"
	envUseCases "github.com/EnvSync-Cloud/envsync-cli/internal/features/usecases/environment"
	genpem "github.com/EnvSync-Cloud/envsync-cli/internal/features/usecases/gen_pem"
	gpgUseCases "github.com/EnvSync-Cloud/envsync-cli/internal/features/usecases/gpg_key"
	inituc "github.com/EnvSync-Cloud/envsync-cli/internal/features/usecases/init"
	"github.com/EnvSync-Cloud/envsync-cli/internal/features/usecases/run"
	syncUseCase "github.com/EnvSync-Cloud/envsync-cli/internal/features/usecases/sync"
	"github.com/EnvSync-Cloud/envsync-cli/internal/presentation/formatters"
)

func main() {
	// Initialize dependencies
	container := buildDependencyContainer()

	// Build command registry with dependencies
	registry := commands.NewCommandRegistry(
		container.AppHandler,
		container.AuthHandler,
		container.ConfigHandler,
		container.EnvironmentHandler,
		container.SyncHandler,
		container.InitHandler,
		container.RunHandler,
		container.GenPEMKeyHandler,
		container.GpgKeyHandler,
		container.CertificateHandler,
	)

	// Build CLI app
	app := registry.RegisterCLI()

	// Run the application
	if err := app.Run(context.Background(), os.Args); err != nil {
		log.Fatal(err)
	}
}

// Container holds the handler dependencies
type Container struct {
	AppHandler         *handlers.AppHandler
	AuthHandler        *handlers.AuthHandler
	ConfigHandler      *handlers.ConfigHandler
	EnvironmentHandler *handlers.EnvironmentHandler
	SyncHandler        *handlers.SyncHandler
	InitHandler        *handlers.InitHandler
	RunHandler         *handlers.RunHandler
	GenPEMKeyHandler   *handlers.GenPEMKeyHandler
	GpgKeyHandler      *handlers.GpgKeyHandler
	CertificateHandler *handlers.CertificateHandler
}

// buildDependencyContainer creates and wires all handler dependencies
func buildDependencyContainer() *Container {
	c := &Container{}

	// Initialize formatters
	appFormatter := formatters.NewAppFormatter()
	authFormatter := formatters.NewAuthFormatter()
	configFormatter := formatters.NewConfigFormatter()
	envFormatter := formatters.NewEnvFormatter()
	initFormatter := formatters.NewInitFormatter()
	syncFormatter := formatters.NewSyncFormatter()

	// Initialize use cases
	createAppUseCase := appUseCases.NewCreateAppUseCase()
	deleteAppUseCase := appUseCases.NewDeleteAppUseCase()
	listAppsUseCase := appUseCases.NewListAppsUseCase()

	loginUseCase := authUseCases.NewLoginUseCase()
	logoutUseCase := authUseCases.NewLogoutUseCase()
	whoamiUseCase := authUseCases.NewWhoamiUseCase()

	setConfigUseCase := configUseCases.NewSetConfigUseCase()
	getConfigUseCase := configUseCases.NewGetConfigUseCase()
	resetConfigUseCase := configUseCases.NewResetConfigUseCase()

	getEnvironmentUseCase := envUseCases.NewGetEnvUseCase()
	switchEnvironmentUseCase := envUseCases.NewSwitchEnvUseCase()
	deleteEnvironmentUseCase := envUseCases.NewDeleteEnvUseCase()

	pullUseCase := syncUseCase.NewPullUseCase()
	pushUseCase := syncUseCase.NewPushUseCase()

	initUC := inituc.NewInitUseCase()

	injectUseCase := run.NewInjectEnv()
	injectSecretUseCase := run.NewInjectSecretUseCase()
	fetchAppUseCase := run.NewFetchAppUseCase()
	readConfigUseCase := run.NewReadConfigUseCase()
	runUseCase := run.NewRedactor()

	genPEMKeyUseCase := genpem.NewGenKeyPairUseCase()

	// GPG key use cases
	gpgListKeysUseCase := gpgUseCases.NewListKeysUseCase()
	gpgGenerateKeyUseCase := gpgUseCases.NewGenerateKeyUseCase()
	gpgSignUseCase := gpgUseCases.NewSignUseCase()
	gpgVerifyUseCase := gpgUseCases.NewVerifyUseCase()
	gpgExportUseCase := gpgUseCases.NewExportUseCase()
	gpgRevokeUseCase := gpgUseCases.NewRevokeUseCase()
	gpgDeleteKeyUseCase := gpgUseCases.NewDeleteKeyUseCase()

	// Certificate use cases
	certInitCAUseCase := certUseCases.NewInitCAUseCase()
	certCAStatusUseCase := certUseCases.NewCAStatusUseCase()
	certIssueCertUseCase := certUseCases.NewIssueCertUseCase()
	certListCertsUseCase := certUseCases.NewListCertsUseCase()
	certRevokeCertUseCase := certUseCases.NewRevokeCertUseCase()
	certCheckOCSPUseCase := certUseCases.NewCheckOCSPUseCase()
	certGetCRLUseCase := certUseCases.NewGetCRLUseCase()
	certGetRootCAUseCase := certUseCases.NewGetRootCAUseCase()

	// Initialize handlers
	c.AppHandler = handlers.NewAppHandler(
		createAppUseCase,
		deleteAppUseCase,
		listAppsUseCase,
		appFormatter,
	)

	c.AuthHandler = handlers.NewAuthHandler(
		loginUseCase,
		logoutUseCase,
		whoamiUseCase,
		authFormatter,
	)

	c.ConfigHandler = handlers.NewConfigHandler(
		setConfigUseCase,
		getConfigUseCase,
		resetConfigUseCase,
		configFormatter,
	)

	c.EnvironmentHandler = handlers.NewEnvironmentHandler(
		getEnvironmentUseCase,
		switchEnvironmentUseCase,
		deleteEnvironmentUseCase,
		envFormatter,
	)

	c.SyncHandler = handlers.NewSyncHandler(
		pullUseCase,
		pushUseCase,
		syncFormatter,
	)

	c.InitHandler = handlers.NewInitHandler(
		initUC,
		initFormatter,
	)

	c.RunHandler = handlers.NewRunHandler(
		runUseCase,
		injectUseCase,
		injectSecretUseCase,
		fetchAppUseCase,
		readConfigUseCase,
	)

	c.GenPEMKeyHandler = handlers.NewGenPEMKeyHandler(
		genPEMKeyUseCase,
	)

	gpgKeyFormatter := formatters.NewGpgKeyFormatter()
	c.GpgKeyHandler = handlers.NewGpgKeyHandler(
		gpgListKeysUseCase,
		gpgGenerateKeyUseCase,
		gpgSignUseCase,
		gpgVerifyUseCase,
		gpgExportUseCase,
		gpgRevokeUseCase,
		gpgDeleteKeyUseCase,
		gpgKeyFormatter,
	)

	certFormatter := formatters.NewCertificateFormatter()
	c.CertificateHandler = handlers.NewCertificateHandler(
		certInitCAUseCase,
		certCAStatusUseCase,
		certIssueCertUseCase,
		certListCertsUseCase,
		certRevokeCertUseCase,
		certCheckOCSPUseCase,
		certGetCRLUseCase,
		certGetRootCAUseCase,
		certFormatter,
	)

	return c
}
