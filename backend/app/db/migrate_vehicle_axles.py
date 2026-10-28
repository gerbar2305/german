from sqlalchemy import inspect, text

from app.db.database import engine


def column_exists(table_name: str, column_name: str) -> bool:
    inspector = inspect(engine)
    columns = inspector.get_columns(table_name)

    return any(
        column["name"] == column_name
        for column in columns
    )


def add_column_if_missing(
    table_name: str,
    column_name: str,
    column_type: str,
):
    if column_exists(table_name, column_name):
        print(
            f"OK: {table_name}.{column_name} ya existe"
        )
        return

    with engine.begin() as connection:
        connection.execute(
            text(
                f"""
                ALTER TABLE {table_name}
                ADD COLUMN {column_name} {column_type}
                """
            )
        )

    print(
        f"AGREGADA: {table_name}.{column_name}"
    )


def migrate():
    print("Iniciando migración de ejes de vehículos...")

    add_column_if_missing(
        "vehicles",
        "front_axle_position_m",
        "FLOAT",
    )

    add_column_if_missing(
        "vehicles",
        "rear_axle_position_m",
        "FLOAT",
    )

    add_column_if_missing(
        "vehicles",
        "front_axle_max_kg",
        "FLOAT",
    )

    add_column_if_missing(
        "vehicles",
        "rear_axle_max_kg",
        "FLOAT",
    )
add_column_if_missing(
    "vehicles",
    "front_axle_tare_kg",
    "FLOAT",
)

add_column_if_missing(
    "vehicles",
    "rear_axle_tare_kg",
    "FLOAT",
)
print("Migración finalizada correctamente.")


if __name__ == "__main__":
    migrate()