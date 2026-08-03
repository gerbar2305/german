"""Migración segura de datos logísticos de órdenes.

Ejecutar una sola vez desde la carpeta backend:

    python migrate_load_logistics.py
"""

from sqlalchemy import inspect, text

from app.db.database import engine


COLUMNS = {
    "vessel_name": "VARCHAR(120) NOT NULL DEFAULT ''",
    "voyage_number": "VARCHAR(80) NOT NULL DEFAULT ''",
    "booking_number": "VARCHAR(100) NOT NULL DEFAULT ''",
    "loading_port": "VARCHAR(120) NOT NULL DEFAULT ''",
    "destination_port": "VARCHAR(120) NOT NULL DEFAULT ''",
    "loading_date": "DATETIME",
    "sailing_date": "DATETIME",
    "carrier_name": "VARCHAR(120) NOT NULL DEFAULT ''",
    "operator_name": "VARCHAR(120) NOT NULL DEFAULT ''",
}


def main():
    existing = {
        column["name"]
        for column in inspect(engine).get_columns("loads")
    }

    with engine.begin() as connection:
        for name, definition in COLUMNS.items():
            if name in existing:
                print(f"• {name} ya existe")
                continue

            connection.execute(
                text(
                    f"ALTER TABLE loads "
                    f"ADD COLUMN {name} {definition}"
                )
            )
            print(f"✓ {name}")

    print("✓ Migración logística finalizada sin borrar cargas")


if __name__ == "__main__":
    main()
