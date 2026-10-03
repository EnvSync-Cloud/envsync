// Package spinner renders a single-line activity indicator for long waits.
package spinner

import (
	"fmt"
	"io"
	"os"
	"sync"
	"time"

	charmspinner "github.com/charmbracelet/bubbles/spinner"

	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/presentation/style"
)

// clearLine returns the cursor to column 0 and erases the line, so the
// animation can be replaced by the caller's own output.
const clearLine = "\r\033[2K"

// Spinner animates a status line while blocking work is in flight.
//
// It draws to stderr so machine-readable stdout stays clean, and it draws
// nothing unless the caller decided the destination is an interactive
// terminal. Unlike style.Render it deliberately leaves the line unterminated:
// the animation owns the line and rewrites it in place.
type Spinner struct {
	out      io.Writer
	enabled  bool
	message  string
	frames   []string
	interval time.Duration

	mu      sync.Mutex
	running bool
	stop    chan struct{}
	done    chan struct{}
}

// New returns a spinner that writes to out and animates only while enabled.
//
// Terminal policy belongs at the call site: the spinner cannot know whether the
// surrounding command asked for machine-readable output.
func New(message string, enabled bool, out io.Writer) *Spinner {
	preset := charmspinner.Dot
	return &Spinner{
		out:      out,
		enabled:  enabled,
		message:  message,
		frames:   preset.Frames,
		interval: preset.FPS,
	}
}

// IsTerminal reports whether w is attached to a character device rather than a
// pipe or a file.
func IsTerminal(w io.Writer) bool {
	f, ok := w.(*os.File)
	if !ok {
		return false
	}
	info, err := f.Stat()
	if err != nil {
		return false
	}
	return info.Mode()&os.ModeCharDevice != 0
}

// Start begins animating. It is a no-op when disabled or already running.
func (s *Spinner) Start() {
	s.mu.Lock()
	if !s.enabled || s.running {
		s.mu.Unlock()
		return
	}
	s.running = true
	s.stop = make(chan struct{})
	s.done = make(chan struct{})
	stop, done := s.stop, s.done
	s.mu.Unlock()

	// Draw immediately so the status is visible without waiting a full tick;
	// the goroutine only advances the frame from here on.
	s.draw(0)

	go func() {
		defer close(done)
		ticker := time.NewTicker(s.interval)
		defer ticker.Stop()
		for i := 1; ; i++ {
			select {
			case <-stop:
				return
			case <-ticker.C:
				s.draw(i)
			}
		}
	}()
}

// Stop ends the animation and erases the spinner line so the caller can print
// its own output in its place.
func (s *Spinner) Stop() {
	s.mu.Lock()
	if !s.running {
		s.mu.Unlock()
		return
	}
	s.running = false
	close(s.stop)
	done := s.done
	s.mu.Unlock()

	<-done

	s.mu.Lock()
	defer s.mu.Unlock()
	fmt.Fprint(s.out, clearLine)
}

func (s *Spinner) draw(i int) {
	frame := s.frames[i%len(s.frames)]

	s.mu.Lock()
	defer s.mu.Unlock()
	// Render inline: style.Render terminates the line, which would make the
	// terminal scroll instead of rewriting in place.
	fmt.Fprintf(s.out, "%s%s %s", clearLine, style.SpinnerStyle.Render(frame), s.message)
}
