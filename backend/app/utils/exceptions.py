class RouteGuardError(Exception):
	"""Base app exception."""


class ResourceNotFoundError(RouteGuardError):
	"""Raised when an entity does not exist."""


class AuthorizationError(RouteGuardError):
	"""Raised for authorization/permission failures."""
