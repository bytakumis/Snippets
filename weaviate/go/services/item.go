package services

import (
	"context"
	"fmt"
	"log"

	"github.com/weaviate/weaviate-go-client/v4/weaviate"
	"github.com/weaviate/weaviate-go-client/v4/weaviate/graphql"
	"github.com/weaviate/weaviate/entities/models"
)

func GetTestData() []map[string]string {
	return []map[string]string{
		{
			"question": "このシステムはどのようなサービスを使っていますか？",
			"answer":   "Weaviateを使っています",
		},
		{
			"question": "プログラミング言語は何を使っていますか？",
			"answer":   "Goを使っています",
		},
		{
			"question": "Gitリポジトリサービスは何を使っていますか？",
			"answer":   "GitHubを使っています",
		},
	}
}

func AddItems(client *weaviate.Client, items []map[string]string) error {
	objects := make([]*models.Object, len(items))
	for i := range items {
		objects[i] = &models.Object{
			Class: "Question",
			Properties: map[string]interface{}{
				"question": items[i]["question"],
				"answer":   items[i]["answer"],
			},
		}
	}

	batchRes, err := client.Batch().ObjectsBatcher().WithObjects(objects...).Do(context.Background())
	if err != nil {
		log.Fatalf("Failed to add objects: %v", err)
	}

	for _, res := range batchRes {
		if res.Result.Errors != nil {
			log.Fatalf("Failed to add object: %v", res.Result.Errors)
		}
	}

	return nil
}

func Query(client *weaviate.Client, queries []string) error {
	response, err := client.GraphQL().Get().
		WithClassName("Question").
		WithFields(
			graphql.Field{Name: "question"},
			graphql.Field{Name: "answer"},
		).
		WithNearText(client.GraphQL().NearTextArgBuilder().
			WithConcepts(queries)).
		WithLimit(2).
		Do(context.Background())
	if err != nil {
		log.Fatalf("Failed to query: %v", err)
	}

	fmt.Println(response)

	return nil
}
