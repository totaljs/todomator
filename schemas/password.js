NEWSCHEMA('Password', function(schema) {

	schema.compress();
	schema.define('email', 'Email', true);

	schema.addWorkflow('exec', function($, model) {

		var response = DB.users.findItem('email', model.email);

		if (!response) {
			$.invalid('@(Invalid email address)');
			return;
		}

		if (response.inactive) {
			$.invalid('@(Account is inactive)');
			return;
		}

		response.token = GUID(25);
		FUNC.save('users');

		CONF.mail_smtp && MAIL(response.email, '@(Reset password)', 'mails/password', response, response.language);
		PUBLISH('users_password', response);
	});

});