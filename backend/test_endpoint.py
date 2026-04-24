import sys, asyncio
sys.path.insert(0, 'd:/AVTIVE PROJ/route guard/backend')
import httpx

async def test():
    async with httpx.AsyncClient(base_url='http://localhost:8000', timeout=15) as c:
        # Try login
        for creds in [
            {'email': 'manager@routeguard.com', 'password': 'Manager@123'},
            {'email': 'admin@routeguard.com', 'password': 'Admin@123'},
        ]:
            resp = await c.post('/auth/login', json=creds)
            if resp.status_code == 200:
                break
        print(f'Login status: {resp.status_code}')
        if resp.status_code != 200:
            print(resp.text[:300])
            return
        token = resp.json().get('access_token')
        ships = await c.get('/manager/shipments', headers={'Authorization': f'Bearer {token}'})
        print(f'Shipments status: {ships.status_code}')
        if ships.status_code == 200:
            data = ships.json()
            print(f'Total shipments: {len(data)}')
            for s in data:
                wpts = len(s.get('route_waypoints') or [])
                tn = s.get('tracking_number', '?')
                orig = s.get('origin_port_name', '?')
                dest = s.get('destination_port_name', '?')
                print(f'  {tn} | {orig} -> {dest} | waypoints={wpts}')
        else:
            print(ships.text[:500])

asyncio.run(test())
