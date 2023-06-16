exports.install = function() {

	// Misc
	ROUTE('+API    /api/       -account                   *Account    --> read');
	ROUTE('+API    /api/       +cl                        *Common     --> cl');

	// Tickets
	ROUTE('+API    /api/       -tickets                   *Tickets    --> list');
	ROUTE('+API    /api/       -tickets_calendar          *Tickets    --> calendar');
	ROUTE('+API    /api/       -tickets_detail/{id}       *Tickets    --> read');
	ROUTE('+API    /api/       -tickets_users             *Tickets    --> users');
	ROUTE('+API    /api/       +tickets_create            *Tickets    --> create');
	ROUTE('+API    /api/       #tickets_update/{id}       *Tickets    --> update');
	ROUTE('+API    /api/       +tickets_clone/{id}        *Tickets    --> clone');
	ROUTE('+API    /api/       -tickets_remove/{id}       *Tickets    --> remove');
	ROUTE('+API    /api/       -tickets_logs/{id}         *Tickets    --> logs');
	ROUTE('+API    /api/       -tickets_history/{id}      *Tickets    --> history');
	ROUTE('+API    /api/       +tickets_bookmarks/{id}    *Tickets    --> bookmark');
	ROUTE('+API    /api/       -tickets_unread            *Tickets    --> unread');
	ROUTE('+API    /api/       -tickets_counter           *Tickets    --> counter');
	ROUTE('+API    /api/       +tickets_link/{id}         *Tickets    --> link');
	ROUTE('+API    /api/       -tickets_links/{id}        *Tickets    --> links');
	ROUTE('+API    /api/       -tickets_reset/{id}        *Tickets    --> reset');
	ROUTE('+API    /api/       +logwork_create            *Tickets    --> logwork_create');
	ROUTE('+API    /api/       +logwork_update/{id}       *Tickets    --> logwork_update');
	ROUTE('+API    /api/       -logwork_remove/{id}       *Tickets    --> logwork_remove');
	ROUTE('+API    /api/       -logwork_open              *Tickets    --> logwork_open');
	ROUTE('+API    /api/       +logwork_start             *Tickets    --> logwork_start');
	ROUTE('+API    /api/       +logwork_stop              *Tickets    --> logwork_stop');
	ROUTE('+API    /api/       -data_read/{id}            *Tickets    --> data_read');
	ROUTE('+API    /api/       +data_save/{id}            *Tickets    --> data_save');

	// Folders
	ROUTE('+API    /api/       -folders                   *Folders    --> list');
	ROUTE('+API    /api/       -folders_read/{id}         *Folders    --> read');
	ROUTE('+API    /api/       +folders_create            *Folders    --> create');
	ROUTE('+API    /api/       +folders_update/{id}       *Folders    --> update');
	ROUTE('+API    /api/       -folders_remove/{id}       *Folders    --> remove');

	// Tags
	ROUTE('+API    /api/       -tags                      *Tags       --> list');
	ROUTE('+API    /api/       -tags_read/{id}            *Tags       --> read');
	ROUTE('+API    /api/       +tags_create               *Tags       --> create');
	ROUTE('+API    /api/       +tags_update/{id}          *Tags       --> update');
	ROUTE('+API    /api/       -tags_remove/{id}          *Tags       --> remove');

	// Settings
	ROUTE('+API    /api/       -settings_read             *Settings   --> read');
	ROUTE('+API    /api/       +settings_save             *Settings   --> save');

	// Files
	ROUTE('+POST  /upload/', upload, ['upload'], 1024 * 5);
	ROUTE('FILE   /download/*.*', files);

	ROUTE('+SOCKET  /api/', socket);
};

function socket() {
	var self = this;
	MAIN.ws = self;
	self.autodestroy(() => MAIN.ws = null);
}

async function upload() {

	var $ = this;
	var output = [];

	var db = DB();

	for (var file of $.files) {
		var obj = {};
		obj.id = UID();
		obj.type = file.type;
		obj.size = file.size;
		obj.ext = file.extension;
		obj.url = '/download/' + obj.id.sign(CONF.salt) + '.' + obj.ext;
		obj.name = file.filename;
		obj.width = file.width;
		obj.height = file.height;
		obj.dtcreated = NOW;
		await file.fs('attachments', obj.id);
		output.push(obj);
	}

	$.json(output);

	// Write to DB
	for (var obj of output) {
		if ($.query.folderid)
			obj.folderid = $.query.folderid;
		if ($.query.ticketid)
			obj.ticketid = $.query.ticketid;
		obj.userid = $.user.id;
		obj.search = obj.name.toSearch();
		db.insert('tbl_file', obj);
	}
}

const Download = { js: 1, html: 1, md: 1, css: 1 };

function files(req, res) {
	var filename = req.split[1];
	var id = filename.substring(0, filename.lastIndexOf('.'));
	var arr = id.split('-');
	if (arr[0].sign(CONF.salt) === id) {
		var download = req.query.download === '1' || Download[req.extension] == 1;
		res.filefs('attachments', arr[0], download, null, null);
	} else
		res.throw404();
}