NEWSCHEMA('Settings', function(schema) {

	schema.action('read', {
		name: 'Read settings',
		action: async function($) {
			if (UNAUTHORIZED($, 'settings'))
				return;
			$.callback(MAIN.db.config);
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
				MAIN.db.config[key] = model[key];

			MAIN.db.save();
			FUNC.reconfigure();

			$.success();
		}
	});

});