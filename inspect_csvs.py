import pandas as pd
import json
import os
import csv

files = [
    r"ml/data/eminserkanerdonmez__ais-dataset/ais_data.csv",
    r"ml/data/satyamrajput7913__ais-ship-tracking-vessel-dynamics-and-eta-data/processed_AIS_dataset.csv",
    r"ml/data/ibrahimonmars__global-cargo-ships-dataset/Cleaned_ships_data.csv",
    r"ml/data/ibrahimonmars__global-cargo-ships-dataset/Port_locations.csv",
    r"ml/data/mexwell__world-port-index/UpdatedPub150.csv",
    r"ml/data/rajkumarpandey02__world-wide-port-index-data/World_Port_Index.csv"
]

results = {}

for f in files:
    exists = os.path.exists(f)
    info = {"exists": exists}
    if exists:
        try:
            # Try pandas first
            df = pd.read_csv(f, nrows=1)
            cols = df.columns.tolist()
            info["column_count"] = len(cols)
            info["first_30_columns"] = cols[:30]
        except Exception as e:
            # Fallback to csv module
            try:
                with open(f, mode='r', encoding='utf-8', errors='ignore') as csvfile:
                    reader = csv.reader(csvfile)
                    cols = next(reader)
                    info["column_count"] = len(cols)
                    info["first_30_columns"] = cols[:30]
            except Exception as e2:
                info["error"] = str(e2)
    results[f] = info

print(json.dumps(results, indent=2))
