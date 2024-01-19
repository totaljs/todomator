NEWACTION('Settings/read', {
	name: 'Read settings',
	action: async function($) {

		if (UNAUTHORIZED($, 'settings'))
			return;

		var keys = 'name,token,minlogtime,backup'.split(',');
		var obj = {};

		for (var m of keys)
			obj[m] = CONF[m];

		$.callback(obj);
	}
});

NEWACTION('Settings/save', {
	name: 'Save settings',
	input: 'name:String, token:String, minlogtime:Number, backup:Boolean',
	action: async function($, model) {

		if (UNAUTHORIZED($, 'settings'))
			return;

		if (!model.minlogtime)
			model.minlogtime = 1;

		for (var key in model) {
			var val = model[key];
			await DATA.modify('cl_config', { id: key, value: val, type: val instanceof Date ? 'date' : val == null ? 'string' : typeof(val) }, true).id(key).promise($);
		}

		FUNC.reconfigure();
		$.success();
	}
});