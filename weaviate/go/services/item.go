package services

import (
	"context"
	"fmt"
	"log"

	"github.com/weaviate/weaviate-go-client/v4/weaviate"
	"github.com/weaviate/weaviate-go-client/v4/weaviate/filters"
	"github.com/weaviate/weaviate-go-client/v4/weaviate/graphql"
	"github.com/weaviate/weaviate/entities/models"
)

type Item struct {
	client         *weaviate.Client
	collectionName string
}

func NewItem(client *weaviate.Client, collectionName string) *Item {
	return &Item{
		client:         client,
		collectionName: collectionName,
	}
}

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

func (i *Item) Add(items []map[string]interface{}) error {
	objects := make([]*models.Object, len(items))

	for idx := range items {
		objects[idx] = &models.Object{
			Class:      i.collectionName,
			Properties: items[idx],
		}
	}

	batchRes, err := i.client.Batch().ObjectsBatcher().WithObjects(objects...).Do(context.Background())
	if err != nil {
		log.Fatalf("Failed to add objects to collection %s: %v", i.collectionName, err)
	}

	for _, res := range batchRes {
		if res.Result.Errors != nil {
			for _, err := range res.Result.Errors.Error {
				log.Printf("Failed to add object: %+v", err)
			}
			log.Fatalf("Failed to add objects to collection %s", i.collectionName)
		}
	}

	return nil
}

func (i *Item) QueryWithNamedVector(queries map[string]string, selectFields []string) error {
	fields := make([]graphql.Field, len(selectFields)+1)
	for idx, field := range selectFields {
		fields[idx] = graphql.Field{Name: field}
	}
	fields[len(selectFields)] = graphql.Field{
		Name: "_additional",
		Fields: []graphql.Field{
			{Name: "certainty"},
		},
	}

	response, err := i.client.GraphQL().Get().
		WithClassName(i.collectionName).
		WithFields(fields...).
		WithNearText(i.client.GraphQL().NearTextArgBuilder().WithConcepts([]string{"かぼちゃ"}).WithTargetVectors("name_vector")). // TODO: 動的にする
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

func (i *Item) Update(id string, updatedItem map[string]interface{}) error {
	err := i.client.Data().Updater().
		WithMerge().
		WithID(id).
		WithClassName(i.collectionName).
		WithProperties(updatedItem).
		Do(context.Background())

	if err != nil {
		log.Fatalf("Failed to update object: %v", err)
	}

	return nil
}

func (i *Item) ExactSearch(searchField string, searchValue string, selectFields []string) error {
	fields := make([]graphql.Field, len(selectFields))
	for idx, field := range selectFields {
		fields[idx] = graphql.Field{Name: field}
	}

	response, err := i.client.GraphQL().Get().
		WithClassName(i.collectionName).
		WithFields(fields...).
		WithWhere(filters.Where().
			WithPath([]string{searchField}).
			WithOperator(filters.Equal).
			WithValueString(searchValue)).
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

func (i *Item) PartialSearch(searchField string, searchValue string, selectFields []string) error {
	fields := make([]graphql.Field, len(selectFields))
	for idx, field := range selectFields {
		fields[idx] = graphql.Field{Name: field}
	}

	response, err := i.client.GraphQL().Get().
		WithClassName(i.collectionName).
		WithFields(fields...).
		WithWhere(filters.Where().
			WithPath([]string{searchField}).
			WithOperator(filters.Like).
			WithValueString("*" + searchValue + "*")).
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

func (i *Item) HybridSearch(searchField string, searchValue string, selectFields []string) error {
	fields := make([]graphql.Field, len(selectFields)+1)
	for idx, field := range selectFields {
		fields[idx] = graphql.Field{Name: field}
	}
	fields[len(selectFields)] = graphql.Field{
		Name: "_additional",
		Fields: []graphql.Field{
			{Name: "score"},
		},
	}

	response, err := i.client.GraphQL().Get().
		WithClassName(i.collectionName).
		WithFields(fields...).
		WithHybrid(i.client.GraphQL().HybridArgumentBuilder().WithQuery(searchValue).WithTargetVectors(searchField + "_vector").WithAlpha(1.0)).
		Do(context.Background())
	if err != nil {
		log.Fatalf("Failed to query: %v", err)
	}

	fmt.Println("________________________--")
	fmt.Println(response)
	fmt.Println("________________________--")

	return nil
}
