"""Agrega persistencia del plan 3D a SQLite.

Ejecutar una sola vez desde backend:

    python migrate_load_plans.py
"""

from sqlalchemy import inspect, text

from app.db.database import engine


COLUMNS = {
    "plan_data": "TEXT NOT NULL DEFAULT ''",
    "plan_version": "INTEGER NOT NULL DEFAULT 1",
    "plan_updated_at": "DATETIME",
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

    print("✓ Migración de planes finalizada sin borrar cargas")


if __name__ == "__main__":
    main()
