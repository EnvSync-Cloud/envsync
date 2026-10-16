package domain

import "strings"

// AccessSubjectTypes lists the subject types `access app` accepts: a grant
// targets exactly one user or one team.
func AccessSubjectTypes() []string {
	return []string{"user", "team"}
}

// AccessRelations lists the access relations `access app` accepts, weakest
// first.
func AccessRelations() []string {
	return []string{"viewer", "editor", "admin"}
}

// ResolveAccessSubjectType matches user input against the accepted subject
// types. Matching ignores case and surrounding space.
func ResolveAccessSubjectType(input string) (string, bool) {
	return resolveAccessOption(input, AccessSubjectTypes())
}

// ResolveAccessRelation matches user input against the accepted relations.
// Matching ignores case and surrounding space.
func ResolveAccessRelation(input string) (string, bool) {
	return resolveAccessOption(input, AccessRelations())
}

func resolveAccessOption(input string, options []string) (string, bool) {
	want := strings.ToLower(strings.TrimSpace(input))
	for _, o := range options {
		if want == o {
			return o, true
		}
	}
	return "", false
}
