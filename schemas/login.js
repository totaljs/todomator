NEWSCHEMA('Login', function(schema) {

	schema.compress();

	schema.define('email', 'Email', true);
	schema.define('password', 'String(30)', true);

	schema.addWorkflow('exec', function($, model) {

		var response = DB.users.findItem('email', model.email);
		if (!response) {
			$.invalid('@(Invalid credentials)');
			return;
		}

		if (response.password !== model.password.sha256(CONF.secret_password)) {
			$.invalid('@(Invalid credentials)');
			return;
		}

		if (response.inactive) {
			$.invalid('@(Account is inactive)');
			return;
		}

		if (response.countlogin)
			response.countlogin++;
		else
			response.countlogin = 1;

		PREF.initcredentials && PREF.set('initcredentials', null);
		PUBLISH('users_login', response);
		FUNC.makesession($, response.id, $.done(), 'login');
	});

	schema.addWorkflow('token', function($) {

		var token = $.query.token;
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