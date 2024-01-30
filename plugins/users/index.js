exports.icon = 'ti ti-users';
exports.name = '@(Users)';
exports.permissions = [{ id: 'users', name: 'Users' }];
exports.visible = user => user.sa || user.permissions.includes('admin') || user.permissions.includes('users');

exports.install = function() {

	ROUTE('+API    ?           -users                 --> Users/list');
	ROUTE('+API    ?           -users_read/{id}       --> Users/read');
	ROUTE('+API    ?           +users_create          --> Users/create');
	ROUTE('+API    ?           +users_update/{id}     --> Users/update');
	ROUTE('+API    ?           -users_remove/{id}     --> Users/remove');
	ROUTE('-API    ?           +login                 --> Users/login');
	ROUTE('+API    ?           +password              --> Users/password');
	ROUTE('+GET    /logout/                           --> Users/logout');

};
