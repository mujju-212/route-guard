export const DUMMY_USERS = [
	{ user_id: 'USR-001', name: 'Kim Ji-ho', email: 'shipper@routeguard.com', password: 'test1234', role: 'shipper', company: 'Samsung Electronics' },
	{ user_id: 'USR-002', name: 'Sarah Chen', email: 'manager@routeguard.com', password: 'test1234', role: 'manager', company: 'GlobalFreight Corp' },
	{ user_id: 'USR-003', name: 'James Okafor', email: 'driver@routeguard.com', password: 'test1234', role: 'driver', company: 'Pacific Maritime' },
	{ user_id: 'USR-004', name: 'Anna Schmidt', email: 'receiver@routeguard.com', password: 'test1234', role: 'receiver', company: 'Amazon Logistics EU' },
];

const EMAIL_ALIASES = {
	reciver: 'receiver@routeguard.com',
	reciever: 'receiver@routeguard.com',
	receiver: 'receiver@routeguard.com',
	'reciver@routeguard.com': 'receiver@routeguard.com',
	'reciever@routeguard.com': 'receiver@routeguard.com',
	manager: 'manager@routeguard.com',
	driver: 'driver@routeguard.com',
	shipper: 'shipper@routeguard.com',
};

function normalizeIdentifier(value) {
	return String(value || '').trim().toLowerCase();
}

export function dummyLogin(email, password) {
	const normalizedEmail = normalizeIdentifier(email);
	const normalizedPassword = String(password || '').trim();
	const canonicalEmail = EMAIL_ALIASES[normalizedEmail] || normalizedEmail;
	const user = DUMMY_USERS.find(
		(item) => item.email.toLowerCase() === canonicalEmail && item.password === normalizedPassword
	);
	if (!user) return null;
	return {
		user: {
			user_id: user.user_id,
			name: user.name,
			email: user.email,
			role: user.role,
			company: user.company,
		},
		token: `dummy_token_${user.role}_${Date.now()}`,
	};
}
