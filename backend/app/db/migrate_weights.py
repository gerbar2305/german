from sqlalchemy import inspect, text

from app.db.database import engine


def add_column_if_missing(table_name, column_name):
    inspector = inspect(engine)

    existing_columns = {
        column["name"]
        for column in inspector.get_columns(table_name)
    }

    if column_name in existing_columns:
        print(f"✓ {table_name}.{column_name} ya existe")
        return

    with engine.begin() as connection:
        connection.execute(
            text(
                f"""
                ALTER TABLE {table_name}
                ADD COLUMN {column_name} FLOAT NOT NULL DEFAULT 0
                """
            )
        )

    print(f"✓ Agregada {table_name}.{column_name}")


def run_migration():
    print("Migrando pesos de GerBar...")

    add_column_if_missing(
        "containers",
        "tare_weight_kg",
    )

    add_column_if_missing(
        "containers",
        "max_gross_weight_kg",
    )

    add_column_if_missing(
        "vehicles",
        "tare_weight_kg",
    )

    add_column_if_missing(
        "vehicles",
        "max_gross_weight_kg",
    )

    print("✓ Migración terminada correctamente")


if __name__ == "__main__":
    run_migration()