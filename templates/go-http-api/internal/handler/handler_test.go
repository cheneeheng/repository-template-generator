package handler_test

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"{{PROJECT_NAME}}/internal/handler"
)

func newMux() *http.ServeMux {
	mux := http.NewServeMux()
	handler.Register(mux)
	return mux
}

func TestHealth(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/health", nil)
	rr := httptest.NewRecorder()
	newMux().ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rr.Code)
	}
}

func TestCreateItem(t *testing.T) {
	body := strings.NewReader(`{"name":"widget"}`)
	req := httptest.NewRequest(http.MethodPost, "/items", body)
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()
	newMux().ServeHTTP(rr, req)

	if rr.Code != http.StatusCreated {
		t.Fatalf("expected 201, got %d", rr.Code)
	}
}
