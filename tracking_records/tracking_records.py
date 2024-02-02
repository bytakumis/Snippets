import os

import fire
import mysql.connector
from dotenv import load_dotenv


class Tracker:
    def __init__(self):

        load_dotenv(".env")
        
        self.conn = mysql.connector.connect(
            host=os.getenv("host"),
            port=int(os.getenv("port")),
            user=os.getenv("user"),
            password=os.getenv("password"),
            database=os.getenv("database"),
        )

    def count_records(self, datetime):
        """指定された日時以降に作成されたレコードの数をカウントします。
        
        Args:
            datetime (str): カウントの基準となる日時（例：'2023-01-01 00:00:00'）
        """
        try:
            with self.conn.cursor(buffered=True) as cursor:
                # テーブル一覧を取得
                cursor.execute("show tables")
                rows = cursor.fetchall()
                # テーブルごとにレコード数を取得
                for row in rows:
                    try:
                        table_name = row[0]
                        # created_atがあるテーブルのレコード数を取得
                        cursor.execute(f"select count(*) from `{table_name}` where created_at > `{datetime}`")
                        record_count = cursor.fetchone()[0]
                        if record_count == 0:
                            # 新規レコードがないテーブルはスキップ
                            continue
                        # レコード数を出力
                        print(f"{table_name}: {record_count}レコード")
                    except mysql.connector.errors.ProgrammingError as e:
                        # created_atがないテーブルはスキップ
                        continue
        finally:
            self.conn.close()

if __name__ == '__main__':
    fire.Fire(Tracker)
