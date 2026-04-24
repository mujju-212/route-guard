import sys; sys.path.insert(0,'.')
from app.database.postgres import engine
from sqlalchemy import text
with engine.connect() as c:
    r = c.execute(text(
        "SELECT typname, enumlabel FROM pg_enum JOIN pg_type ON pg_enum.enumtypid=pg_type.oid ORDER BY typname, enumsortorder"
    ))
    for row in r:
        print(row)
