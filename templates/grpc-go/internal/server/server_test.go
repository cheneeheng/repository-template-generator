package server_test

import (
	"context"
	"net"
	"testing"

	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"

	pb "{{PROJECT_NAME}}/internal/pb"
	"{{PROJECT_NAME}}/internal/server"
)

func startServer(t *testing.T) pb.ItemsClient {
	t.Helper()
	lis, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	s := grpc.NewServer()
	server.Register(s)
	go s.Serve(lis)
	t.Cleanup(s.GracefulStop)

	conn, err := grpc.NewClient(lis.Addr().String(), grpc.WithTransportCredentials(insecure.NewCredentials()))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { conn.Close() })
	return pb.NewItemsClient(conn)
}

func TestCreateAndList(t *testing.T) {
	client := startServer(t)
	ctx := context.Background()

	item, err := client.CreateItem(ctx, &pb.CreateItemRequest{Name: "widget"})
	if err != nil {
		t.Fatal(err)
	}
	if item.Name != "widget" {
		t.Fatalf("expected widget, got %s", item.Name)
	}

	resp, err := client.ListItems(ctx, &pb.ListItemsRequest{})
	if err != nil {
		t.Fatal(err)
	}
	if len(resp.Items) != 1 {
		t.Fatalf("expected 1 item, got %d", len(resp.Items))
	}
}
