NEWACTION('Common/cl', {
	name: 'List of codes',
	public: true,
	action: async function($) {
		var db = DB();
		db.find('cl_status').sort('sortindex').set('status');
		db.find('tbl_user').fields('id,name,photo,search').where('isinactive=FALSE AND isremoved=FALSE').sort('name').set('user');
		db.find('tbl_tag').fields('id,name,folderid,color,icon').set('tag');

		var builder = db.find('tbl_folder');
		builder.fields('id,name,color,icon,customer,isbillable,isprivate,ispinned,isarchived');
		builder.where('isdisabled=FALSE');
		builder.sort('ispinned', true);
		builder.sort('name');

		if (!$.user.sa)
			builder.query('id IN (SELECT folderid FROM tbl_ticket WHERE isremoved=FALSE AND (ispublic=TRUE OR ownerid={0} OR userid && {0}::_text OR watcherid && {0}::_text) GROUP BY folderid)'.format(PG_ESCAPE('{' + $.user.id + '}')));

		builder.set('folder');
		var response = await db.promise($);

		if ($.user.language && $.user.language !== 'en') {
			for (var m of response.status)
				m.name = TRANSLATE($.user.language, m.name);
		}

		$.callback(response);
	}
});

NEWACTION('Common/version', {
	name: 'Version',
	action: function($) {
		$.success(CONF.version);
	}
});

NEWACTION('Account/read', {
	name: 'Read session',
	action: function($) {
		var user = $.user;
		var obj = {};
		obj.id = user.id;
		obj.name = user.name;
		obj.sa = user.sa;
		obj.photo = user.photo;
		obj.language = user.language;
		obj.permissions = user.permissions;
		$.callback(obj);
	}
});