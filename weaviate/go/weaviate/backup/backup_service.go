package backup

import (
	"context"
	"fmt"
	"log/slog"

	"github.com/weaviate/weaviate-go-client/v4/weaviate"
	backupOriginal "github.com/weaviate/weaviate-go-client/v4/weaviate/backup"
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
	Create(arg BackupCreateArg) error
}

func (c *backup) Create(args BackupCreateArg) error {
	// TODO: 動かん
	result, err := c.client.Backup().Creator().
		WithIncludeClassNames(args.CollectionName).
		WithBackend(backupOriginal.BACKEND_GCS).
		WithBackupID(args.BackupID).
		WithWaitForCompletion(true).
		Do(c.ctx)
	if err != nil {
		return fmt.Errorf("failed to create backup to weaviate: %w", err)
	}

	slog.Info("successfuly create backup", "result", result)
	return nil

}
