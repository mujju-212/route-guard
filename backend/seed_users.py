"""
seed_users.py — RouteGuard Demo Account Seeder
===============================================
Creates one fully-detailed demo account for each role:
  manager  / shipper  / driver  / receiver

Run from the backend/ directory:
    python seed_users.py

Uses raw SQL INSERT to bypass SQLAlchemy enum serialization.
Safe to re-run: skips already-existing emails.
"""

import sys
import os
import uuid

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.database.postgres import engine, Base
from app.utils.auth import hash_password
from sqlalchemy import text

# ensure tables exist
Base.metadata.create_all(bind=engine)

DEMO_USERS = [
    {
        "full_name":    "Sarah Chen",
        "email":        "manager@routeguard.com",
        "password":     "Manager123",
        "role":         "manager",
        "company_name": "RouteGuard Logistics HQ",
        "phone_number": "+1-415-555-0101",
        "country":      "United States",
    },
    {
        "full_name":    "Kim Ji-ho",
        "email":        "shipper@routeguard.com",
        "password":     "Shipper123",
        "role":         "shipper",
        "company_name": "Nexus Global Exports Ltd.",
        "phone_number": "+82-2-555-0202",
        "country":      "South Korea",
    },
    {
        "full_name":    "Park Jae-won",
        "email":        "driver@routeguard.com",
        "password":     "Driver1234",
        "role":         "driver",
        "company_name": "FastLane Freight Carriers",
        "phone_number": "+82-10-555-0303",
        "country":      "South Korea",
    },
    {
        "full_name":    "Anna Schmidt",
        "email":        "receiver@routeguard.com",
        "password":     "Receiver123",
        "role":         "receiver",
        "company_name": "Euro Distribution GmbH",
        "phone_number": "+49-30-555-0404",
        "country":      "Germany",
    },
]


def seed():
    created, skipped = 0, 0

    print("=" * 55)
    print("  RouteGuard - Demo Account Seeder")
    print("=" * 55)

    with engine.begin() as conn:
        for u in DEMO_USERS:
            # check if already exists
            existing = conn.execute(
                text("SELECT user_id FROM users WHERE email = :email"),
                {"email": u["email"]},
            ).first()

            if existing:
                print(f"  SKIP   {u['email']}  (already exists)")
                skipped += 1
                continue

            uid = str(uuid.uuid4())
            pwd_hash = hash_password(u["password"][:72])

            conn.execute(
                text("""
                    INSERT INTO users
                        (user_id, full_name, email, password_hash, role,
                         company_name, phone_number, country, is_active)
                    VALUES
                        (:user_id, :full_name, :email, :password_hash, :role::user_role,
                         :company_name, :phone_number, :country, true)
                """),
                {
                    "user_id":      uid,
                    "full_name":    u["full_name"],
                    "email":        u["email"],
                    "password_hash": pwd_hash,
                    "role":         u["role"],
                    "company_name": u["company_name"],
                    "phone_number": u["phone_number"],
                    "country":      u["country"],
                },
            )
            print(f"  CREATE [{u['role']:8s}]  {u['email']}  id={uid}")
            created += 1

    print()
    print(f"  Done: {created} created, {skipped} skipped.")
    print()
    print("  Login Credentials:")
    print("  ─────────────────────────────────────────────────────────────")
    print(f"  {'Role':<10}  {'Email':<35}  {'Password'}")
    print("  ─────────────────────────────────────────────────────────────")
    for u in DEMO_USERS:
        print(f"  {u['role']:<10}  {u['email']:<35}  {u['password']}")
    print("  ─────────────────────────────────────────────────────────────")
    print()


if __name__ == "__main__":
    seed()
