package record

type RecordInsertArg struct {
	CollectionName string
	Item           []RecordInsertItem
}

type RecordInsertItem struct {
	Header string
	Value  string
}
