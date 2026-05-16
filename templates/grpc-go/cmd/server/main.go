package main

import (
	"log/slog"
	"net"
	"os"

	"google.golang.org/grpc"
	"google.golang.org/grpc/health"
	"google.golang.org/grpc/health/grpc_health_v1"
	"google.golang.org/grpc/reflection"

	"{{PROJECT_NAME}}/internal/server"
)

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "50051"
	}

	lis, err := net.Listen("tcp", ":"+port)
	if err != nil {
		slog.Error("failed to listen", "err", err)
		os.Exit(1)
	}

	s := grpc.NewServer()
	server.Register(s)
	grpc_health_v1.RegisterHealthServer(s, health.NewServer())
	reflection.Register(s)

	slog.Info("gRPC server listening", "port", port)
	if err := s.Serve(lis); err != nil {
		slog.Error("server failed", "err", err)
		os.Exit(1)
	}
}
