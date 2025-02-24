package services

import (
	"context"
	"log"
	"log/slog"

	"github.com/weaviate/weaviate-go-client/v4/weaviate"
	"github.com/weaviate/weaviate/entities/models"
)

func CreateCollection(client *weaviate.Client) error {
	// Check if weaviate is ready
	_, err := client.Misc().ReadyChecker().Do(context.Background())
	if err != nil {
		log.Fatalf("Failed to check if weaviate is ready: %v", err)
	}

	// Define the collection
	classObj := &models.Class{
		Class:      "Question", // Collection name
		Vectorizer: "text2vec-cohere",
		ModuleConfig: map[string]interface{}{
			"text2vec-cohere":   map[string]interface{}{},
			"generative-cohere": map[string]interface{}{},
		},
	}

	// add the collection
	err = client.Schema().ClassCreator().WithClass(classObj).Do(context.Background())
	if err != nil {
		log.Fatalf("Failed to create collection: %v", err)
	}

	slog.Info("Collection created successfully")

	return nil
}

func CreateCollectionWithNamedVector(client *weaviate.Client, collectionName string, fields []string) error {

	vectorConfig := make(map[string]models.VectorConfig, len(fields))
	properties := make([]*models.Property, len(fields))

	for i, field := range fields {
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
		Class:        collectionName,
		VectorConfig: vectorConfig,
		Properties:   properties,
	}

	err := client.Schema().ClassCreator().WithClass(classObj).Do(context.Background())
	if err != nil {
		log.Fatalf("Failed to create collection: %v", err)
	}

	slog.Info("Collection created successfully")

	return nil
}
