NEWSCHEMA('Account', function(schema) {

	schema.action('read', {
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

});