exports.install = function() {

	// Collections
	ROUTE('+GET       /api/collections/                     *Collections        --> query');
	ROUTE('+GET       /api/collections/{id}/                *Collections        --> read');
	ROUTE('+DELETE    /api/collections/{id}/                *Collections        --> remove');
	ROUTE('+POST      /api/collections/                     *Collections        --> insert');
	ROUTE('+POST      /api/collections/{id}/                *Collections        --> update');
	ROUTE('+GET       /api/collections/cl/                  *Collections        --> cl');
	ROUTE('+POST      /api/collections/sort/                *Collections/Sort   --> save');

	// Users
	ROUTE('+GET       /api/users/                           *Users              --> query');
	ROUTE('+GET       /api/users/{id}/                      *Users              --> read');
	ROUTE('+DELETE    /api/users/{id}/                      *Users              --> remove');
	ROUTE('+POST      /api/users/                           *Users              --> insert');
	ROUTE('+POST      /api/users/{id}/                      *Users              --> update');

	// Docs
	ROUTE('+GET       /api/docs/                            *Docs               --> query');
	ROUTE('+GET       /api/docs/{id}/                       *Docs               --> read');
	ROUTE('+POST      /api/docs/                            *Docs               --> insert');
	ROUTE('+POST      /api/docs/{id}/                       *Docs               --> update');
	ROUTE('+GET       /api/docs/{id}/date/                  *Docs               --> date');
	ROUTE('+DELETE    /api/docs/{id}/                       *Docs               --> remove');
	ROUTE('+GET       /api/docs/{id}/body/                  *Docs/Body          --> read');
	ROUTE('+POST      /api/docs/{id}/body/                  *Docs/Body          --> save');
	ROUTE('+GET       /api/docs/{id}/archive/               *Docs               --> archive');
	ROUTE('+GET       /api/docs/{id}/clone/                 *Docs               --> clone');
	ROUTE('+GET       /api/docs/{id}/linewrapping/          *Docs               --> linewrapping');
	ROUTE('+GET       /api/docs/{id}/favorite/              *Docs               --> favorite');
	ROUTE('+DELETE    /api/docs/{id}/files/{fileid}/        *Docs               --> removefile');
	// ROUTE('+GET       /api/docs/{id}/backups/               *Docs               --> backups');
	// ROUTE('+GET       /api/docs/{id}/backups/{backupid}/    *Docs               --> restore');

	// Codelists
	ROUTE('GET        /api/cl/                              *                   --> cl');

	// Settings
	ROUTE('+GET       /api/settings/                        *Settings           --> read');
	ROUTE('+POST      /api/settings/                        *Settings           --> save');
	ROUTE('+POST      /api/settings/smtp/                   *Settings/SMTP      --> exec');
	ROUTE('+POST      /api/settings/totalapi/               *Settings/TotalAPI  --> exec');

	// Accounts
	ROUTE('+GET       /api/account/                         *Account            --> read');
	ROUTE('+POST      /api/account/                         *Account            --> save');
	ROUTE('+GET       /api/account/logout/                  *Account            --> logout');
	ROUTE('+GET       /api/account/logout/{id}/             *Account            --> logout');
	ROUTE('-POST      /api/account/login/                   *Login              --> exec');
	ROUTE('-POST      /api/account/login/token/             *Token              --> exec');
	ROUTE('-POST      /api/account/reset/                   *Password           --> exec');
	ROUTE('+GET       /api/account/sessions/                *Account            --> sessions');

	ROUTE('POST       /api/upload/base64/', json_upload_base64, [10000], 2048); // 2 MB
	ROUTE('POST       /api/upload/', json_upload, [10000], 1024 * 10); // 10 MB
	ROUTE('GET        /api/check/', checksession);

	ROUTE('FILE       /files/', files);
	ROUTE('FILE       /download/', download);
};

function checksession() {
	this.success(!!this.user);
}

function files(req, res) {
	var id = req.split[1];
	res.filefs('files', id.substring(0, id.lastIndexOf('.')), true);
}

function download(req, res) {
	var id = req.split[1];
	res.filefs('photos', id.substring(0, id.lastIndexOf('.')));
}

function json_upload() {
	var $ = this;

	if (!$.query.id) {
		$.invalid('@(Missing document ID)');
		return;
	}

	var doc = DB.docs.findItem('id', $.query.id);
	if (!doc) {
		$.invalid('@(Missing document ID)');
		return;
	}

	var output = [];
	$.files.wait(function(file, next) {

		var tmp = {};
		tmp.id = UID();
		tmp.name = file.filename;
		tmp.userid = $.user.id;
		tmp.size = file.size;
		tmp.date = NOW;
		output.push(tmp);
		file.fs('files', tmp.id, next);

	}, function() {
		if (!doc.files)
			doc.files = [];
		doc.files.push.apply(doc.files, output);
		FUNC.save('docs');
		MAIN.ws && MAIN.ws.send({ TYPE: 'files', files: doc.files }, client => client.docid === doc.id);
		$.success();
	});
}

function json_upload_base64() {
	var self = this;
	var data = (self.body.base64 || self.body.file).base64ToBuffer();

	if (!data) {
		self.invalid('error-data');
		return;
	}

	var id = UID();
	FILESTORAGE('photos').save(id, self.user.name.slug() + '.jpg', data, function() {
		self.json('/download/' + id + '.jpg');
	});
}