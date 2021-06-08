NEWSCHEMA('Token', function(schema) {

	schema.compress();
	schema.define('token', 'String', true);

	schema.addWorkflow('exec', function($, model) {

		var token = model.token;
		if (!token) {
			$.invalid('@(Token is invalid)');
			return;
		}

		var response = DB.users.findItem('token', token);
		if (response) {

			if (response.inactive) {
				$.invalid('@(Account is inactive)');
				return;
			}

			response.token = GUID(25);

			if (response.countlogin)
				response.countlogin++;
			else
				response.countlogin = 1;

			PUBLISH('users_login', response);
			FUNC.makesession($, response.id, $.done(), 'login');

		} else
			$.invalid('@(Token is invalid)');

	});

});