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
			"name":     "とあるお米",
			"code":     "ABC001",
			"price":    "150",
			"supplier": "鈴木農家",
		},
		{
			"name":     "とあるトマト",
			"code":     "ABC002",
			"price":    "250",
			"supplier": "鈴木農家",
		},
		{
			"name":     "スマートフォン",
			"code":     "ABC003",
			"price":    "300000",
			"supplier": "鈴木農園",
		},
		{
			"name":     "ノートパソコン",
			"code":     "ABC004",
			"price":    "400000",
			"supplier": "鈴木農園",
		},
		{
			"name":     "スマートフォン",
			"code":     "ZZZ001",
			"price":    "200000",
			"supplier": "佐藤電気",
		},
		{
			"name":     "ノートパソコン",
			"code":     "ZZZ002",
			"price":    "400000",
			"supplier": "佐藤電気",
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

func QueryWithNamedVector(client *weaviate.Client, collectionName string, queries map[string]string, selectFields []string) error {
	fields := make([]graphql.Field, len(selectFields)+1)
	for i, field := range selectFields {
		fields[i] = graphql.Field{Name: field}
	}
	// For cosine distance
	fields[len(selectFields)] = graphql.Field{
		Name: "_additional",
		Fields: []graphql.Field{
			{Name: "certainty"},
		},
	}

	response, err := client.GraphQL().Get().
		WithClassName(collectionName).
		WithFields(fields...).
		WithNearText(client.GraphQL().NearTextArgBuilder().WithConcepts([]string{"かぼちゃ"}).WithTargetVectors("name_vector")). // TODO: 動的にする
		// WithNearText(client.GraphQL().NearTextArgBuilder().WithConcepts([]string{"鈴木"}).WithTargetVectors("supplier_vector")).  // TODO: 動的にする
		WithLimit(2).
		Do(context.Background())
	if err != nil {
		log.Fatalf("Failed to query: %v", err)
	}

	fmt.Println("________________________--")
	fmt.Println(response)
	fmt.Println("________________________--")

	return nil
}

func UpdateItem(client *weaviate.Client, collectionName string, id string, updatedItem map[string]interface{}) error {
	err := client.Data().Updater().
		WithMerge().
		WithID(id).
		WithClassName(collectionName).
		WithProperties(updatedItem).
		Do(context.Background())

	if err != nil {
		log.Fatalf("Failed to update object: %v", err)
	}

	return nil
}
