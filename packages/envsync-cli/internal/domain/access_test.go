package domain

import "testing"

func TestResolveAccessSubjectType(t *testing.T) {
	tests := []struct {
		input  string
		want   string
		wantOK bool
	}{
		{input: "user", want: "user", wantOK: true},
		{input: "TEAM", want: "team", wantOK: true},
		{input: " Team ", want: "team", wantOK: true},
		{input: "admin", wantOK: false},
		{input: "group", wantOK: false},
		{input: "", wantOK: false},
	}

	for _, tt := range tests {
		got, ok := ResolveAccessSubjectType(tt.input)
		if ok != tt.wantOK || got != tt.want {
			t.Errorf("ResolveAccessSubjectType(%q) = (%q, %v), want (%q, %v)", tt.input, got, ok, tt.want, tt.wantOK)
		}
	}
}

func TestResolveAccessRelation(t *testing.T) {
	tests := []struct {
		input  string
		want   string
		wantOK bool
	}{
		{input: "viewer", want: "viewer", wantOK: true},
		{input: "Editor", want: "editor", wantOK: true},
		{input: " ADMIN ", want: "admin", wantOK: true},
		{input: "owner", wantOK: false},
		{input: "read", wantOK: false},
		{input: "", wantOK: false},
	}

	for _, tt := range tests {
		got, ok := ResolveAccessRelation(tt.input)
		if ok != tt.wantOK || got != tt.want {
			t.Errorf("ResolveAccessRelation(%q) = (%q, %v), want (%q, %v)", tt.input, got, ok, tt.want, tt.wantOK)
		}
	}
}
