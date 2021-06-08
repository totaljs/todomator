NEWSCHEMA('Collections', function(schema) {

	schema.jsonschema();
	schema.compress();

	schema.define('name', 'String(50)');
	schema.define('icon', 'String(30)');
	schema.define('color', 'String(7)');
	schema.define('groups', '[String]');
	schema.define('roles', '[String]');
	schema.define('isopen', Boolean);

	schema.setQuery(function($) {

		var output = [];

		for (var item of DB.collections) {
			if (FUNC.notallowed(item, $.user))
				continue;
			output.push(item);
		}

		$.callback(output);
	});

	schema.setInsert(function($, model) {

		if ($.user && $.user.sa) {
			$.invalid(401);
			return;
		}

		model.id = UID();

		if ($.user)
			model.userid = $.user.id;

		model.dtcreated = NOW;
		DB.collections.push(model);
		FUNC.save('collections');
		$.audit(model.name);
		$.success(model.id);
		PUBLISH('collections_insert', model);
	});

	schema.setRead(function($) {
		var response = DB.collections.findItem('id', $.id);
		if (response) {
			var data = {};
			data.id = response.id;
			data.name = response.name;
			data.color = response.color;
			data.icon = response.icon;
			data.groups = response.groups;
			data.roles = response.roles;
			$.callback(data);
		} else
			$.invalid(404);
	});

	schema.setUpdate(function($, model) {

		if (!$.user.sa) {
			$.invalid(401);
			return;
		}

		var response = DB.collections.findItem('id', $.id);
		if (response) {
			for (var key in model)
				response[key] = model[key];
			response.dtupdated = NOW;
			FUNC.save('collections');
			$.audit(model.name);
			$.success($.id);
			PUBLISH('collections_update', response);
		} else
			$.invalid(404);
	});

	schema.setRemove(function($) {

		if (!$.user.sa) {
			$.invalid(401);
			return;
		}

		var index = DB.collections.findIndex('id', $.id);
		if (index !== -1) {
			var response = DB.collections[index];
			DB.collections.splice(index, 1);

			var remove = [];
			for (var item of DB.docs) {
				if (item.collectionid === response.id)
					remove.push(item.id);
			}

			DB.docs = DB.docs.remove('collectionid', response.id);
			FUNC.save('collections', 'docs');

			$.audit(response.name);
			$.success($.id);

			remove.wait(function(id, next) {
				PATH.fs.unlink(PATH.databases('docs/' + id + '.txt'), next);
			});

			PUBLISH('collections_remove', response);

		} else
			$.invalid(404);
	});

	schema.addWorkflow('cl', function($) {

		var collectionid = $.query.id;
		var projects = {};
		var tags = {};
		var groups = {};
		var roles = {};

		for (var item of DB.docs) {

			if (item.groups && item.groups.length) {
				for (var g of item.groups)
					groups[g] = 1;
			}

			if (item.roles && item.roles.length) {
				for (var g of item.roles)
					roles[g] = 1;
			}

			if (collectionid && item.collectionid !== collectionid)
				continue;

			if (FUNC.notallowed(item, $.user))
				continue;

			var col = DB.collections.findItem('id', item.collectionid);
			if (!col || FUNC.notallowed(col, $.user))
				continue;

			if (item.project) {
				if (projects[item.project])
					projects[item.project]++;
				else
					projects[item.project] = 1;
			}

			if (item.tags && item.tags.length) {
				for (var tag of item.tags) {
					if (tags[tag])
						tags[tag]++;
					else
						tags[tag] = 1;
				}
			}
		}

		var output_projects = [];
		var output_tags = [];
		var output_groups = [];
		var output_roles = [];

		for (var item of DB.users) {
			if (item.groups && item.groups.length) {
				for (var g of item.groups)
					groups[g] = 1;
			}

			if (item.roles && item.roles.length) {
				for (var g of item.roles)
					roles[g] = 1;
			}
		}

		for (var key in groups)
			output_groups.push({ id: key, name: key, count: groups[key] });

		for (var key in roles)
			output_roles.push({ id: key, name: key, count: roles[key] });

		for (var key in projects)
			output_projects.push({ id: key, name: key, count: projects[key] });

		for (var key in tags)
			output_tags.push({ id: key, name: key, count: tags[key] });

		$.callback({ projects: output_projects, tags: output_tags, groups: output_groups, roles: output_roles });
	});

});