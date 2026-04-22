import { X } from 'lucide-react';

export default function Modal({ isOpen, onClose, title, children, footer }) {
	if (!isOpen) return null;

	return (
		<div
			className="modal-overlay"
			onClick={(event) => {
				if (event.target === event.currentTarget) onClose?.();
			}}
		>
			<div className="modal-card" role="dialog" aria-modal="true">
				<div className="modal-card__header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
					<h3>{title}</h3>
					<button type="button" className="topbar__icon-btn" onClick={onClose} aria-label="Close">
						<X size={16} />
					</button>
				</div>
				<div className="modal-card__body">{children}</div>
				{footer ? <div className="modal-card__footer">{footer}</div> : null}
			</div>
		</div>
	);
}
