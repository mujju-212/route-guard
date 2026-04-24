import sys
sys.path.insert(0, 'backend')
from app.services.sea_routing_engine import SeaRoutingEngine

print('Loading engine with 20km resolution...')
eng = SeaRoutingEngine(res_km=20)
print(f'Nodes: {eng.graph.number_of_nodes()}')
print(f'Edges: {eng.graph.number_of_edges()}')

# Test Shanghai -> Singapore
r = eng.get_route(121.5, 31.2, 103.8, 1.3)
if r:
    print(f'Shanghai -> Singapore: {r["distKM"]} km (type={r["type"]})')
    print(f'  dFromKM={r["dFromKM"]}  dToKM={r["dToKM"]}')
else:
    print('No route found')

# Test Shanghai -> Mumbai
r2 = eng.get_route(121.5, 31.2, 72.8, 18.9)
if r2:
    print(f'Shanghai -> Mumbai:    {r2["distKM"]} km (type={r2["type"]})')

print('Smoke test PASSED')
