NEWACTION('Tags/list', {
	name: 'List of all tags',
	query: 'folderid:UID',
	action: function($) {
		var query = $.query;
		var builder = DATA.find('tbl_tag').sort('name');
		query.folderid && builder.where('folderid', query.folderid);
		builder.callback($);
	}
});

NEWACTION('Tags/read', {
	name: 'Read tag',
	params: '*id:String',
	action: function($) {
		var params = $.params;
		DATA.read('tbl_tag').id(params.id).error(404).callback($);
	}
});

NEWACTION('Tags/create', {
	name: 'Create tag',
	input: 'folderid:UID, *name:String, icon:Icon, color:Color',
	permissions: 'admin',
	action: async function($, model) {

		// Check existing
		if (model.folderid) {
			let tmp = await DATA.read('tbl_tag').fields('id').where('folderid', model.folderid).where('name', model.name).promise();
			if (tmp) {
				$.success(tmp.id);
				return;
			}
		}

		model.id = U.random_text(3);
		model.dtcreated = NOW;
		model.search = model.name.slug().replace(/-/g, '');

		if (!model.folderid)
			model.folderid = null;

		await DATA.insert('tbl_tag', model).promise($);
		$.success(model.id);
		FUNC.refreshtags();
	}
});

NEWACTION('Tags/update', {
	name: 'Update tag',
	input: 'folderid:UID, *name:String, icon:Icon, color:Color',
	params: '*id:String',
	permissions: 'admin',
	action: async function($, model) {

		var params = $.params;

		model.dtupdated = NOW;
		model.search = model.name.slug().replace(/-/g, '');

		if (!model.folderid)
			model.folderid = null;

		await DATA.modify('tbl_tag', model).id(params.id).error(404).promise($);
		$.success(params.id);
		FUNC.refreshtags();
	}
});

NEWACTION('Tags/remove', {
	name: 'Remove tag',
	params: '*id:String',
	permissions: 'admin',
	action: async function($) {
		var params = $.params;
		await DATA.remove('tbl_tag').id(params.id).error(404).promise($);
		await DATA.query('UPDATE tbl_ticket SET tags=array_remove(tags, {0})'.format(PG_ESCAPE(params.id)));
		FUNC.refreshtags();
		$.success();
	}
});