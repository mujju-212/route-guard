"""
patch_route_waypoints.py
------------------------
One-time script to replace the great-circle (slerp) waypoints stored in
the 'routes' table with real sea-route waypoints from the marnet engine.

Run from the project root:
    python patch_route_waypoints.py

Or with a dry-run to preview counts first:
    python patch_route_waypoints.py --dry-run
"""

import sys
import asyncio
import argparse

sys.path.insert(0, "backend")

from app.database.postgres import SessionLocal
from app.models.route import Route
from app.models.port import Port
from app.services.sea_routing_engine import get_sea_routing_engine


def _downsample(points: list, max_pts: int = 120) -> list:
    if len(points) <= max_pts:
        return points
    step = (len(points) - 1) / (max_pts - 1)
    return [points[round(i * step)] for i in range(max_pts)]


def patch(dry_run: bool = False):
    print("Loading sea routing engine (20km)…")
    engine = get_sea_routing_engine(res_km=20)
    print(f"  nodes={engine.graph.number_of_nodes()}  edges={engine.graph.number_of_edges()}")

    db = SessionLocal()
    try:
        routes = db.query(Route).all()
        print(f"\nFound {len(routes)} routes in DB")

        updated = 0
        skipped = 0
        failed  = 0

        for route in routes:
            # Get port coordinates
            origin_port = db.query(Port).filter(Port.port_id == route.origin_port_id).first()
            dest_port   = db.query(Port).filter(Port.port_id == route.destination_port_id).first()

            if not origin_port or not dest_port:
                print(f"  [SKIP] route {route.route_id} — missing port record")
                skipped += 1
                continue

            o_lon = float(origin_port.longitude)
            o_lat = float(origin_port.latitude)
            d_lon = float(dest_port.longitude)
            d_lat = float(dest_port.latitude)

            try:
                wps_raw = engine.get_waypoints(o_lon, o_lat, d_lon, d_lat)
            except Exception as exc:
                print(f"  [FAIL] route {route.route_id} — engine error: {exc}")
                failed += 1
                continue

            if not wps_raw or len(wps_raw) < 2:
                print(f"  [FAIL] route {route.route_id} — no waypoints returned")
                failed += 1
                continue

            wps = _downsample(wps_raw, 120)

            # Also recalculate real distance from engine
            result = engine.get_route(o_lon, o_lat, d_lon, d_lat)
            real_dist = result["distKM"] if result else route.total_distance_km

            if dry_run:
                print(
                    f"  [DRY]  route {route.route_id} | "
                    f"{origin_port.port_name} -> {dest_port.port_name} | "
                    f"{len(wps)} waypoints | {real_dist} km"
                )
            else:
                route.waypoints = wps
                route.total_distance_km = real_dist
                route.estimated_duration_hr = round(real_dist / 28.0, 2)
                route.estimated_fuel_cost  = round(real_dist * 2.4, 2)
                print(
                    f"  [OK]   route {route.route_id} | "
                    f"{origin_port.port_name} -> {dest_port.port_name} | "
                    f"{len(wps)} waypoints | {real_dist} km"
                )

            updated += 1

        if not dry_run:
            db.commit()
            print(f"\n✅ Committed {updated} routes | skipped={skipped} | failed={failed}")
        else:
            print(f"\n[DRY RUN] Would update {updated} routes | skipped={skipped} | failed={failed}")

    finally:
        db.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Patch DB routes with real sea-route waypoints")
    parser.add_argument("--dry-run", action="store_true", help="Preview without writing to DB")
    args = parser.parse_args()
    patch(dry_run=args.dry_run)
