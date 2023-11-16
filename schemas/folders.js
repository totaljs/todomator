NEWSCHEMA('Folder', '*name,reference,icon:Icon,color:Color,customer,isdisabled:Boolean,ispinned:Boolean,isarchived:Boolean,isprivate:Boolean,isdisabled:Boolean,isbillable:Boolean,email:Email,phone:String');

NEWACTION('Folders/list', {
	name: 'List of folders',
	public: true,
	permissions: 'admin',
	action: function($) {
		DATA.find('tbl_folder').fields('id,name,icon,color,customer,isbillable,isdisabled,isprivate,isarchived,ispinned,email,phone,reference,dtcreated,dtupdated').sort('name').callback($);
	}
});

NEWACTION('Folders/read', {
	name: 'Read a folder',
	params: '*id:UID',
	public: true,
	permissions: 'admin',
	action: function($) {
		var params = $.params;
		DATA.read('tbl_folder').fields('id,name,icon,color,customer,isbillable,isdisabled,isprivate,isarchived,ispinned,email,phone,reference,dtcreated,dtupdated').id(params.id).error('@(Folder not found)').callback($);
	}
});

NEWACTION('Folders/create', {
	name: 'Create folder',
	permissions: 'admin',
	input: '@Folder',
	action: function($, model) {
		model.id = UID();
		model.dtcreated = NOW = new Date();
		DATA.insert('tbl_folder', model).callback($.done(model.id));
	}
});

NEWACTION('Folders/update', {
	name: 'Update folder',
	params: '*id:UID',
	permissions: 'admin',
	input: '@Folder',
	action: function($, model) {
		var params = $.params;
		model.dtupdated = NOW;
		DATA.modify('tbl_folder', model).id(params.id).error('@(Folder not found)').callback($.done(params.id));
	}
});

NEWACTION('Folders/remove', {
	name: 'Remove folder',
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