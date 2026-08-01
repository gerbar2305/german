from sqlalchemy import inspect, text
from app.db.database import engine

COLUMNS = {
    "client_name": "VARCHAR(120) NOT NULL DEFAULT ''",
    "project_name": "VARCHAR(160) NOT NULL DEFAULT ''",
    "notes": "TEXT NOT NULL DEFAULT ''",
    "total_weight_kg": "FLOAT NOT NULL DEFAULT 0",
    "total_volume_m3": "FLOAT NOT NULL DEFAULT 0",
    "center_of_gravity_x": "FLOAT",
    "center_of_gravity_y": "FLOAT",
    "center_of_gravity_z": "FLOAT",
    "optimized_at": "DATETIME",
    "report_path": "VARCHAR(500) NOT NULL DEFAULT ''",
    "updated_at": "DATETIME",
}

def main():
    existing = {column["name"] for column in inspect(engine).get_columns("loads")}
    with engine.begin() as connection:
        for name, definition in COLUMNS.items():
            if name not in existing:
                connection.execute(text(f"ALTER TABLE loads ADD COLUMN {name} {definition}"))
                print(f"✓ {name}")
        connection.execute(text(
            "UPDATE loads SET status='pending' "
            "WHERE status IS NULL OR status='' OR status='draft'"
        ))
        connection.execute(text(
            "UPDATE loads SET updated_at=created_at WHERE updated_at IS NULL"
        ))
    print("✓ Migración finalizada sin borrar cargas")

if __name__ == "__main__":
    main()
