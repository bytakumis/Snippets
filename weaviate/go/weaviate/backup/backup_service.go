package backup

import (
	"context"

	"github.com/weaviate/weaviate-go-client/v4/weaviate"
)

func New(ctx context.Context, client *weaviate.Client) BackupService {
	return &backup{
		ctx:    ctx,
		client: client,
	}
}

type backup struct {
	ctx    context.Context
	client *weaviate.Client
}

type BackupService interface {
	// バックアップを作成します
	Create() error
}

func (c *backup) Create() error {
	return nil
}
