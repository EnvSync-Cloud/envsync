package services

import (
	"errors"
	"net/http"
	"testing"

	core "github.com/EnvSync-Cloud/envsync/sdks/envsync-go-sdk/sdk/core"
)

func TestCAAlreadyExists(t *testing.T) {
	if !caAlreadyExists(core.NewAPIError(http.StatusConflict, errors.New("Organization CA already initialized"))) {
		t.Fatal("plain 409 should count as an existing CA")
	}
	if caAlreadyExists(core.NewAPIError(http.StatusBadRequest, errors.New("bad"))) {
		t.Fatal("400 should not count as an existing CA")
	}
	if caAlreadyExists(errors.New("409: Organization CA already initialized")) {
		t.Fatal("a bare string should not count as an existing CA")
	}
}
