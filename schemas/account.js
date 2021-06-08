NEWSCHEMA('Account', function(schema) {

	schema.compress();

	schema.define('languageid', 'Lower(2)');
	schema.define('countryid', 'Upper(3)');
	schema.define('currencyid', 'Upper(3)');
	schema.define('theme', Number);
	schema.define('photo', 'String(50)');
	schema.define('firstname', 'Name(40)');
	schema.define('lastname', 'Name(40)');
	schema.define('email', 'Email');
	schema.define('phone', 'Phone');
	schema.define('ispassword', Boolean);
	schema.define('password', 'String(80)');
	schema.define('dateformat', ['dd.MM.yyyy', 'yyyy-MM-dd', 'MM.dd.yyyy']);
	schema.define('numberformat', Number);
	schema.define('timeformat', Number);
	schema.define('datefirst', Number);

	var FIELDS = 'position,languageid,countryid,currencyid,photo,firstname,lastname,email,phone,dateformat,numberformat,timeformat,theme,datefirst'.split(',');

	schema.setRead(function($) {
		var response = DB.users.findItem('id', $.user.id);
		if (response) {
			var data = {};
			for (var key of FIELDS)
				data[key] = response[key];
			$.callback(data);
		} else
			$.invalid(404);
	});

	schema.addWorkflow('check', function($, model) {
		var response = DB.users.findItem(item => item.id !== $.user.id && (item.email === model.email || item.phone === model.phone));
		if (response)
			$.invalid('@(Email or phone number is already used)');
		else
			$.success();
	});

	schema.setSave(function($, model) {

		var response = DB.users.findItem('id', $.user.id);
		if (!response) {
			$.invalid(404);
			return;
		}

		model.dtupdated = NOW;

		if (model.ispassword && model.password)
			model.password = model.password.sha256(CONF.secret_password);
		else
			delete model.password;

		model.name = model.firstname + ' ' + model.lastname;
		delete model.ispassword;

		for (var key in model)
			response[key] = model[key];

		// Update all sessions
		for (var key in MAIN.sessions) {
			var user = MAIN.sessions[key];
			if (user.id === $.user.id) {
				user.name = model.name;
				user.photo = model.photo;
				user.dateformat = model.dateformat;
				user.numberformat = model.numberformat;
				user.theme = model.theme;
				user.currencyid = model.currencyid;
				user.countryid = model.countryid;
				user.languageid = model.languageid;
			}
		}

		FUNC.save('users');
		PUBLISH('users_update', response);
		$.success($.user.json());
	});

	schema.addWorkflow('sessions', function($) {

		var output = [];

		for (var item of DB.sessions) {
			if (item.userid === $.user.id) {
				var data = {};
				data.id = item.id;
				data.ua = item.ua;
				data.ip = item.ip;
				data.isonline = item.isonline;
				data.note = item.note;
				data.dtcreated = item.dtcreated;
				data.dtexpire = item.dtexpire;
				data.dtlogged = item.dtlogged;
				data.iscurrent = $.user.sessionid === item.id;
				output.push(data);
			}
		}

		output.quicksort('dtcreated_desc');
		$.callback(output);
	});

	schema.addWorkflow('logout', function($) {

		var id = $.id || $.user.sessionid;
		var index = DB.sessions.findIndex('id', id);
		if (index !== -1) {
			var session = DB.sessions[index];
			if (session.userid === $.user.id) {
				DB.sessions.splice(index, 1);
				FUNC.save('sessions');
			} else {
				$.invalid(404);
				return;
			}
		} else {
			$.invalid(404);
			return;
		}

		var user = DB.users.findItem('id', $.user.id);

		if (!$.id) {
			if (user)
				user.isonline = false;
			$.cookie(CONF.cookie, '', '-1 day');
		}

		delete MAIN.sessions[id];
		PUBLISH('users_logout', user);
		$.success();
	});

});