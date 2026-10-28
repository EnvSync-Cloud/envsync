package domain

import "testing"

func TestAPIRefPrefersNames(t *testing.T) {
	ref := (SyncConfig{
		AppName:     " Core Platform ",
		EnvTypeName: "Development",
		AppID:       "app-1",
		EnvTypeID:   "env-1",
	}).APIRef()

	if ref.AppName != "Core Platform" || ref.EnvTypeName != "Development" {
		t.Fatalf("names = %#v", ref)
	}
	if ref.AppID != "" || ref.EnvTypeID != "" {
		t.Fatalf("ids should be omitted when names are set: %#v", ref)
	}
}

func TestAPIRefKeepsLegacyIDs(t *testing.T) {
	ref := (SyncConfig{AppID: "app-1", EnvTypeID: "env-1"}).APIRef()
	if ref.AppID != "app-1" || ref.EnvTypeID != "env-1" {
		t.Fatalf("ref = %#v", ref)
	}
}

func TestFindAppByNameIsCaseSensitive(t *testing.T) {
	apps := []Application{{ID: "1", Name: "Core Platform"}}
	if _, err := FindAppByName(apps, "core platform"); err == nil {
		t.Fatal("expected case-sensitive miss")
	}
	got, err := FindAppByName(apps, " Core Platform ")
	if err != nil {
		t.Fatal(err)
	}
	if got.ID != "1" {
		t.Fatalf("id = %s", got.ID)
	}
}
