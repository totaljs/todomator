NEWSCHEMA('Docs/Body', function(schema) {

	schema.compress();
	schema.define('body', String);
	schema.define('changelog', 'String(100)');
	schema.trim = false;

	const FIELDS = 'id,userid,files,name,project,date,icon,hourlyrate,currencyid,dtcreated,dtupdated,dtarchived,islinewrapping,isarchived,isfavorited'.split(',');

	schema.setRead(function($) {

		var response = DB.docs.findItem('id', $.id);

		if (!response) {
			$.invalid(404);
			return;
		}

		if (FUNC.notallowed(response, $.user)) {
			$.invalid(401);
			return;
		}

		var data = {};

		for (var key of FIELDS)
			data[key] = response[key];

		data.owner = $.user.id === response.userid;

		if (!data.isarchived)
			data.dtarchived = null;

		data.sync = true;

		PATH.fs.readFile(PATH.databases('docs/' + $.id + '.txt'), function(err, response) {
			data.body = response ? response.toString('utf8') : '';
			$.callback(data);
		});

	});

	schema.setSave(function($, model) {

		var response = DB.docs.findItem('id', $.id);
		if (!response) {
			$.invalid(404);
			return;
		}

		if (FUNC.notallowed(response, $.user)) {
			$.invalid(401);
			return;
		}

		NOW = new Date();

		var stats = FUNC.stats(model.body);
		response.changelog = undefined;
		response.counttasks = stats.tasks;
		response.countminutes = stats.minutes;
		response.countpending = stats.pending;
		response.countcompleted = stats.complete;
		response.countcanceled = stats.canceled;
		response.countprices = stats.prices;
		response.countpriorities = stats.priorities;
		response.countworking = stats.working;
		response.countestimate = stats.estimate;
		response.countusers = stats.users.length;
		response.counttags = stats.tags.length;
		response.tags = stats.tags;
		response.dtexpire = stats.expire;
		response.dtupdated = NOW;

		if (response.countupdates)
			response.countupdates++;
		else
			response.countupdates = 1;

		PATH.fs.writeFile(PATH.databases('docs/' + $.id + '.txt'), model.body, ERROR('docsave'));

		// if ($.query.notify)
		// 	response.ismodified = true;

		response.ip = $.ip;
		FUNC.save('docs');

		if (CONF.allow_tms) {
			var doc = CLONE(response);
			doc.body = model.body;
			doc.userid = $.user.id;
			doc.username = $.user.name;
			doc.useremail = $.user.email;
			PUBLISH('documents_body', doc);
		}

		$.success($.id);
	});

});