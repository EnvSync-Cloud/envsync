package spinner

import (
	"bytes"
	"strings"
	"testing"
)

// The spinner must be silent unless the caller enabled it, so piped and
// machine-readable output never picks up ANSI escape sequences.
func TestSpinnerDisabledDrawsNothing(t *testing.T) {
	var buf bytes.Buffer
	s := New("working…", false, &buf)

	s.Start()
	s.Stop()

	if buf.Len() != 0 {
		t.Errorf("disabled spinner wrote %q, want no output", buf.String())
	}
}

// Stop has to erase the line, otherwise the animation is left on screen and the
// caller's success message cannot take its place.
func TestSpinnerStopClearsTheLine(t *testing.T) {
	var buf bytes.Buffer
	s := New("Waiting for sign-in…", true, &buf)

	s.Start()
	s.Stop()

	out := buf.String()
	if !strings.Contains(out, "Waiting for sign-in…") {
		t.Errorf("spinner never showed its message: %q", out)
	}
	if !strings.HasPrefix(out, clearLine) {
		t.Errorf("spinner did not start with a line clear: %q", out)
	}
	if !strings.HasSuffix(out, clearLine) {
		t.Errorf("Stop() did not erase the spinner line: %q", out)
	}
}

func TestSpinnerStopWithoutStartIsSafe(t *testing.T) {
	var buf bytes.Buffer
	s := New("working…", true, &buf)

	s.Stop() // must not panic

	if buf.Len() != 0 {
		t.Errorf("Stop() without Start() wrote %q, want no output", buf.String())
	}
}

func TestSpinnerStartIsIdempotent(t *testing.T) {
	var buf bytes.Buffer
	s := New("working…", true, &buf)

	s.Start()
	s.Start() // second call must not start a second animation
	s.Stop()

	if !strings.HasSuffix(buf.String(), clearLine) {
		t.Errorf("output not terminated by a line clear: %q", buf.String())
	}
}

func TestIsTerminalRejectsNonFileWriters(t *testing.T) {
	if IsTerminal(&bytes.Buffer{}) {
		t.Error("bytes.Buffer reported as a terminal")
	}
}
