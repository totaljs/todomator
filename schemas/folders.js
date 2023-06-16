NEWSCHEMA('Folders', function(schema) {

	schema.define('name', String, true);
	schema.define('reference', String);
	schema.define('icon', 'Icon');
	schema.define('color', 'Color');
	schema.define('customer', String);
	schema.define('isdisabled', Boolean);
	schema.define('ispinned', Boolean);
	schema.define('isarchived', Boolean);
	schema.define('isprivate', Boolean);
	schema.define('isdisabled', Boolean);
	schema.define('isbillable', Boolean);
	schema.define('email', 'Email');
	schema.define('phone', 'Phone');

	schema.action('list', {
		name: 'List of folders',
		public: true,
		permissions: 'admin',
		action: function($) {
			DATA.find('tbl_folder').fields('id,name,icon,color,customer,isbillable,isdisabled,isprivate,isarchived,ispinned,email,phone,reference,dtcreated,dtupdated').sort('name').callback($.callback);
		}
	});

	schema.action('read', {
		name: 'Read a project',
		params: '*id:UID',
		public: true,
		permissions: 'admin',
		action: function($) {
			var params = $.params;
			DATA.read('tbl_folder').fields('id,name,icon,color,customer,isbillable,isdisabled,isprivate,isarchived,ispinned,email,phone,reference,dtcreated,dtupdated').id(params.id).error('@(Folder not found)').callback($.callback);
		}
	});

	schema.action('create', {
		name: 'Create project',
		permissions: 'admin',
		action: function($, model) {
			model.id = UID();
			model.dtcreated = NOW = new Date();
			DATA.insert('tbl_folder', model).callback($.done(model.id));
		}
	});

	schema.action('update', {
		name: 'Update project',
		params: '*id:UID',
		permissions: 'admin',
		action: function($, model) {
			var params = $.params;
			model.dtupdated = NOW;
			DATA.modify('tbl_folder', model).id(params.id).error('@(Folder not found)').callback($.done(params.id));
		}
	});

	schema.action('remove', {
		name: 'Remove project',
		params: '*id:UID',
		permissions: 'admin',
		action: function($) {
			var params = $.params;
			var model = {};
			model.isremoved = true;
			model.dtupdated = NOW;
			DATA.remove('tbl_folder').id(params.id).error('@(Folder not found)').callback($.done(params.id));
		}
	});

});