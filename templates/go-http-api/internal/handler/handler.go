package handler

import (
	"encoding/json"
	"net/http"
)

func Register(mux *http.ServeMux) {
	mux.HandleFunc("GET /health", health)
	mux.HandleFunc("GET /items", listItems)
	mux.HandleFunc("POST /items", createItem)
}

func health(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

func listItems(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, []any{})
}

func createItem(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Name string `json:"name"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.Name == "" {
		http.Error(w, "name is required", http.StatusBadRequest)
		return
	}
	writeJSON(w, http.StatusCreated, map[string]string{"name": body.Name})
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(v) //nolint:errcheck
}
