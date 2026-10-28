import sqlite3
from pathlib import Path


BASE_DIR = Path(__file__).resolve().parent
DB_PATH = BASE_DIR / "gerbar_load_planner.db"


def migrate():
    connection = sqlite3.connect(DB_PATH)
    cursor = connection.cursor()

    cursor.execute("PRAGMA table_info(products)")
    columns = {
        row[1]
        for row in cursor.fetchall()
    }

    if "max_stack_weight_kg" not in columns:
        cursor.execute(
            """
            ALTER TABLE products
            ADD COLUMN max_stack_weight_kg FLOAT
            """
        )

        print(
            "Columna max_stack_weight_kg creada correctamente."
        )
    else:
        print(
            "La columna max_stack_weight_kg ya existe."
        )

    connection.commit()
    connection.close()


if __name__ == "__main__":
    migrate()