import { createContext, useEffect, useMemo, useState } from 'react';
import { api } from '../config/api';
import { ENDPOINTS } from '../config/endpoints';

export const AuthContext = createContext(null);

const TOKEN_STORAGE_KEY = 'routeguard_token';
const USER_STORAGE_KEY = 'routeguard_user';

function normalizeRole(role) {
	return String(role || '').trim().toLowerCase();
}

function normalizeUser(user) {
	if (!user) return null;
	const fullName = user.full_name || user.name || '';
	const companyName = user.company_name || user.company || '';
	return {
		...user,
		role: normalizeRole(user.role),
		name: fullName,
		full_name: fullName,
		company: companyName || null,
		company_name: companyName || null,
	};
}

function readStoredUser() {
	const raw = localStorage.getItem(USER_STORAGE_KEY);
	if (!raw) return null;
	try {
		return normalizeUser(JSON.parse(raw));
	} catch {
		return null;
	}
}

function clearStoredSession() {
	localStorage.removeItem(TOKEN_STORAGE_KEY);
	localStorage.removeItem(USER_STORAGE_KEY);
}

function persistSession(nextToken, nextUser) {
	localStorage.setItem(TOKEN_STORAGE_KEY, nextToken);
	localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(nextUser));
}

function resolveAuthError(error, fallbackMessage) {
	const detail = error?.response?.data?.detail;
	if (Array.isArray(detail)) {
		const messages = detail
			.map((item) => item?.msg)
			.filter(Boolean)
			.join(' ');
		return messages || fallbackMessage;
	}
	if (typeof detail === 'string' && detail.trim()) {
		return detail;
	}
	return fallbackMessage;
}

export function AuthProvider({ children }) {
	const [user, setUser] = useState(() => {
		return readStoredUser();
	});

	const [token, setToken] = useState(() => localStorage.getItem(TOKEN_STORAGE_KEY) || null);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		let isActive = true;
		const hydrate = async () => {
			if (!token) {
				if (isActive) setLoading(false);
				return;
			}
			if (user) {
				if (isActive) setLoading(false);
				return;
			}

			try {
				const response = await api.get(ENDPOINTS.ME);
				const safeUser = normalizeUser(response.data);
				if (isActive) {
					setUser(safeUser);
					localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(safeUser));
				}
			} catch {
				if (isActive) {
					clearStoredSession();
					setUser(null);
					setToken(null);
				}
			} finally {
				if (isActive) setLoading(false);
			}
		};

		hydrate();
		return () => {
			isActive = false;
		};
	}, [token, user]);

	const login = async (email, password) => {
		try {
			const response = await api.post(ENDPOINTS.LOGIN, {
				email: String(email || '').trim(),
				password,
			});
			const safeUser = normalizeUser(response.data.user);
			persistSession(response.data.access_token, safeUser);
			setToken(response.data.access_token);
			setUser(safeUser);
			return { success: true, user: safeUser };
		} catch (error) {
			return { success: false, error: resolveAuthError(error, 'Login failed.') };
		}
	};

	const register = async (payload) => {
		try {
			const response = await api.post(ENDPOINTS.REGISTER, payload);
			const safeUser = normalizeUser(response.data.user);
			persistSession(response.data.access_token, safeUser);
			setToken(response.data.access_token);
			setUser(safeUser);
			return { success: true, user: safeUser };
		} catch (error) {
			return { success: false, error: resolveAuthError(error, 'Registration failed.') };
		}
	};

	const logout = () => {
		clearStoredSession();
		setToken(null);
		setUser(null);
	};

	const value = useMemo(
		() => ({
			user,
			token,
			loading,
			login,
			register,
			logout,
		}),
		[user, token, loading, login, register, logout]
	);

	return <AuthContext.Provider value={value}>{!loading && children}</AuthContext.Provider>;
}
