exports.install = function() {
	ROUTE('GET ' + (CONF.tapi || '/tapi/'), api);
};

function api($) {

	if (TEMP.TAPI) {
		$.json(TEMP.TAPI);
		return;
	}

	var items = [];
	var output = [];

	for (let key in F.actions) {
		let action = F.actions[key];
		if (action.public)
			items.push({ action: key, schema: key, icon: action.icon, name: action.name, params: action.params, input: action.input, ouptut: action.ouptut, query: action.query, summary: action.summary });
	}

	for (let route of F.routes.routes) {

		if (!route.api)
			continue;

		var actions = route.api;
		for (var b in actions) {
			var action = actions[b];
			for (var i = 0; i < items.length; i++) {
				var m = items[i];

				if (CONF.tapiendpoint && action.url !== CONF.tapiendpoint)
					continue;

				if (action.actions.indexOf(m.action) !== -1) {
					m.id = action.name;
					m.url = $.hostname(route.url2);
					m.action = undefined;
					m.schema = undefined;
					output.push(m);
					break;
				}
			}
		}
	}

	TEMP.TAPI = output;
	$.json(output);
}