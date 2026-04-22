import { useMemo, useState } from 'react';
import { ArrowLeft, Moon, Sun } from 'lucide-react';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import RoleSelection from '../../components/auth/RoleSelection';
import TrackingGraphic from '../../components/auth/TrackingGraphic';
import RoleSpecificFields from '../../components/auth/RoleSpecificFields';
import {
	AUTH_ROLES,
	AUTH_ROLE_ORDER,
	DEMO_ACCOUNTS,
} from '../../components/auth/roleConfig';
import './login-portal.css';

const ROLE_ROUTES = {
	manager: '/manager',
	shipper: '/shipper',
	driver: '/driver',
	receiver: '/receiver',
};

function normalizeRole(role) {
	return String(role || '').trim().toLowerCase();
}

export default function LoginPage() {
	const navigate = useNavigate();
	const { login } = useAuth();
	const [theme, setTheme] = useState('dark');
	const [authOpen, setAuthOpen] = useState(false);
	const [isSignup, setIsSignup] = useState(false);
	const [selectedRole, setSelectedRole] = useState('receiver');
	const [email, setEmail] = useState('');
	const [password, setPassword] = useState('');
	const [confirmPassword, setConfirmPassword] = useState('');
	const [industryType, setIndustryType] = useState('Electronics');
	const [otherIndustry, setOtherIndustry] = useState('');
	const [acceptTerms, setAcceptTerms] = useState(false);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState('');

	const currentRoleData = useMemo(() => AUTH_ROLES[selectedRole], [selectedRole]);

	const openAuth = (role) => {
		setSelectedRole(role);
		setIsSignup(false);
		setError('');
		setAuthOpen(true);
	};

	const closeAuth = () => {
		setAuthOpen(false);
		setError('');
	};

	const toggleAuthMode = () => {
		setIsSignup((prev) => !prev);
		setError('');
	};

	const toggleTheme = () => {
		setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
	};

	const onRoleChange = (nextRole) => {
		setSelectedRole(nextRole);
	};

	const handleLogin = async (event) => {
		event.preventDefault();
		setLoading(true);
		setError('');

		if (isSignup) {
			if (password !== confirmPassword) {
				setLoading(false);
				setError('Passwords do not match.');
				return;
			}
			if (!acceptTerms) {
				setLoading(false);
				setError('Please accept the terms and conditions to continue.');
				return;
			}
			setTimeout(() => {
				setLoading(false);
				toast.success(`Access request submitted for ${currentRoleData.label}.`);
				setIsSignup(false);
				setConfirmPassword('');
				setAcceptTerms(false);
			}, 700);
			return;
		}

		const result = await login(email, password);
		if (!result.success) {
			setError('Invalid email or password. Try one of the demo accounts.');
			setLoading(false);
			return;
		}

		toast.success(`Authenticated as ${result.user.role}.`);
		navigate(ROLE_ROUTES[normalizeRole(result.user.role)] || '/login');
		setLoading(false);
	};

	const fillDemo = (account) => {
		setEmail(account.email);
		setPassword(account.password);
		setSelectedRole(account.role);
		setError('');
		setAuthOpen(true);
		setIsSignup(false);
	};

	return (
		<div className="portal-auth" data-theme={theme}>
			<div className="portal-auth__bg-container">
				<div className="portal-auth__bg-image" />
			</div>
			<div className="portal-auth__bg-overlay" />

			<button type="button" className="portal-auth__theme-toggle" onClick={toggleTheme} title="Toggle Light and Dark Mode">
				{theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
			</button>

		<div
			style={{
				opacity: authOpen ? 0 : 1,
				transform: authOpen ? 'scale(0.95)' : 'scale(1)',
				pointerEvents: authOpen ? 'none' : 'auto',
				position: 'fixed',
				inset: 0,
			}}
		>
			<RoleSelection roles={AUTH_ROLES} roleOrder={AUTH_ROLE_ORDER} onSelect={openAuth} />
		</div>

		<div className={`portal-auth__auth-screen${authOpen ? ' active' : ''}`} id="authScreen">
				<button type="button" className="portal-auth__back-btn" onClick={closeAuth}>
					<ArrowLeft size={18} />
					Switch Sector
				</button>

				<div className="portal-auth__auth-left">
					<TrackingGraphic />
					<div className="portal-auth__dynamic-role">
						<div className="portal-auth__role-icon">
							<currentRoleData.Icon size={34} />
						</div>
						<h2>{currentRoleData.panelTitle}</h2>
						<p>{currentRoleData.panelDescription}</p>
					</div>
				</div>

				<div className="portal-auth__auth-right">
					<div className="portal-auth__form-wrapper">
						<h3>{isSignup ? 'Request Access' : 'Welcome Back'}</h3>
						<p className="portal-auth__subtitle">
							{isSignup
								? `Register as a new ${currentRoleData.label}`
								: `Sign in to your ${currentRoleData.label} dashboard`}
						</p>

						<form onSubmit={handleLogin}>
							<div className="portal-auth__form-grid">
								{isSignup ? (
									<>
										<div className="portal-auth__section-title portal-auth__full-width">Basic Information</div>
										<div className="portal-auth__form-group">
											<label>Full Name *</label>
											<input type="text" placeholder="John Doe" />
										</div>
										<div className="portal-auth__form-group">
											<label>Phone Number *</label>
											<input type="tel" placeholder="+1 (555) 000-0000" />
										</div>
										<div className="portal-auth__form-group portal-auth__full-width">
											<label>Account Role *</label>
											<select value={selectedRole} onChange={(event) => onRoleChange(event.target.value)}>
												{AUTH_ROLE_ORDER.map((roleKey) => (
													<option key={roleKey} value={roleKey}>
														{AUTH_ROLES[roleKey].label}
													</option>
												))}
											</select>
										</div>
									</>
								) : null}

								<div className="portal-auth__form-group portal-auth__full-width">
									<label>Email Address or Phone Number *</label>
									<input
										type="text"
										placeholder="name@domain.com or +1 234..."
										value={email}
										onChange={(event) => setEmail(event.target.value)}
										required
									/>
								</div>

								<div className="portal-auth__form-group portal-auth__full-width">
									<label>Password *</label>
									<input
										type="password"
										placeholder="••••••••"
										value={password}
										onChange={(event) => setPassword(event.target.value)}
										required
									/>
								</div>

								{!isSignup ? (
									<div className="portal-auth__full-width" style={{ textAlign: 'right', marginTop: '-10px' }}>
										<a className="portal-auth__login-only-link" href="#" onClick={(event) => event.preventDefault()}>
											Forgot Password?
										</a>
									</div>
								) : null}

								{isSignup ? (
									<div className="portal-auth__form-group portal-auth__full-width">
										<label>Confirm Password *</label>
										<input
											type="password"
											placeholder="••••••••"
											value={confirmPassword}
											onChange={(event) => setConfirmPassword(event.target.value)}
											required
										/>
									</div>
								) : null}

								{isSignup ? (
									<RoleSpecificFields
										role={selectedRole}
										industryType={industryType}
										onIndustryTypeChange={setIndustryType}
										otherIndustry={otherIndustry}
										onOtherIndustryChange={setOtherIndustry}
									/>
								) : null}

								{isSignup ? (
									<>
										<div className="portal-auth__section-title portal-auth__full-width">System Preferences</div>
										<div className="portal-auth__form-group">
											<label>Profile Picture</label>
											<input type="file" accept="image/*" />
										</div>
										<div className="portal-auth__form-group">
											<label>Language and Time Zone</label>
											<div style={{ display: 'flex', gap: 10 }}>
												<select style={{ flex: 1 }}>
													<option>English</option>
													<option>Spanish</option>
												</select>
												<select style={{ flex: 1 }}>
													<option>UTC -05:00</option>
													<option>UTC +00:00</option>
												</select>
											</div>
										</div>
										<div className="portal-auth__form-group portal-auth__full-width">
											<label>Notification Alerts (Select all that apply)</label>
											<div className="portal-auth__checkbox-group">
												<label className="portal-auth__checkbox-item">
													<input type="checkbox" defaultChecked /> App Alerts
												</label>
												<label className="portal-auth__checkbox-item">
													<input type="checkbox" defaultChecked /> Email
												</label>
												<label className="portal-auth__checkbox-item">
													<input type="checkbox" /> SMS
												</label>
											</div>
										</div>
										<div className="portal-auth__form-group portal-auth__full-width" style={{ marginTop: '1rem' }}>
											<label className="portal-auth__checkbox-item" style={{ fontWeight: 500 }}>
												<input
													type="checkbox"
													checked={acceptTerms}
													onChange={(event) => setAcceptTerms(event.target.checked)}
												/>
												I agree to the RouteGuard Terms and Conditions and Privacy Policy.
											</label>
										</div>
									</>
								) : null}
							</div>

							<button type="submit" className="portal-auth__submit-btn" disabled={loading}>
								{loading ? 'Processing...' : isSignup ? 'Create Account' : 'Authenticate'}
							</button>
							{error ? <p className="portal-auth__form-error">{error}</p> : null}

							{!isSignup ? (
								<div className="portal-auth__demo-row">
									{DEMO_ACCOUNTS.map((account) => (
										<button
											type="button"
											className="portal-auth__demo-btn"
											key={account.role}
											onClick={() => fillDemo(account)}
										>
											Use {AUTH_ROLES[account.role].label} Demo
										</button>
									))}
								</div>
							) : null}
						</form>

						<div className="portal-auth__toggle-row">
							<span>{isSignup ? 'Already operational?' : 'New operative?'}</span>
							<button type="button" className="portal-auth__toggle-link" onClick={toggleAuthMode}>
								{isSignup ? 'Authenticate' : 'Request Access'}
							</button>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}
