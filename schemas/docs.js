NEWSCHEMA('Docs', function(schema) {

	schema.jsonschema();
	schema.compress();

	schema.define('parentid', UID)(null);
	schema.define('collectionid', UID)(null);
	schema.define('number', 'String(40)');
	schema.define('name', 'String(80)');
	schema.define('project', 'String(50)');
	schema.define('color', 'String(7)');
	schema.define('icon', 'String(30)');
	schema.define('reference', 'String(40)');
	schema.define('pin', 'String(6)');
	schema.define('currencyid', 'Upper(3)')(null);
	schema.define('hourlyrate', Number);
	schema.define('date', Date);
	schema.define('isprivate', Boolean);
	schema.define('groups', '[String]');
	schema.define('roles', '[String]');

	schema.setQuery(function($) {

		var date = $.query.date ? $.query.date.parseDate().format('yyyy-MM-dd') : null;
		var output = [];
		var today = +NOW.format('yyyyMMdd');
		var openonly = $.query.collectionid === 'open';
		if (openonly)
			$.query.collectionid = '';

		for (var item of DB.docs) {

			if ($.query.collectionid && item.collectionid !== $.query.collectionid)
				continue;

			if ($.query.categoryid && item.categoryid !== $.query.categoryid)
				continue;

			if ($.query.parentid && item.parentid !== $.query.parentid)
				continue;

			if (date && item.date !== date)
				continue;

			if ($.query.search && item.search.indexOf($.query.search) === -1)
				continue;

			if ($.query.uncomplete && item.isdone)
				continue;

			if (FUNC.notallowed(item, $.user))
				continue;

			var col = DB.collections.findItem('id', item.collectionid);

			if (FUNC.notallowed(col, $.user))
				continue;

			if (openonly && (!col.isopen || item.date3 > today || item.isarchived))
				continue;

			output.push(item);
		}

		// output.quicksort('isarchived_asc,isfavorite_desc,countpriorities_desc,date_desc,dtcreated_desc');
		$.callback(output);
	});

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
		for (var key of schema.fields)
			data[key] = response[key];

		data.id = $.id;
		data.date = data.date.parseDate();
		$.callback(data);
	});

	schema.setInsert(function($, model) {
		NOW = new Date();
		model.id = UID();
		model.userid = $.user.id;
		model.dtcreated = NOW;
		model.islinewrapping = false;
		model.search = (model.name + ' ' + model.project + ' ' + model.number + ' ' + model.reference).toSearch().max(200);
		model.date2 = model.date.format('yyyy-MM-dd');
		model.date3 = +model.date.format('yyyyMMdd');
		model.isarchived = false;
		model.isfavorite = false;
		model.countpriorities = 0;
		DB.docs.push(model);
		FUNC.save('docs');
		$.audit(model.name);
		$.success(model.id);
		PUBLISH('documents_insert', model);
	});

	schema.setUpdate(function($, model) {

		var response = DB.docs.findItem('id', $.id);
		if (!response) {
			$.invalid(404);
			return;
		}

		if (FUNC.notallowed(response, $.user)) {
			$.invalid(401);
			return;
		}

		for (var key in model)
			response[key] = model[key];

		response.dtupdated = NOW;
		response.date2 = response.date.format('yyyy-MM-dd');
		response.date3 = +response.date.format('yyyyMMdd');
		response.search = (model.name + ' ' + model.project + ' ' + model.number + ' ' + model.reference).toSearch().max(200);

		FUNC.save('docs');
		MAIN.ws && MAIN.ws.send({ TYPE: 'close' }, client => client.docid === $.id && client.user.id !== $.user.id);
		$.audit(response.name);
		$.success($.id);

		PUBLISH('documents_update', response);
	});

	schema.setRemove(function($) {
		var index = DB.docs.findIndex('id', $.id);
		if (index !== -1) {

			var response = DB.docs[index];

			if (FUNC.notallowed(response, $.user)) {
				$.invalid(401);
				return;
			}

			DB.docs.splice(index, 1);
			PATH.fs.unlink(PATH.databases('docs/' + $.id + '.txt'), NOOP);
			FUNC.save('docs');
			$.audit(response.name);
			$.success($.id);
			PUBLISH('documents_remove', response);

			// Removes all files
			response.files && response.files.wait(function(file, next) {
				FILESTORAGE('files').remove(file.id, next);
			});

		} else
			$.invalid(404);
	});

	schema.addWorkflow('clone', function($) {
		var response = DB.docs.findItem('id', $.id);
		if (response) {

			if (FUNC.notallowed(response, $.user)) {
				$.invalid(401);
				return;
			}

			var doc = CLONE(response);
			doc.id = UID();
			doc.dtcreated = NOW;
			doc.iscloned = true;
			delete doc.dtupdated;

			PATH.fs.readFile(PATH.databases('docs/' + $.id + '.txt'), function(err, response) {
				if (response) {
					PATH.fs.writeFile(PATH.databases('docs/' + doc.id + '.txt'), response, function() {
						DB.docs.push(doc);
						FUNC.save('docs');
						$.audit(response.name);
						$.success(doc.id);
						PUBLISH('documents_clone', response);
					});
				} else
					$.invalid(err);
			});
		} else
			$.invalid(404);
	});

	schema.addWorkflow('archive', function($) {
		var response = DB.docs.findItem('id', $.id);
		if (response) {

			if (FUNC.notallowed(response, $.user)) {
				$.invalid(401);
				return;
			}

			response.isarchived = response.isarchived ? false : true;
			response.dtarchived = NOW;
			FUNC.save('docs');
			$.audit(response.name);
			$.success($.id);
			PUBLISH('documents_archive', response);
		} else
			$.invalid(404);
	});

	schema.addWorkflow('favorite', function($) {
		var response = DB.docs.findItem('id', $.id);
		if (response) {

			if (FUNC.notallowed(response, $.user)) {
				$.invalid(401);
				return;
			}

			response.isfavorited = response.isfavorited ? false : true;
			response.dtfavorited = NOW;
			FUNC.save('docs');
			$.audit(response.name);
			$.success($.id);
			PUBLISH('documents_favorite', response);
		} else
			$.invalid(404);
	});

	schema.addWorkflow('linewrapping', function($) {
		var response = DB.docs.findItem('id', $.id);
		if (response) {

			if (FUNC.notallowed(response, $.user)) {
				$.invalid(401);
				return;
			}

			response.islinewrapping = response.islinewrapping ? false : true;
			FUNC.save('docs');
			$.audit(response.name);
			$.success($.id);
		} else
			$.invalid(404);
	});

	schema.addWorkflow('date', function($) {
		var response = DB.docs.findItem('id', $.id);
		if (response) {

			if (FUNC.notallowed(response, $.user)) {
				$.invalid(401);
				return;
			}

			response.date = $.filter.date;
			response.date2 = response.date.format('yyyy-MM-dd');
			response.date3 = +response.date.format('yyyyMMdd');

			FUNC.save('docs');
			$.audit(response.name);
			$.success($.id);
			PUBLISH('documents_update', response);
		} else
			$.invalid(404);

	}, 'date:Date');

	schema.addWorkflow('removefile', function($) {

		var response = DB.docs.findItem('id', $.id);
		if (response) {

			if (FUNC.notallowed(response, $.user)) {
				$.invalid(401);
				return;
			}

			if (response.files) {
				var index = response.files.findIndex('id', $.params.fileid);
				if (index !== -1) {
					FILESTORAGE('files').remove($.params.fileid);
					response.files.splice(index, 1);
					FUNC.save('docs');
					$.audit(response.name);
					MAIN.ws && MAIN.ws.send({ TYPE: 'files', files: response.files }, client => client.docid === response.id);
				}
			}

			$.success(response.files);
			PUBLISH('documents_update', response);
		} else
			$.invalid(404);
	});

});

