package server

import (
	"context"
	"sync"
	"sync/atomic"

	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	pb "{{PROJECT_NAME}}/internal/pb"
)

type ItemsServer struct {
	pb.UnimplementedItemsServer
	mu     sync.RWMutex
	items  []*pb.Item
	nextID atomic.Int32
}

func Register(s *grpc.Server) {
	srv := &ItemsServer{}
	srv.nextID.Store(1)
	pb.RegisterItemsServer(s, srv)
}

func (s *ItemsServer) ListItems(_ context.Context, _ *pb.ListItemsRequest) (*pb.ListItemsResponse, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return &pb.ListItemsResponse{Items: s.items}, nil
}

func (s *ItemsServer) GetItem(_ context.Context, req *pb.GetItemRequest) (*pb.Item, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	for _, item := range s.items {
		if item.Id == req.Id {
			return item, nil
		}
	}
	return nil, status.Errorf(codes.NotFound, "item %d not found", req.Id)
}

func (s *ItemsServer) CreateItem(_ context.Context, req *pb.CreateItemRequest) (*pb.Item, error) {
	if req.Name == "" {
		return nil, status.Error(codes.InvalidArgument, "name is required")
	}
	item := &pb.Item{Id: s.nextID.Add(1) - 1, Name: req.Name}
	s.mu.Lock()
	s.items = append(s.items, item)
	s.mu.Unlock()
	return item, nil
}
