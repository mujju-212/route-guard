def enum_values(enum_cls):
	"""Return enum values in declaration order for SQLAlchemy Enum mapping."""
	return [member.value for member in enum_cls]
