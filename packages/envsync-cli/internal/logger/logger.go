package logger

import (
	"os"
	"path/filepath"
	"runtime"

	"go.uber.org/zap"
	"go.uber.org/zap/zapcore"
	"gopkg.in/natefinch/lumberjack.v2"
)

func NewLogger() *zap.Logger {
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

	core := zapcore.NewTee(
		zapcore.NewCore(consoleEncoder, stdout, level),
		zapcore.NewCore(fileEncoder, file, level),
	)

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
