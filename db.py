import sqlite3
import os

DB_PATH = os.path.expanduser("~/datas/tracks.sqlite3")

def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn
