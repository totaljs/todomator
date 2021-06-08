global.DB = {};

DB.users = [];
DB.collections = [];
DB.categories = [];
DB.docs = [];
DB.sessions = [];

var pending = {};

FUNC.saveforce = function(type) {
	delete pending[type];
	PATH.fs.writeFile(PATH.databases(type + '.json'), JSON.stringify(DB[type]), NOOP);
};

FUNC.save = function(type) {
	pending[type] && clearTimeout(pending[type]);
	pending[type] = setTimeout(FUNC.saveforce, 5000, type);
};

PATH.fs.mkdir(PATH.databases('docs'), NOOP);

Object.keys(DB).wait(function(key, next) {
	PATH.fs.readFile(PATH.databases(key + '.json'), function(err, response) {
		if (response)
			DB[key] = response.toString('utf8').parseJSON(true);
		next();
	});
}, function() {

	// Makes a default collection
	if (!DB.collections.length)
		EXEC('+Collections --> insert', { name: 'Projects' }, NOOP);

	if (!DB.users.length) {
		var password = GUID(10);
		var email = GUID(10) + '@todomator.com';
		PREF.set('initcredentials', { email: email, password: password });
		EXEC('+Users --> insert', { gender: 'male', languageid: 'en', sa: true, countryid: 'SVK', currencyid: 'EUR', firstname: 'Total', lastname: 'Admin', email: email, password: password }, ERROR('Create default user'));
	}

	EXEC('-Settings --> load', ERROR('configuration'));
});