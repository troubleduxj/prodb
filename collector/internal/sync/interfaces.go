package sync

import (
	"context"
	"io"
	"net/http"
)

// AuthManagerInterface defines the interface for authentication managers
type AuthManagerInterface interface {
	Start(ctx context.Context) error
	Stop()
	CreateAuthenticatedRequest(method, url string, body io.Reader) (*http.Request, error)
}