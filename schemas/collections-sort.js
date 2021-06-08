NEWSCHEMA('Collections/Sort', function(schema) {

	schema.define('id', '[UID]', true);

	schema.setSave(function($) {

		for (var i = 0; i < $.model.id.length; i++) {
			var id = $.model.id[i];
			var response = DB.collections.findItem('id', id);
			if (response)
				response.sortindex = i;
		}

		FUNC.save('collections');
		$.audit();
		$.success();
	});

});