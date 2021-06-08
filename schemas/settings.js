NEWSCHEMA('Settings', function(schema) {

	schema.jsonschema();
	schema.compress();

	schema.define('url', String);
	schema.define('name', String);
	schema.define('allow_tms', Boolean);
	schema.define('allow_totalapi', Boolean);
	schema.define('secret_tms', String);
	schema.define('mail_api', Boolean);
	schema.define('mail_smtp', String);
	schema.define('mail_smtp_options', 'JSON');
	schema.define('mail_from', 'Email');

	schema.setRead(function($) {

		if (UNAUTHORIZED($)) {
			$.invalid(401);
			return;
		}

		var model = {};

		for (var key of schema.fields)
			model[key] = PREF[key];

		$.callback(model);
	});

	schema.setSave(function($, model) {

		if (UNAUTHORIZED($)) {
			$.invalid(401);
			return;
		}

		for (var key in model) {
			var val = model[key];
			PREF.set(key, val);
		}

		PUBLISH('settings_save', model);
		EXEC('-Settings --> load', $.done());
	});

	schema.addWorkflow('load', function($, model) {

		var model = {};

		for (var key of schema.fields) {
			var val = PREF[key];
			if (val != null)
				model[key] = val;
		}

		if (model.mail_smtp_options)
			model.mail_smtp_options = model.mail_smtp_options.parseJSON();

		LOADCONFIG(model);
		$.success();
	});

});

NEWSCHEMA('Settings/SMTP', function(schema) {

	schema.define('smtp', 'String(100)', true);
	schema.define('smtp_options', 'JSON');

	schema.addWorkflow('exec', function($) {

		if ($.controller && UNAUTHORIZED($))
			return;

		var model = $.model;
		var options = model.smtp_options.parseJSON();

		Mail.try(model.smtp, options, function(err) {
			if (err) {
				$.error.replace('@', err.toString());
				$.invalid('@(Invalid SMTP settings: @)');
			} else
				$.success();
		});
	});
});

NEWSCHEMA('Settings/TotalAPI', function(schema) {

	schema.define('totalapi', 'String(100)', true);

	schema.addWorkflow('exec', function($, model) {

		if ($.controller && UNAUTHORIZED($))
			return;

		TotalAPI(model.totalapi, 'check', EMPTYOBJECT, $.callback);
	});
});