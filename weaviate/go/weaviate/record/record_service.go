package record

import (
	"context"
	"fmt"
	"log/slog"

	"github.com/weaviate/weaviate-go-client/v4/weaviate"
)

func New(ctx context.Context, client *weaviate.Client) RecordService {
	return &record{
		client: client,
		ctx:    ctx,
	}
}

type record struct {
	ctx    context.Context
	client *weaviate.Client
}

type RecordService interface {
	// Vector付きのコレクションを作成します
	Insert(args RecordInsertArg) error
}

func (c *record) Insert(args RecordInsertArg) error {
	objects := make(map[string]string, len(args.Item))
	for _, record := range args.Item {
		objects[record.Header] = record.Value
	}

	result, err := c.client.Data().Creator().
		WithClassName(args.CollectionName).
		WithProperties(objects).
		Do(c.ctx)
	if err != nil {
		return fmt.Errorf("failed to insert record: %w", err)
	}

	slog.Info("Successfuly record insert", "result", result)
	return nil
}
