NEWSCHEMA('Settings', function(schema) {

	schema.action('read', {
		name: 'Read settings',
		action: async function($) {

			if (UNAUTHORIZED($, 'settings'))
				return;

			var response = await DATA.find('cl_config').fields('id,value').in('id', 'name,token,minlogtime'.split(',')).promise($);
			var obj = {};

			for (var m of response)
				obj[m.id] = m.value;

			obj.minlogtime = obj.minlogtime ? +obj.minlogtime : 0;
			$.callback(obj);
		}
	});

	schema.action('save', {
		name: 'Save settings',
		input: 'name:String, token:String, minlogtime:Number',
		action: async function($, model) {

			if (UNAUTHORIZED($, 'settings'))
				return;

			if (!model.minlogtime)
				model.minlogtime = 1;

			for (var key in model)
				await DATA.modify('cl_config', { value: model[key] }).id(key).promise($);

			FUNC.reconfigure();
			$.success();
		}
	});

});