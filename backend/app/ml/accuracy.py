import math

from sklearn.metrics import accuracy_score, f1_score, mean_absolute_error, mean_squared_error, r2_score


def evaluate_regression_metrics(y_true: list[float], y_pred: list[float]) -> dict:
	if not y_true:
		return {'rmse': 0.0, 'mae': 0.0, 'r2': 0.0}

	return {
		'rmse': float(math.sqrt(mean_squared_error(y_true, y_pred))),
		'mae': float(mean_absolute_error(y_true, y_pred)),
		'r2': float(r2_score(y_true, y_pred)),
	}


def evaluate_binary_metrics(y_true: list[int], y_pred: list[int]) -> dict:
	if not y_true:
		return {'accuracy': 0.0, 'f1': 0.0}

	return {
		'accuracy': float(accuracy_score(y_true, y_pred)),
		'f1': float(f1_score(y_true, y_pred, zero_division=0)),
	}
