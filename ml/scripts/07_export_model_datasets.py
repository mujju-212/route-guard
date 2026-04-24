"""
RouteGuard ML - Export per-model train/validation/testing datasets
=================================================================
Creates a unified dataset structure:
  ml/datasets/
    train/
      model1_xgboost/data.csv
      model2_random_forest/data.csv
      model3_gradient_boosting/data.csv
      model4_lstm/data.csv
      model5_kmeans/data.csv
      model6_continuous_improvement/data.csv
    validation/
      ...
    testing/
      ...

This script uses the same split strategy as the training scripts:
- Models 1,2,3,6: 70/15/15 with random_state=42
- Model 4: synthetic sequence generation and 70/15/15 split
- Model 5: route-level aggregation and 70/15/15 split
"""

from __future__ import annotations

from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split

RANDOM_STATE = 42
SEQ_IN = 12
SEQ_OUT = 6
N_SEQ = 80_000

BASE_DIR = Path(__file__).resolve().parents[1]
DATA_DIR = BASE_DIR / "data"
DATASET_DIR = BASE_DIR / "datasets"
TRAINING_PATH = DATA_DIR / "training_dataset.csv"


def ensure_output_dirs(model_name: str) -> dict[str, Path]:
    paths: dict[str, Path] = {}
    for split in ("train", "validation", "testing"):
        path = DATASET_DIR / split / model_name
        path.mkdir(parents=True, exist_ok=True)
        paths[split] = path / "data.csv"
    return paths


def split_70_15_15(df: pd.DataFrame) -> tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame]:
    train_df, temp_df = train_test_split(df, test_size=0.30, random_state=RANDOM_STATE)
    val_df, test_df = train_test_split(temp_df, test_size=0.50, random_state=RANDOM_STATE)
    return train_df, val_df, test_df


def save_splits(model_name: str, train_df: pd.DataFrame, val_df: pd.DataFrame, test_df: pd.DataFrame) -> None:
    output_paths = ensure_output_dirs(model_name)
    train_df.to_csv(output_paths["train"], index=False)
    val_df.to_csv(output_paths["validation"], index=False)
    test_df.to_csv(output_paths["testing"], index=False)


# ------------------------
# Model 1 / 2 / 3 exports
# ------------------------

def export_model1(df: pd.DataFrame) -> tuple[int, int, int]:
    features = [
        "weather_score",
        "traffic_score",
        "port_score",
        "historical_score",
        "cargo_sensitivity",
        "distance_remaining_km",
        "time_of_day",
        "day_of_week",
        "season",
        "speed_ratio",
        "heading_cog_diff",
        "draft_ratio",
        "ETA_hours",
        "SOG_kmh",
    ]
    target = "risk_score"
    model_df = df[features + [target]].dropna().reset_index(drop=True)
    train_df, val_df, test_df = split_70_15_15(model_df)
    save_splits("model1_xgboost", train_df, val_df, test_df)
    return len(train_df), len(val_df), len(test_df)


def export_model2(df: pd.DataFrame) -> tuple[int, int, int]:
    features = [
        "weather_score",
        "traffic_score",
        "port_score",
        "historical_score",
        "cargo_sensitivity",
        "distance_remaining_km",
        "time_of_day",
        "day_of_week",
        "season",
        "speed_ratio",
        "heading_cog_diff",
        "draft_ratio",
        "ETA_hours",
        "SOG_kmh",
        "risk_score",
    ]
    target = "delay_hours"
    model_df = df[features + [target]].dropna().reset_index(drop=True)
    model_df["delay_hours_log1p"] = np.log1p(model_df[target].clip(lower=0))
    train_df, val_df, test_df = split_70_15_15(model_df)
    save_splits("model2_random_forest", train_df, val_df, test_df)
    return len(train_df), len(val_df), len(test_df)


def export_model3(df: pd.DataFrame) -> tuple[int, int, int]:
    features = [
        "weather_score",
        "traffic_score",
        "port_score",
        "historical_score",
        "cargo_sensitivity",
        "distance_remaining_km",
        "time_of_day",
        "day_of_week",
        "season",
        "risk_score",
        "delay_hours",
    ]
    model_df = df[features].dropna().reset_index(drop=True)
    model_df["reroute_label"] = ((model_df["risk_score"] >= 55) & (model_df["delay_hours"] >= 1.5)).astype(int)
    train_df, val_df, test_df = split_70_15_15(model_df)
    save_splits("model3_gradient_boosting", train_df, val_df, test_df)
    return len(train_df), len(val_df), len(test_df)


# ------------------------
# Model 4 export (LSTM)
# ------------------------

def ou_trajectory(n_steps: int, mu: float, theta: float, sigma: float, x0: float) -> np.ndarray:
    series = np.zeros(n_steps, dtype=np.float32)
    series[0] = np.clip(x0, 0, 100)
    dt = 0.5
    for idx in range(1, n_steps):
        dx = theta * (mu - series[idx - 1]) * dt + sigma * np.sqrt(dt) * np.random.randn()
        series[idx] = np.clip(series[idx - 1] + dx, 0, 100)
    return series


