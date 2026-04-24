import sys
sys.path.insert(0, 'd:/AVTIVE PROJ/route guard/backend')
from app.database.postgres import SessionLocal
from app.models.user import User
from sqlalchemy import text, inspect

db = SessionLocal()
try:
    # Get columns the model expects
    model_cols = [c.name for c in User.__table__.columns]
    print('Model expects:', model_cols)

    # Get columns actually in DB
    result = db.execute(text(
        "SELECT column_name FROM information_schema.columns WHERE table_name='users' ORDER BY ordinal_position"
    )).fetchall()
    db_cols = [r[0] for r in result]
    print('DB has:', db_cols)

    missing = [c for c in model_cols if c not in db_cols]
    print('Missing in DB:', missing)

    # Add each missing column
    type_map = {
        'email_verified': 'BOOLEAN DEFAULT FALSE',
        'phone_verified': 'BOOLEAN DEFAULT FALSE',
        'tos_accepted': 'BOOLEAN DEFAULT FALSE',
        'privacy_accepted': 'BOOLEAN DEFAULT FALSE',
        'shipping_terms_accepted': 'BOOLEAN DEFAULT FALSE',
        'onboarding_completed_at': 'TIMESTAMP NULL',
        'account_type': 'VARCHAR(20) NULL',
    }
    for col in missing:
        col_type = type_map.get(col, 'VARCHAR(100) NULL')
        db.execute(text(f'ALTER TABLE users ADD COLUMN {col} {col_type}'))
        print(f'Added: {col} {col_type}')

    db.commit()
    print('All done')
except Exception as e:
    db.rollback()
    print(f'ERROR: {e}')
    import traceback; traceback.print_exc()
finally:
    db.close()
