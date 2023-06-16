exports.icon = 'ti ti-users';
exports.name = '@(Users)';
exports.permissions = [{ id: 'users', name: 'Users' }];
exports.visible = user => user.sa || user.permissions.includes('admin') || user.permissions.includes('users');

exports.install = function() {

	ROUTE('+API    /api/       -users                *Users   --> list');
	ROUTE('+API    /api/       -users_read/{id}      *Users   --> read');
	ROUTE('+API    /api/       +users_create         *Users   --> create');
	ROUTE('+API    /api/       +users_update/{id}    *Users   --> update');
	ROUTE('+API    /api/       -users_remove/{id}    *Users   --> remove');
	ROUTE('-API    /api/       +login                *Users   --> login');
	ROUTE('+API    /api/       +password             *Users   --> password');
	ROUTE('+GET    /logout/                          *Users   --> logout');

};