def build_lstm_dataset() -> pd.DataFrame:
    np.random.seed(RANDOM_STATE)
    scenarios: dict[str, tuple[float, float, float, float]] = {
        "calm": (18, 0.30, 4.0, 0.30),
        "moderate": (38, 0.25, 7.0, 0.25),
        "storm": (72, 0.15, 12.0, 0.20),
        "port_crisis": (65, 0.20, 8.0, 0.12),
        "recovery": (30, 0.40, 6.0, 0.08),
        "worsening": (75, 0.10, 10.0, 0.05),
    }

    names = list(scenarios.keys())
    probs = np.array([scenarios[name][3] for name in names], dtype=np.float64)
    probs /= probs.sum()

    rows: list[list[float | str]] = []
    total_steps = SEQ_IN + SEQ_OUT

    for _ in range(N_SEQ):
        scenario_name = np.random.choice(names, p=probs)
        mu, theta, sigma, _ = scenarios[scenario_name]

        if scenario_name == "recovery":
            x0 = np.random.uniform(60, 90)
        elif scenario_name == "worsening":
            x0 = np.random.uniform(20, 45)
        else:
            x0 = np.clip(np.random.normal(mu, sigma * 2), 0, 100)

        seq = ou_trajectory(total_steps, mu, theta, sigma, x0)
        row: list[float | str] = []
        row.extend((seq[:SEQ_IN] / 100.0).tolist())
        row.extend((seq[SEQ_IN:] / 100.0).tolist())
        row.append(scenario_name)
        rows.append(row)

    cols_in = [f"input_t{i}" for i in range(1, SEQ_IN + 1)]
    cols_out = [f"target_t{i}" for i in range(1, SEQ_OUT + 1)]
    columns = cols_in + cols_out + ["scenario"]
    return pd.DataFrame(rows, columns=columns)


def export_model4() -> tuple[int, int, int]:
    model_df = build_lstm_dataset()

    # Match the training script: random permutation then 70/15/15 split.
    shuffled = model_df.sample(frac=1.0, random_state=RANDOM_STATE).reset_index(drop=True)
    n_train = int(0.70 * len(shuffled))
    n_val = int(0.15 * len(shuffled))

    train_df = shuffled.iloc[:n_train].reset_index(drop=True)
    val_df = shuffled.iloc[n_train:n_train + n_val].reset_index(drop=True)
    test_df = shuffled.iloc[n_train + n_val:].reset_index(drop=True)

    save_splits("model4_lstm", train_df, val_df, test_df)
    return len(train_df), len(val_df), len(test_df)


# ------------------------
# Model 5 export (KMeans)
# ------------------------

def build_route_aggregation(df: pd.DataFrame) -> pd.DataFrame:
    work_df = df.copy()

    if "dest_cluster" in work_df.columns:
        cargo_band = pd.cut(work_df["cargo_sensitivity"], bins=5, labels=False).fillna(2).astype(int).astype(str)
        work_df["route_id"] = work_df["dest_cluster"].astype(str) + "_s" + work_df["season"].astype(str) + "_c" + cargo_band
    else:
        distance_bucket = pd.cut(work_df["distance_remaining_km"], bins=10, labels=False).astype(str)
        cargo_bucket = pd.cut(work_df["cargo_sensitivity"], bins=5, labels=False).astype(str)
        work_df["route_id"] = distance_bucket + "_" + work_df["season"].astype(str) + "_" + cargo_bucket

    route_agg = (
        work_df.groupby("route_id")
        .agg(
            avg_weather_score=("weather_score", "mean"),
            avg_port_score=("port_score", "mean"),
            avg_traffic_score=("traffic_score", "mean"),
            avg_delay_hours=("delay_hours", "mean"),
            avg_risk_score=("risk_score", "mean"),
            risk_std_dev=("risk_score", "std"),
            shipment_count=("risk_score", "count"),
            avg_cargo_sens=("cargo_sensitivity", "mean"),
        )
        .reset_index()
    )

    return route_agg[route_agg["shipment_count"] >= 5].dropna().reset_index(drop=True)


def export_model5(df: pd.DataFrame) -> tuple[int, int, int]:
    model_df = build_route_aggregation(df)
    train_df, val_df, test_df = split_70_15_15(model_df)
    save_splits("model5_kmeans", train_df, val_df, test_df)
    return len(train_df), len(val_df), len(test_df)


# ------------------------
# Model 6 export (CI)
# ------------------------

