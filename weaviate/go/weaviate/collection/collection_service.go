package collection

import (
	"context"
	"log"
	"log/slog"

	"github.com/weaviate/weaviate-go-client/v4/weaviate"
	"github.com/weaviate/weaviate/entities/models"
)

func New(ctx context.Context, client *weaviate.Client) CollectionService {
	return &collection{
		client: client,
		ctx:    ctx,
	}
}

type collection struct {
	ctx    context.Context
	client *weaviate.Client
}

type CollectionService interface {
	// Vector付きのコレクションを作成します
	CreateWithVector(args CollectionCreateWithVectorArgs) error
}

func (c *collection) CreateWithVector(args CollectionCreateWithVectorArgs) error {
	vectorConfig := make(map[string]models.VectorConfig, len(args.FieldNames))
	properties := make([]*models.Property, len(args.FieldNames))

	for i, field := range args.FieldNames {
		vectorName := field + "_vector"
		vectorConfig[vectorName] = models.VectorConfig{
			Vectorizer: map[string]interface{}{
				"text2vec-openai": map[string]interface{}{
					"model":      "text-embedding-3-small",
					"properties": []string{field},
				},
			},
			VectorIndexType: "hnsw",
		}
		properties[i] = &models.Property{
			Name:     field,
			DataType: []string{"text"},
		}
	}

	classObj := &models.Class{
		Class:        args.Name,
		VectorConfig: vectorConfig,
		Properties:   properties,
	}

	err := c.client.Schema().ClassCreator().WithClass(classObj).Do(context.Background())
	if err != nil {
		log.Fatalf("Failed to create collection: %v", err)
	}

	slog.Info("Collection created successfully")

	return nil
}
