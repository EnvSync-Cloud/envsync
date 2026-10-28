package logger

import (
	"context"
	"os"
	"path/filepath"
	"runtime"

	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/constants"
	"go.opentelemetry.io/contrib/bridges/otelzap"
	sdklog "go.opentelemetry.io/otel/sdk/log"
	"go.opentelemetry.io/otel/trace"
	"go.uber.org/zap"
	"go.uber.org/zap/zapcore"
	"gopkg.in/natefinch/lumberjack.v2"
)

// NewLogger creates a zap.Logger that writes to a rotating log file and, when
// lp is non-nil, exports records as OTEL log signals through an otelzap core.
//
// There is deliberately no console core: command results are written to stdout
// (including --json output) and the spinner/TUI own the terminal, so stray log
// writes would corrupt both.
func NewLogger(lp *sdklog.LoggerProvider) *zap.Logger {
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

	fileEncoder := zapcore.NewJSONEncoder(productionCfg)

	cores := []zapcore.Core{
		zapcore.NewCore(fileEncoder, file, level),
	}

	if lp != nil {
		cores = append(cores, otelzap.NewCore("envsync-cli", otelzap.WithLoggerProvider(lp)))
	}

	core := zapcore.NewTee(cores...)

	return zap.New(core)
}

// FromContext returns the logger attached to ctx by the CLI before-hook. The
// returned logger carries trace_id/span_id of the active span, so records in
// the local log file can be matched against the exported OTEL logs and traces.
// Outside the CLI flow it returns a no-op logger.
func FromContext(ctx context.Context) *zap.Logger {
	l, ok := ctx.Value(constants.LoggerKey).(*zap.Logger)
	if !ok || l == nil {
		return zap.NewNop()
	}
	if sc := trace.SpanFromContext(ctx).SpanContext(); sc.IsValid() {
		return l.With(
			zap.String("trace_id", sc.TraceID().String()),
			zap.String("span_id", sc.SpanID().String()),
		)
	}
	return l
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