def simulate_weekly_outcomes(n: int) -> pd.DataFrame:
    np.random.seed(RANDOM_STATE)
    records: list[dict[str, float | int | str]] = []

    for _ in range(n):
        weather = np.random.beta(2, 5) * 100
        port = np.random.beta(2, 3) * 100
        traffic = port * 0.55 + np.random.normal(0, 10)
        historical = np.random.beta(1.5, 3) * 100
        cargo = np.random.beta(2, 2) * 100
        dist = np.random.exponential(800)
        tod = int(np.random.randint(0, 24))
        dow = int(np.random.randint(0, 7))
        season = int(np.random.randint(1, 5))
        speed_ratio = np.random.beta(4, 2)
        heading_diff = np.random.uniform(0, 90)
        draft_ratio = np.random.beta(3, 2)
        eta_hours = np.random.exponential(24)
        sog = np.random.normal(18, 5)

        pred_risk = np.clip(
            0.30 * weather + 0.25 * port + 0.15 * traffic + 0.15 * historical + 0.10 * cargo + 0.05 * (1 - speed_ratio) * 100
            + np.random.normal(0, 3),
            0,
            100,
        )
        actual_risk = np.clip(pred_risk + np.random.normal(2.5, 6.0), 0, 100)

        pred_delay = np.clip(pred_risk * 0.3 + np.random.exponential(2), 0, 72)
        actual_delay = np.clip(pred_delay + np.random.normal(1.5, 4.0), 0, 72)

        reroute = int(actual_risk >= 55 and actual_delay >= 1.5)

        records.append(
            {
                "weather_score": float(np.clip(weather, 0, 100)),
                "traffic_score": float(np.clip(traffic, 0, 100)),
                "port_score": float(np.clip(port, 0, 100)),
                "historical_score": float(np.clip(historical, 0, 100)),
                "cargo_sensitivity": float(np.clip(cargo, 0, 100)),
                "distance_remaining_km": float(np.clip(dist, 5, 15000)),
                "time_of_day": tod,
                "day_of_week": dow,
                "season": season,
                "speed_ratio": float(np.clip(speed_ratio, 0, 2)),
                "heading_cog_diff": float(heading_diff),
                "draft_ratio": float(np.clip(draft_ratio, 0, 1)),
                "ETA_hours": float(np.clip(eta_hours, 0.1, 72)),
                "SOG_kmh": float(np.clip(sog, 0, 50)),
                "expected_speed_kmh": float(np.clip(dist / max(eta_hours, 0.1), 0, 100)),
                "risk_score": float(actual_risk),
                "delay_hours": float(actual_delay),
                "reroute_recommended": reroute,
                "risk_level": (
                    "low"
                    if actual_risk < 30
                    else "medium"
                    if actual_risk < 55
                    else "high"
                    if actual_risk < 75
                    else "critical"
                ),
            }
        )

    return pd.DataFrame(records)


def export_model6(df: pd.DataFrame) -> tuple[int, int, int]:
    weekly_df = simulate_weekly_outcomes(2000)
    combined = pd.concat([df, weekly_df], ignore_index=True)

    max_rows = 350_000
    if len(combined) > max_rows:
        combined = combined.tail(max_rows).reset_index(drop=True)

    features = [
        "weather_score",
        "traffic_score",
        "port_score",
        "historical_score",
        "cargo_sensitivity",
        "distance_remaining_km",
        "time_of_day",
        "day_of_week",
        "season",
        "speed_ratio",
        "heading_cog_diff",
        "draft_ratio",
        "ETA_hours",
        "SOG_kmh",
    ]
    targets = ["risk_score", "delay_hours", "reroute_recommended", "risk_level"]

    model_df = combined[features + targets].dropna().reset_index(drop=True)
    model_df["reroute_label"] = ((model_df["risk_score"] >= 55) & (model_df["delay_hours"] >= 1.5)).astype(int)

    train_df, val_df, test_df = split_70_15_15(model_df)
    save_splits("model6_continuous_improvement", train_df, val_df, test_df)
    return len(train_df), len(val_df), len(test_df)


def main() -> None:
    np.random.seed(RANDOM_STATE)

    if not TRAINING_PATH.exists():
        raise FileNotFoundError(f"Training dataset not found: {TRAINING_PATH}")

    print("=" * 72)
    print("RouteGuard dataset export started")
    print(f"Source: {TRAINING_PATH}")
    print(f"Output: {DATASET_DIR}")
    print("=" * 72)

    base_df = pd.read_csv(TRAINING_PATH)

    summary: list[tuple[str, int, int, int]] = []
    summary.append(("model1_xgboost", *export_model1(base_df)))
    summary.append(("model2_random_forest", *export_model2(base_df)))
    summary.append(("model3_gradient_boosting", *export_model3(base_df)))
    summary.append(("model4_lstm", *export_model4()))
    summary.append(("model5_kmeans", *export_model5(base_df)))
    summary.append(("model6_continuous_improvement", *export_model6(base_df)))

    print("\nExport complete. Row counts:")
    print(f"{'Model':32s} {'Train':>10s} {'Validation':>12s} {'Testing':>10s}")
    print("-" * 70)
    for name, train_count, val_count, test_count in summary:
        print(f"{name:32s} {train_count:10d} {val_count:12d} {test_count:10d}")

    print("\nDone.")


if __name__ == "__main__":
    main()
