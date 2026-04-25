import { Boxes, Building2, Map, Truck } from 'lucide-react';

export const AUTH_ROLES = {
	receiver: {
		key: 'receiver',
		label: 'Receiver',
		cardTitle: 'Receiver',
		cardDescription: 'Demand creation, deadline setting, and secure delivery confirmation.',
		panelTitle: 'Receiver Access',
		panelDescription: 'Demand creation, deadline setting, and secure delivery confirmation.',
		Icon: Boxes,
	},
	shipper: {
		key: 'shipper',
		label: 'Shipper',
		cardTitle: 'Shipper',
		cardDescription: 'Manage dispatch requests, specify cargo, and assign logistics partners.',
		panelTitle: 'Shipper Access',
		panelDescription: 'Manage dispatch requests, specify cargo, and assign logistics partners.',
		Icon: Building2,
	},
	manager: {
		key: 'manager',
		label: 'Logistics Manager',
		cardTitle: 'Logistics Manager',
		cardDescription: 'Monitor live telemetrics, predict AI risk scores, and approve alternate routes.',
		panelTitle: 'Manager Node',
		panelDescription: 'Monitor live telemetrics, predict AI risk scores, and approve alternate routes.',
		Icon: Map,
	},
	driver: {
		key: 'driver',
		label: 'Driver / Captain',
		cardTitle: 'Driver / Captain',
		cardDescription: 'Execute delivery routes, update transit status, and report field incidents.',
		panelTitle: 'Driver Node',
		panelDescription: 'Execute delivery routes, update transit status, and report field incidents.',
		Icon: Truck,
	},
};

export const AUTH_ROLE_ORDER = ['receiver', 'shipper', 'manager', 'driver'];

export const DEMO_ACCOUNTS = [
	{ role: 'manager', email: 'manager@routeguard.com', password: 'Manager@123', quickLabel: 'Manager' },
	{ role: 'shipper', email: 'shipper@routeguard.com', password: 'Shipper@123', quickLabel: 'Shipper' },
	{ role: 'shipper', email: 'shipper2@routeguard.com', password: 'Shipper@123', quickLabel: 'Shipper 2' },
	{ role: 'receiver', email: 'receiver@routeguard.com', password: 'Receiver@123', quickLabel: 'Receiver' },
	{ role: 'driver', email: 'driver@routeguard.com', password: 'Driver@123', quickLabel: 'Driver' },
];
