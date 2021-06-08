NEWSCHEMA('Users', function(schema) {

	schema.compress();
	schema.jsonschema();

	schema.define('gender', ['male', 'female'], true);
	schema.define('languageid', 'Lower(2)', true);
	schema.define('countryid', 'Upper(3)', true);
	schema.define('currencyid', 'Upper(3)', true);
	schema.define('photo', 'String(50)');
	schema.define('firstname', 'Name(40)', true);
	schema.define('lastname', 'Name(40)', true);
	schema.define('email', 'Email', true);
	schema.define('phone', 'Phone');
	schema.define('password', 'String(80)');
	schema.define('dateformat', ['dd.MM.yyyy', 'yyyy-MM-dd', 'MM.dd.yyyy'])('yyyy-MM-dd');
	schema.define('timeformat', Number)(24);
	schema.define('datefirst', Number);
	schema.define('numberformat', Number);
	schema.define('theme', Number);
	schema.define('position', 'String(50)');
	schema.define('sa', Boolean);
	schema.define('inactive', Boolean);
	schema.define('welcome', Boolean);
	schema.define('groups', '[String]');
	schema.define('roles', '[String]');

	schema.setQuery(function($) {

		if (UNAUTHORIZED($)) {
			$.invalid(401);
			return;
		}

		var online = {};

		for (var key in MAIN.sessions)
			online[MAIN.sessions[key].id] = 1;

		var output = [];
		for (var item of DB.users) {
			var data = {};
			data.id = item.id;
			data.name = item.name;
			data.email = item.email;
			data.gender = item.gender;
			data.photo = item.photo;
			data.languageid = item.languageid;
			data.countryid = item.countryid;
			data.phone = item.phone;
			data.inactive = item.inactive;
			data.sa = item.sa;
			data.groups = item.groups;
			data.roles = item.roles;
			data.position = item.position;
			data.dtlogged = item.dtlogged;
			data.dtcreated = item.dtcreated;
			data.dtupdated = item.dtupdated;
			data.online = online[item.id] === 1;
			output.push(data);
		}

		$.callback(output);
	});

	schema.setRead(function($) {

		if (UNAUTHORIZED($)) {
			$.invalid(401);
			return;
		}

		var response = DB.users.findItem('id', $.id);
		if (response) {
			var data = {};
			for (var key of schema.fields)
				data[key] = response[key];
			data.id = response.id;
			data.name = response.name;
			data.password = undefined;
			$.callback(data);
		} else
			$.invalid(404);

	});

	schema.setInsert(function($, model) {

		if ($.user && UNAUTHORIZED($)) {
			$.invalid(401);
			return;
		}

		var welcome = model.welcome;

		delete model.welcome;
		model.id = UID();
		model.dtcreated = NOW;
		model.password = model.password.sha256(CONF.secret_password);
		model.dtexpire = NOW.add('6 days');
		model.name = model.firstname + ' ' + model.lastname;
		model.isconfirmed = true;
		model.settings = {};
		model.token = GUID(25);

		welcome && CONF.mail_smtp && MAIL(model.email, '@(Welcome to the Todomator)', 'mails/welcome', model);

		DB.users.push(model);
		FUNC.save('users');
		$.success($.id);
		$.audit(model.name);
		PUBLISH('users_insert', model);
	});

	schema.setUpdate(function($, model) {

		if (UNAUTHORIZED($)) {
			$.invalid(401);
			return;
		}

		var response = DB.users.findItem('id', $.id);
		if (!response) {
			$.invalid(404);
			return;
		}

		var welcome = model.welcome;
		delete model.welcome;

		if (model.password)
			model.password = model.password.sha256(CONF.secret_password);
		else
			delete model.password;

		for (var key in model)
			response[key] = model[key];

		for (var key in MAIN.sessions) {
			var user = MAIN.sessions[key];
			if (user.id === response.id) {
				user.name = response.name;
				user.photo = response.photo;
				user.dateformat = response.dateformat;
				user.numberformat = response.numberformat;
				user.theme = response.theme;
				user.currencyid = response.currencyid;
				user.countryid = response.countryid;
				user.languageid = response.languageid;
				user.groups = response.groups;
				user.roles = response.roles;
				user.sa = response.sa;
			}
		}

		response.dtupdated = NOW;
		response.token = GUID(25);

		FUNC.save('users');
		welcome && CONF.mail_smtp && MAIL(response.email, '@(Welcome to the Todomator)', 'mails/welcome', response, response.languageid);

		$.audit(response.name);
		$.success($.id);

		PUBLISH('users_update', response);
	});

	schema.setRemove(function($) {

		if (UNAUTHORIZED($)) {
			$.invalid(401);
			return;
		}

		var index = DB.users.findIndex('id', $.id);
		if (index === -1) {
			$.invalid(404);
			return;
		}

		var response = DB.users[index];
		DB.users.splice(index, 1);

		for (var key in MAIN.sessions) {
			var user = MAIN.sessions[key];
			if (user.id === response.id)
				delete MAIN.sessions[key];
		}

		var rem = [];
		for (var doc of DB.docs) {
			if (doc.isprivate && doc.userid === response.id)
				rem.push(doc);
		}

		var isrem = rem.length > 0;

		FUNC.save('users');
		$.success($.id);
		$.audit(response.name);

		PUBLISH('users_remove', response);

		rem.wait(function(doc, next) {
			var index = DB.docs.indexOf(doc);
			if (index !== -1) {
				DB.docs.splice(index, 1);
				PATH.fs.unlink(PATH.databases('docs/' + doc.id + '.txt'), NOOP);
				PUBLISH('documents_remove', doc);
				next();
			} else
				next();
		}, function() {
			isrem && FUNC.save('docs');
		});

	});

});