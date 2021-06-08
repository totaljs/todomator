exports.install = function() {
	ROUTE('+GET       /', 'index');
	ROUTE('-GET       /', 'landing');
	ROUTE('+SOCKET    /', socket);
};

function socket() {

	var self = this;
	var open = {};

	MAIN.ws = self;
	self.autodestroy(() => MAIN.ws = null);

	self.on('open', function(client) {
		client.send({ TYPE: 'init', id: client.id, version: CONF.version });
	});

	self.on('close', function(client) {
		if (client.docid) {
			if (open[client.docid]) {
				var index = open[client.docid].indexOf(client);
				if (index !== -1)
					open[client.docid].splice(index, 1);
				if (!open[client.docid].length)
					delete open[client.docid];
			}
			self.send({ TYPE: 'sync_cancel', sync: open[client.docid] && open[client.docid].length > 1, clientid: client.id }, conn => conn.docid === client.docid);
			client.docid = null;
		}
	});

	self.on('message', function(client, message) {
		switch (message.TYPE) {

			case 'open':

				if (client.docid && client.docid !== message.id && open[client.docid]) {
					var index = open[client.docid].indexOf(client);
					if (index !== -1)
						open[client.docid].splice(index, 1);
					if (!open[client.docid].length)
						delete open[client.docid];
					self.send({ TYPE: 'sync_cancel', sync: open[client.docid] && open[client.docid].length > 1, clientid: client.id }, conn => conn.docid === client.docid);
					client.docid = null;
				}

				if (client.docid !== message.id) {
					if (open[message.id])
						open[message.id].push(client);
					else
						open[message.id] = [client];
					client.docid = message.id;
				}

				var tmp;

				if (message.ismodified) {
					tmp = DB.docs.findItem('id', message.id);
					if (tmp)
						tmp.ismodified = false;
				}

				tmp = DB.docs.findItem('id', client.docid);
				if (tmp)
					tmp.countonline = open[message.id].length;

				tmp = DB.sessions.findItem('id', client.user.sessionid);
				if (tmp)
					tmp.docid = message.id;

				if (open[message.id].length > 1) {
					// Notifies clients
					self.send({ TYPE: 'sync_init', id: message.id, fromclientid: open[message.id][0].id, toclientid: client.id }, client => client.docid === message.id);
				} else
					client.send({ TYPE: 'open', id: message.id });

				break;

			case 'close':

				if (client.docid && open[client.docid]) {

					var index = open[client.docid].indexOf(client);
					if (index !== -1)
						open[client.docid].splice(index, 1);

					var tmp;

					tmp = DB.docs.findItem('id', client.docid);
					if (tmp)
						tmp.countonline = open[client.docid].length;

					tmp = DB.sessions.findItem('id', client.user.sessionid);
					if (tmp)
						tmp.docid = null;

					if (!open[client.docid].length)
						delete open[client.docid];

					self.send({ TYPE: 'sync_cancel', sync: open[client.docid] && open[client.docid].length > 1, clientid: client.id }, conn => conn.docid === client.docid);
					client.docid = null;
				}

				break;

			case 'sync_cursor':
			case 'sync_change':
				message.clientid = client.id;
				message.user = client.user.name;
				self.send(message, conn => conn.docid === client.docid && conn !== client);
				break;

			case 'sync_save':
				self.send({ TYPE: 'sync_save', id: client.docid }, conn => conn.docid === client.docid && conn !== client);
				break;

			case 'sync_done':
				self.send({ TYPE: 'sync_done', id: client.docid }, conn => conn.docid === client.docid);
				break;

			case 'sync_load':
				self.send({ TYPE: 'sync_load', id: client.docid }, client => client.id === message.clientid);
				break;

		}
	});
}