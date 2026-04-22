import { AlertTriangle } from 'lucide-react';
import Modal from './Modal';

export default function ConfirmDialog({
	isOpen,
	onClose,
	onConfirm,
	title,
	message,
	confirmLabel = 'Confirm',
	confirmVariant = 'primary',
}) {
	const confirmClass = confirmVariant === 'danger' ? 'btn-danger' : 'btn-primary';

	return (
		<Modal
			isOpen={isOpen}
			onClose={onClose}
			title={title}
			footer={
				<>
					<button type="button" className="btn-outline" onClick={onClose}>
						Cancel
					</button>
					<button
						type="button"
						className={confirmClass}
						onClick={() => {
							onConfirm?.();
							onClose?.();
						}}
					>
						{confirmLabel}
					</button>
				</>
			}
		>
			<div className="confirm-alert">
				<AlertTriangle size={18} color="var(--warning)" />
				<p>{message}</p>
			</div>
		</Modal>
	);
}
