export default function RoleSpecificFields({
	role,
	industryType,
	onIndustryTypeChange,
	otherIndustry,
	onOtherIndustryChange,
}) {
	if (role === 'receiver') {
		return (
			<>
				<div className="portal-auth__section-title portal-auth__full-width">Receiver Details</div>
				<div className="portal-auth__form-group">
					<label>Company / Individual Name *</label>
					<input type="text" placeholder="Enter name" />
				</div>
				<div className="portal-auth__form-group">
					<label>Storage Type</label>
					<select>
						<option>Warehouse</option>
						<option>Shop / Retail</option>
						<option>Residential</option>
					</select>
				</div>
				<div className="portal-auth__form-group portal-auth__full-width">
					<label>Delivery Address *</label>
					<textarea placeholder="Full street address for deliveries" />
				</div>
				<div className="portal-auth__form-group">
					<label>Receiving Time Window</label>
					<input type="text" placeholder="e.g., 9:00 AM - 5:00 PM" />
				</div>
				<div className="portal-auth__form-group">
					<label>Preferred Contact</label>
					<select>
						<option>Email</option>
						<option>Phone</option>
					</select>
				</div>
				<div className="portal-auth__form-group">
					<label>Alternate Contact Number</label>
					<input type="tel" placeholder="Backup phone" />
				</div>
				<div className="portal-auth__form-group portal-auth__full-width">
					<label>Special Instructions</label>
					<input type="text" placeholder="e.g., Fragile handling, use Gate B" />
				</div>
			</>
		);
	}

	if (role === 'shipper') {
		return (
			<>
				<div className="portal-auth__section-title portal-auth__full-width">Business and Cargo Details</div>
				<div className="portal-auth__form-group">
					<label>Company Name *</label>
					<input type="text" placeholder="Enter company name" />
				</div>
				<div className="portal-auth__form-group">
					<label>Business Type *</label>
					<select>
						<option>Manufacturer</option>
						<option>Retailer</option>
						<option>Distributor</option>
						<option>Individual</option>
					</select>
				</div>
				<div className="portal-auth__form-group portal-auth__full-width">
					<label>Company Address *</label>
					<textarea placeholder="Headquarters or main warehouse" />
				</div>
				<div className="portal-auth__form-group">
					<label>GST / Tax ID</label>
					<input type="text" placeholder="Tax Identification Number" />
				</div>
				<div className="portal-auth__form-group">
					<label>Industry Type</label>
					<select value={industryType} onChange={(event) => onIndustryTypeChange(event.target.value)}>
						<option value="Electronics">Electronics</option>
						<option value="Food & Beverage">Food & Beverage</option>
						<option value="Pharmaceuticals">Pharmaceuticals</option>
						<option value="Textiles & Apparel">Textiles and Apparel</option>
						<option value="Other">Other</option>
					</select>
					{industryType === 'Other' ? (
						<input
							type="text"
							placeholder="Please specify your industry"
							value={otherIndustry}
							onChange={(event) => onOtherIndustryChange(event.target.value)}
							style={{ marginTop: '0.8rem' }}
							required
						/>
					) : null}
				</div>
				<div className="portal-auth__form-group">
					<label>Avg. Shipment Volume</label>
					<select>
						<option>Low (&lt; 10/month)</option>
						<option>Medium (10-50/month)</option>
						<option>High (&gt; 50/month)</option>
					</select>
				</div>
				<div className="portal-auth__form-group">
					<label>Preferred Shipping Mode</label>
					<select>
						<option>Road (Trucking)</option>
						<option>Sea (Freight)</option>
						<option>Air</option>
					</select>
				</div>
				<div className="portal-auth__form-group">
					<label>Emergency Contact Number</label>
					<input type="tel" placeholder="24/7 Operations Contact" />
				</div>
			</>
		);
	}

	if (role === 'manager') {
		return (
			<>
				<div className="portal-auth__section-title portal-auth__full-width">Operational Authority</div>
				<div className="portal-auth__form-group">
					<label>Carrier / Company Name *</label>
					<input type="text" placeholder="Logistics Firm Name" />
				</div>
				<div className="portal-auth__form-group">
					<label>Department *</label>
					<select>
						<option>Operations</option>
						<option>Fleet Management</option>
						<option>Supply Chain</option>
					</select>
				</div>
				<div className="portal-auth__form-group">
					<label>Employee ID</label>
					<input type="text" placeholder="e.g., EMP-9021" />
				</div>
				<div className="portal-auth__form-group">
					<label>Access Level</label>
					<select>
						<option>Admin (Full Control)</option>
						<option>Supervisor (Approval Rights)</option>
						<option>Viewer (Read-Only)</option>
					</select>
				</div>
				<div className="portal-auth__form-group">
					<label>Region of Responsibility</label>
					<select>
						<option>North America</option>
						<option>Europe</option>
						<option>Asia-Pacific</option>
						<option>Global</option>
					</select>
				</div>
				<div className="portal-auth__form-group">
					<label>Years of Experience</label>
					<input type="number" min="0" placeholder="e.g., 5" />
				</div>
				<div className="portal-auth__form-group portal-auth__full-width">
					<label>Approx. Shipments Managed (Monthly)</label>
					<input type="number" placeholder="e.g., 500" />
				</div>
			</>
		);
	}

	if (role === 'driver') {
		return (
			<>
				<div className="portal-auth__section-title portal-auth__full-width">Fleet and Licensing Info</div>
				<div className="portal-auth__form-group">
					<label>Company Name (If applicable)</label>
					<input type="text" placeholder="Independent or Fleet Name" />
				</div>
				<div className="portal-auth__form-group">
					<label>Vehicle Type *</label>
					<select>
						<option>Heavy Truck (18-Wheeler)</option>
						<option>Cargo Ship / Vessel</option>
						<option>Delivery Van</option>
					</select>
				</div>
				<div className="portal-auth__form-group">
					<label>License Number *</label>
					<input type="text" placeholder="Commercial Driver License" />
				</div>
				<div className="portal-auth__form-group">
					<label>Vehicle ID / Plate Number *</label>
					<input type="text" placeholder="Plate or IMO Number" />
				</div>
				<div className="portal-auth__form-group">
					<label>Current Status</label>
					<select>
						<option>Available</option>
						<option>On Duty</option>
						<option>Off Duty</option>
					</select>
				</div>
				<div className="portal-auth__form-group">
					<label>Years of Experience</label>
					<input type="number" min="0" placeholder="e.g., 10" />
				</div>
				<div className="portal-auth__form-group portal-auth__full-width">
					<label>Upload ID / Photo</label>
					<input type="file" accept="image/*" />
				</div>
			</>
		);
	}

	return null;
}
