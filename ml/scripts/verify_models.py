import os, joblib, json, numpy as np, torch, torch.nn as nn

MODELS_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "models")

print("=" * 55)
print("  RouteGuard - Model Verification (all 4)")
print("=" * 55)

# -- List files --
print("\nModels directory:")
for f in sorted(os.listdir(MODELS_DIR)):
    sz = os.path.getsize(os.path.join(MODELS_DIR, f))
    print(f"  {f:40s}  {sz/1024:.1f} KB")

# -- Model 1: XGBoost --
m1 = joblib.load(os.path.join(MODELS_DIR, "xgboost_risk.pkl"))
feat14 = np.array([[60, 55, 70, 40, 50, 500, 14, 2, 1, 0.7, 20, 0.6, 12, 18]])
risk_score = float(m1.predict(feat14)[0])
print(f"\nModel 1 (XGBoost)     risk_score = {risk_score:.1f}")

# -- Model 2: Random Forest --
m2 = joblib.load(os.path.join(MODELS_DIR, "random_forest_delay.pkl"))
feat15 = np.array([[60, 55, 70, 40, 50, 500, 14, 2, 1, 0.7, 20, 0.6, 12, 18, risk_score]])
delay_hours = float(np.expm1(m2.predict(feat15)[0]))
print(f"Model 2 (RandomForest) delay_hours = {delay_hours:.2f}h")

# -- Model 3: GBM Classifier --
m3 = joblib.load(os.path.join(MODELS_DIR, "gradient_boosting_reroute.pkl"))
with open(os.path.join(MODELS_DIR, "gradient_boosting_reroute_meta.json")) as f:
    meta3 = json.load(f)
gbm_feat = np.array([[60, 55, 70, 40, 50, 500, 14, 2, 1, risk_score, delay_hours]])
prob = float(m3.predict_proba(gbm_feat)[0][1])
thresh = float(meta3["decision_threshold"])
decision = "YES - REROUTE" if prob >= thresh else "NO - HOLD"
print(f"Model 3 (GBM)          reroute prob = {prob:.3f} => {decision}")

# -- Model 4: LSTM --
class RiskLSTM(nn.Module):
    def __init__(self, input_size=1, hidden1=64, hidden2=32, output_size=6, dropout=0.20):
        super().__init__()
        self.lstm1 = nn.LSTM(input_size, hidden1, batch_first=True)
        self.drop1 = nn.Dropout(dropout)
        self.lstm2 = nn.LSTM(hidden1, hidden2, batch_first=True)
        self.drop2 = nn.Dropout(dropout)
        self.fc    = nn.Linear(hidden2, output_size)
    def forward(self, x):
        out, _ = self.lstm1(x)
        out = self.drop1(out)
        out, _ = self.lstm2(out)
        out = self.drop2(out)
        return self.fc(out[:, -1, :])

ckpt = torch.load(os.path.join(MODELS_DIR, "lstm_trajectory.pt"), weights_only=True)
m4 = RiskLSTM(**ckpt["model_config"])
m4.load_state_dict(ckpt["model_state_dict"])
m4.eval()
seq = torch.tensor([45,42,48,55,62,68,71,73,70,67,63,60], dtype=torch.float32)
x_in = seq.unsqueeze(0).unsqueeze(-1) / 100.0
with torch.no_grad():
    forecast = (m4(x_in)[0].numpy() * 100).round(1).tolist()
print(f"Model 4 (LSTM)         6-step forecast = {forecast}")

print("\n  All 4 models loaded and producing valid outputs.")
print("=" * 55)
