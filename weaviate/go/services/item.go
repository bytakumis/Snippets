package services

import (
	"context"
	"fmt"
	"log"

	"github.com/weaviate/weaviate-go-client/v4/weaviate"
	"github.com/weaviate/weaviate-go-client/v4/weaviate/graphql"
	"github.com/weaviate/weaviate/entities/models"
)

func GetTestData() []map[string]interface{} {
	return []map[string]interface{}{
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

func AddItems(client *weaviate.Client, collectionName string, items []map[string]interface{}) error {
	objects := make([]*models.Object, len(items))

	for i := range items {
		objects[i] = &models.Object{
			Class:      collectionName,
			Properties: items[i],
		}
	}

	batchRes, err := client.Batch().ObjectsBatcher().WithObjects(objects...).Do(context.Background())
	if err != nil {
		log.Fatalf("Failed to add objects to collection %s: %v", collectionName, err)
	}

	for _, res := range batchRes {
		if res.Result.Errors != nil {
			for _, err := range res.Result.Errors.Error {
				log.Printf("Failed to add object: %+v", err)
			}
			log.Fatalf("Failed to add objects to collection %s", collectionName)
		}
	}

	return nil
}

func QueryWithNamedVector(client *weaviate.Client, queries map[string]string) error {
	response, err := client.GraphQL().Get().
		WithClassName("Question").
		WithFields(
			graphql.Field{Name: "question"},
			graphql.Field{Name: "answer"},
			graphql.Field{
				Name: "_additional",
				Fields: []graphql.Field{
					{Name: "distance"},
					{Name: "certainty"},
				},
			},
		).
		WithNearText(client.GraphQL().NearTextArgBuilder().WithConcepts([]string{"プログラミング"}).WithTargetVectors("question_vector")). // TODO: 動的にする
		WithNearText(client.GraphQL().NearTextArgBuilder().WithConcepts([]string{"Go"}).WithTargetVectors("answer_vector")).        // TODO: 動的にする
		WithLimit(2).
		Do(context.Background())
	if err != nil {
		log.Fatalf("Failed to query: %v", err)
	}

	fmt.Println(response)

	return nil
}
