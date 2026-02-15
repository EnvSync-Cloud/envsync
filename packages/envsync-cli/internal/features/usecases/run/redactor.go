package run

import (
	"context"
	"fmt"
	"io"
	"os"
	"os/exec"
	"os/signal"
	"regexp"
	"strings"
	"syscall"
	"time"

	"github.com/aymanbagabas/go-pty"
)

type redactUseCase struct{}

func NewRedactor() RedactUseCase {
	return &redactUseCase{}
}

func (uc *redactUseCase) Execute(ctx context.Context, args []string, envData map[string]string) int {
	if len(args) == 0 {
		fmt.Fprintf(os.Stderr, "No command provided\n")
		return 1
	}

	// Create a new PTY
	ptyMaster, err := pty.New()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error creating PTY: %v\n", err)
		return 1
	}
	defer ptyMaster.Close()

	// Create the command using PTY
	cmd := ptyMaster.Command(args[0], args[1:]...)

	// Set environment variables to force color output
	cmd.Env = append(os.Environ(),
		"FORCE_COLOR=1",
		"CLICOLOR_FORCE=1",
		"TERM=xterm-256color",
	)

	// Start the command
	if err := cmd.Start(); err != nil {
		fmt.Fprintf(os.Stderr, "Error starting command: %v\n", err)
		return 1
	}

	// Handle interrupt signals
	cancelCtx, cancel := context.WithCancel(context.Background())
	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, os.Interrupt, syscall.SIGTERM)

	// Handle signals in a goroutine
	go func() {
		<-sigChan
		fmt.Fprintf(os.Stderr, "\nReceived interrupt signal, terminating command...\n")
		cancel()
		// Forward signal to the child process
		if cmd.Process != nil {
			cmd.Process.Signal(os.Interrupt)
			// Give the process a chance to handle the signal gracefully
			time.Sleep(100 * time.Millisecond)
			// If still running, force kill
			if cmd.ProcessState == nil || !cmd.ProcessState.Exited() {
				cmd.Process.Kill()
			}
		}
	}()

	// Channels to signal completion
	outputDone := make(chan int, 1)
	cmdDone := make(chan int, 1)

	// Handle stdin in a separate goroutine
	go uc.handleStdin(cancelCtx, ptyMaster)

	// Handle stdout/stderr processing
	go uc.handleOutput(cancelCtx, ptyMaster, outputDone, envData)

	// Wait for command completion or context cancellation
	go func() {
		exitCode := 0
		if err := cmd.Wait(); err != nil {
			if exitError, ok := err.(*exec.ExitError); ok {
				exitCode = exitError.ExitCode()
			} else {
				exitCode = 1
			}
		}
		cmdDone <- exitCode
	}()

	// Wait for completion or cancellation
	select {
	case exitCode := <-cmdDone:
		// Wait for output processing to finish with timeout
		select {
		case <-outputDone:
		case <-time.After(1 * time.Second):
			// Timeout waiting for output processing
		}
		cancel()
		return exitCode
	case <-cancelCtx.Done():
		// Wait for command to finish with timeout
		select {
		case exitCode := <-cmdDone:
			return exitCode
		case <-time.After(2 * time.Second):
			// Force kill if still running
			if cmd.Process != nil {
				cmd.Process.Kill()
			}
			return 1
		}
	}
}

func (uc *redactUseCase) handleStdin(ctx context.Context, ptyMaster pty.Pty) {
	// Use a goroutine to handle stdin reading without blocking
	stdinChan := make(chan []byte, 1)
	go func() {
		buffer := make([]byte, 1024)
		for {
			n, err := os.Stdin.Read(buffer)
			if err != nil {
				if err != io.EOF {
					fmt.Fprintf(os.Stderr, "Error reading stdin: %v\n", err)
				}
				return
			}
			if n > 0 {
				// Make a copy of the buffer to send through channel
				data := make([]byte, n)
				copy(data, buffer[:n])
				select {
				case stdinChan <- data:
				case <-ctx.Done():
					return
				}
			}
		}
	}()

	for {
		select {
		case <-ctx.Done():
			return
		case data := <-stdinChan:
			_, writeErr := ptyMaster.Write(data)
			if writeErr != nil {
				fmt.Fprintf(os.Stderr, "Error writing to PTY: %v\n", writeErr)
				return
			}
		}
	}
}

func (uc *redactUseCase) handleOutput(ctx context.Context, ptyMaster pty.Pty, done chan<- int, envData map[string]string) {
	buffer := make([]byte, 4096)
	defer func() {
		done <- 0
	}()

	// Use a goroutine to handle PTY reading without blocking
	outputChan := make(chan []byte, 1)
	errorChan := make(chan error, 1)

	go func() {
		for {
			n, err := ptyMaster.Read(buffer)
			if n > 0 {
				// Make a copy of the buffer to send through channel
				data := make([]byte, n)
				copy(data, buffer[:n])
				select {
				case outputChan <- data:
				case <-ctx.Done():
					return
				}
			}
			if err != nil {
				select {
				case errorChan <- err:
				case <-ctx.Done():
				}
				return
			}
		}
	}()

	for {
		select {
		case <-ctx.Done():
			return
		case data := <-outputChan:
			// Process and redact the output
			text := string(data)
			redactedText := uc.processAndRedactText(text, envData)

			// Write the redacted content to stdout
			_, writeErr := os.Stdout.Write([]byte(redactedText))
			if writeErr != nil {
				fmt.Fprintf(os.Stderr, "Error writing output: %v\n", writeErr)
				return
			}
		case err := <-errorChan:
			if err == io.EOF {
				// Command finished
				return
			}
			fmt.Fprintf(os.Stderr, "Error reading PTY: %v\n", err)
			return
		}
	}
}

func (uc *redactUseCase) processAndRedactText(text string, envData map[string]string) string {
	if len(text) == 0 {
		return text
	}

	return uc.redactWithRegex(text, envData)
}

// redactWithRegex implements regex-based redaction similar to the JavaScript implementation
func (uc *redactUseCase) redactWithRegex(text string, envData map[string]string) string {
	if len(envData) == 0 {
		return text
	}

	output := text

	// Create redaction patterns for each env var (similar to JavaScript implementation)
	for _, value := range envData {
		if value == "" {
			continue
		}

		// Escape special regex characters in the value
		escapedValue := regexp.QuoteMeta(value)

		// Create regex pattern
		pattern, err := regexp.Compile(escapedValue)
		if err != nil {
			// If regex compilation fails, fall back to simple string replacement
			output = strings.ReplaceAll(output, value, "[REDACTED]")
			continue
		}

		// Replace all occurrences with the redacted message
		replacement := "[REDACTED]"
		output = pattern.ReplaceAllString(output, replacement)
	}

	return output
}
