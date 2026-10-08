package domain

import "testing"

func TestResolveSignMode(t *testing.T) {
	tests := []struct {
		name   string
		input  string
		want   string
		wantOK bool
	}{
		{name: "binary", input: "binary", want: "binary", wantOK: true},
		{name: "text", input: "text", want: "text", wantOK: true},
		{name: "clearsign", input: "clearsign", want: "clearsign", wantOK: true},
		{name: "case and padding are ignored", input: " ClearSign ", want: "clearsign", wantOK: true},
		{name: "unknown mode", input: "armored", want: "", wantOK: false},
		{name: "empty", input: "", want: "", wantOK: false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, ok := ResolveSignMode(tt.input)
			if ok != tt.wantOK || got != tt.want {
				t.Errorf("ResolveSignMode(%q) = (%q, %v), want (%q, %v)", tt.input, got, ok, tt.want, tt.wantOK)
			}
		})
	}
}
