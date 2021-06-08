NEWOPERATION('cl', function($) {
	var output = {};
	PATH.fs.readFile(PATH.databases('countries.json'), function(err, response) {
		output.countries = response ? response.toString('utf8').parseJSON(true) : [];
		PATH.fs.readFile(PATH.databases('currencies.json'), function(err, response) {
			output.currencies = response ? response.toString('utf8').parseJSON(true) : [];
			PATH.fs.readFile(PATH.databases('languages.json'), function(err, response) {
				output.languages = response ? response.toString('utf8').parseJSON(true) : [];
				$.callback(output);
			});
		});
	});
});