package logger

import (
	"os"
	"path/filepath"
	"runtime"

	"go.opentelemetry.io/contrib/bridges/otelzap"
	sdklog "go.opentelemetry.io/otel/sdk/log"
	"go.uber.org/zap"
	"go.uber.org/zap/zapcore"
	"gopkg.in/natefinch/lumberjack.v2"
)

// NewLogger creates a zap.Logger that writes to stdout and a rotating log file.
// When lp is non-nil an otelzap core is added so log records are also exported
// as OTEL log signals.
func NewLogger(lp *sdklog.LoggerProvider) *zap.Logger {
	stdout := zapcore.AddSync(os.Stdout)

	file := zapcore.AddSync(&lumberjack.Logger{
		Filename:   getLogPath(),
		MaxSize:    10, // megabytes
		MaxBackups: 3,
		MaxAge:     7, // days
	})

	level := zap.NewAtomicLevelAt(zap.InfoLevel)

	productionCfg := zap.NewProductionEncoderConfig()
	productionCfg.TimeKey = "timestamp"
	productionCfg.EncodeTime = zapcore.ISO8601TimeEncoder

	developmentCfg := zap.NewDevelopmentEncoderConfig()
	developmentCfg.EncodeLevel = zapcore.CapitalColorLevelEncoder

	consoleEncoder := zapcore.NewConsoleEncoder(developmentCfg)
	fileEncoder := zapcore.NewJSONEncoder(productionCfg)

	cores := []zapcore.Core{
		zapcore.NewCore(consoleEncoder, stdout, level),
		zapcore.NewCore(fileEncoder, file, level),
	}

	if lp != nil {
		cores = append(cores, otelzap.NewCore("envsync-cli", otelzap.WithLoggerProvider(lp)))
	}

	core := zapcore.NewTee(cores...)

	return zap.New(core)
}

func getLogPath() string {
	var logDir string

	homeDir, err := os.UserHomeDir()
	if err != nil {
		panic("failed to get user home directory: " + err.Error())
	}

	switch runtime.GOOS {
	case "windows":
		logDir = filepath.Join(homeDir, "envsync", "logs")
	case "darwin": // macOS
		logDir = filepath.Join(homeDir, ".local", "envsync", "logs")
	default: // Linux and others
		logDir = filepath.Join(homeDir, ".local", "envsync", "logs")
	}

	// Create directory if it doesn't exist
	os.MkdirAll(logDir, 0755)

	return filepath.Join(logDir, "envsync.log")
}
