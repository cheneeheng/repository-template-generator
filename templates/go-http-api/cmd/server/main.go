package main

import (
	"log/slog"
	"net/http"
	"os"

	"{{PROJECT_NAME}}/internal/handler"
)

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	mux := http.NewServeMux()
	handler.Register(mux)

	slog.Info("server starting", "port", port)
	if err := http.ListenAndServe(":"+port, mux); err != nil {
		slog.Error("server failed", "err", err)
		os.Exit(1)
	}
}
