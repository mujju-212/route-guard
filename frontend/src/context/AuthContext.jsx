import { createContext, useEffect, useMemo, useState } from 'react';
import { DUMMY_USERS, dummyLogin } from '../dummy/users';

export const AuthContext = createContext(null);

function normalizeRole(role) {
	return String(role || '').trim().toLowerCase();
}

function withNormalizedRole(user) {
	if (!user) return user;
	return { ...user, role: normalizeRole(user.role) };
}

export function AuthProvider({ children }) {
	const [user, setUser] = useState(() => {
		const raw = localStorage.getItem('routeguard_user');
		return raw ? JSON.parse(raw) : null;
	});

	const [token, setToken] = useState(() => localStorage.getItem('routeguard_token') || null);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		if (!token) {
			setLoading(false);
			return;
		}

		if (!token.startsWith('dummy_token_')) {
			localStorage.removeItem('routeguard_token');
			localStorage.removeItem('routeguard_user');
			setUser(null);
			setToken(null);
			setLoading(false);
			return;
		}

		const parts = token.split('_');
		const role = normalizeRole(parts[2]);
		const fallbackUser = DUMMY_USERS.find((item) => item.role === role);
		if (fallbackUser) {
			const safeUser = withNormalizedRole({
				user_id: fallbackUser.user_id,
				name: fallbackUser.name,
				email: fallbackUser.email,
				role: fallbackUser.role,
				company: fallbackUser.company,
			});
			setUser(safeUser);
			localStorage.setItem('routeguard_user', JSON.stringify(safeUser));
		} else {
			localStorage.removeItem('routeguard_token');
			localStorage.removeItem('routeguard_user');
			setUser(null);
			setToken(null);
		}

		setLoading(false);
	}, [token]);

	const login = async (email, password) => {
		const result = dummyLogin(email, password);
		if (result) {
			const safeUser = withNormalizedRole(result.user);
			localStorage.setItem('routeguard_token', result.token);
			localStorage.setItem('routeguard_user', JSON.stringify(safeUser));
			setToken(result.token);
			setUser(safeUser);
			return { success: true, user: safeUser };
		}

		return { success: false, error: 'Invalid credentials' };
	};

	const logout = () => {
		localStorage.removeItem('routeguard_token');
		localStorage.removeItem('routeguard_user');
		setToken(null);
		setUser(null);
	};

	const value = useMemo(
		() => ({
			user,
			token,
			loading,
			login,
			logout,
		}),
		[user, token, loading]
	);

	return <AuthContext.Provider value={value}>{!loading && children}</AuthContext.Provider>;
}
