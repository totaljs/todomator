const Returning = 'id,ownerid,userid,parentid,reference,folderid,statusid,source,name,estimate,worked,ispriority,isbillable,ispublic,tags,deadline,attachments,dtcreated,dtupdated,dtparent,callback,attrs';

NEWSCHEMA('Tickets', function(schema) {

	function makefilter($, builder) {
		const query = $.query;

		if (query.date) {
			query.date.setHours(0);
			query.date.setMinutes(0);
			query.date.setSeconds(0);
			builder.where('date', query.date);
		}

		query.folderid && builder.where('a.folderid', query.folderid);
		query.notin && builder.notin('a.id', query.notin.split(','));

		switch (query.type) {
			case 'pending':
				builder.where("statusid='pending' AND (isprivate=FALSE OR isprivate IS NULL)" + (query.date || query.date2 ? "" : " AND date<=timezone('utc'::text, now())"));
				break;
			case 'postponed':
				builder.where("statusid='postponed' AND (isprivate=FALSE OR isprivate IS NULL)");
				break;
			case 'review':
				builder.where("statusid='review' AND (isprivate=FALSE OR isprivate IS NULL)");
				break;
			case 'assigned':
				builder.where("statusid IN ('pending','open','review') AND isprivate=FALSE AND NOT ({0}=ANY(a.userid))".format(PG_ESCAPE($.user.id)) + (query.date || query.date2 ? "" : " AND date<=timezone('utc'::text, now())"));
				break;
			case 'note':
				builder.where("statusid='note' AND (isprivate=FALSE OR isprivate IS NULL)");
				break;
			case 'all':
				builder.where('(isprivate=FALSE OR isprivate IS NULL)');
				break;
			case 'bookmarks':
				builder.where('a.id IN (SELECT x.ticketid FROM tbl_ticket_bookmark x WHERE x.userid=\'{0}\')'.format($.user.id));
				break;
			case 'unread':
				builder.where("isunread=TRUE AND date<=timezone('utc'::text, now())");
				break;
			case 'open':
				builder.where("statusid IN ('pending','open') AND (isprivate=FALSE OR isprivate IS NULL)" + (query.date || query.date2 ? "" : " AND date<=timezone('utc'::text, now())"));
				break;
			case 'inprogress':
				builder.where("statusid='open' AND (isprivate=FALSE OR isprivate IS NULL)" + (query.date || query.date2 ? "" : " AND date<=timezone('utc'::text, now())"));
				break;
			default:
				if (!query.folderid)
					builder.where("statusid IN ('pending','open') AND (isprivate=FALSE OR isprivate IS NULL)" + (query.date || query.date2 ? "" : " AND date<=timezone('utc'::text, now())"));
				break;
		}

		if (query.type === 'review' || query.type === 'assigned')
			builder.query('a.ownerid={0}'.format(PG_ESCAPE($.user.id)));
		else if (!$.user.admin || !query.admin)
			builder.query('(a.ispublic=TRUE OR a.ownerid={1} OR a.userid && {0}::_text OR a.watcherid && {0}::_text)'.format(PG_ESCAPE('{' + $.user.id + '}'), PG_ESCAPE($.user.id)));

		var search = query.q;
		if (search) {

			var tags = [];
			var user = '';
			var istag = false;
			var own = false;

			search = search.replace(/#[a-z0-9\-_]+/g, function(text) {
				istag = true;
				let tag = text.substring(1).trim().slug().replace(/-/g, '');
				for (var m of REPO.tags) {
					if (m.search.indexOf(tag) !== -1)
						tags.push(m.id);
				}
				return '';
			}).trim();

			// Returns nothing, any tag not found
			if (istag && !tags.length)
				tags.push('_');

			search = search.replace(/@.*?(\s|$)/g, function(text) {
				let tmp = text.substring(1).trim();
				if (!tmp || tmp === 'my')
					own = true;
				else
					user = '%' + tmp.toSearch() + '%';
				return '';
			}).trim();

			if (own)
				builder.query("('{0}'=ANY(a.userid) AND ARRAY_LENGTH(a.userid,1)=1) OR ('{0}'=ANY(a.userid) AND ownerid<>'{0}')".format($.user.id));

			if (search)
				builder.or(b => b.search('a.search', search.toSearch()).search('a.id', search));

			if (user)
				builder.query('(SELECT ARRAY_TO_STRING(ARRAY_AGG(search), \',\') FROM tbl_user x WHERE x.id=ANY(a.userid)) ILIKE ' + PG_ESCAPE(user));

			if (tags.length) {
				builder.or(function() {
					for (var m of tags)
						builder.where(PG_ESCAPE(m) + '=ANY(a.tags)');
				});
			}
		}
	}

	schema.action('list', {
		name: 'List of tickets',
		query: 'type:String, q:String, folderid:UID, skip:Number, limit:Number, date:Date, admin:Number, notin:String',
		public: true,
		action: async function($) {

			let sql = 'SELECT a.id,a.ispublic,a.reference,a.parentid,a.ownerid,a.userid,a.folderid,a.folder,a.folder_color,a.folder_icon,a.statusid,a.name,a.estimate,a.date,a.dtupdated,a.ispriority,a.attachments,a.deadline,a.tags,a.worked,a.comments,COALESCE(b.isunread, false) AS isunread,b.iscomment,b.dtupdated AS dtunread,a.children FROM view_ticket a LEFT JOIN tbl_ticket_unread b ON b.id=(a.id||\'{0}\')'.format($.user.id);
			let builder = DATA.query(sql);
			let query = $.query;

			builder.where("(a.parentid IS NULL OR (a.parentid IS NOT NULL AND ownerid<>'{0}' AND EXISTS(SELECT 1 FROM view_ticket x WHERE x.id=a.id AND (ownerid='{0}' OR '{0}'=ANY(x.userid) OR '{0}'=ANY(x.watcherid)))))".format($.user.id));
			// builder.where("(a.parentid IS NULL OR (a.ownerid<>'{0}' AND a.parentid IS NOT NULL))".format($.user.id));
			makefilter($, builder);

			if (query.type === 'unread') {
				builder.sort('isunread', true);
				builder.sort('dtupdated', true);
			} else {
				builder.sort('sortindex');
				builder.sort('ispriority', true);
				builder.sort('date', true);
				builder.sort('a.dtcreated', true);
			}

			builder.skip(query.skip || 0);
			builder.take(query.limit || 10);

			let items = await builder.promise($);
			let arr = [];

			for (let item of items) {
				if (item.ownerid === $.user.id && item.children && item.children.length) {
					for (let m of item.children)
						arr.push(PG_ESCAPE(m));
				} else
					item.children = EMPTYARRAY;
			}

			// Read tree structure
			if (arr.length) {

				let children = await DATA.query(sql + ' WHERE a.id IN ({0})'.format(arr.join(','))).promise($);
				// let rem = [];

				for (let item of items) {
					let tmp = item.children;
					if (tmp && tmp.length) {
						item.children = [];
						for (let id of tmp) {
							let subitem = children.findItem('id', id);
							if (subitem)
								item.children.push(subitem);
						}
					}
				}

				// items = items.remove(n => rem.includes(n.id));
			}

			$.callback(items);

		}
	});

	schema.action('calendar', {
		name: 'Count of tickets according dates',
		query: 'type:String, folderid:UID, date:Date, admin:Number',
		public: true,
		action: function($) {
			var date = $.query.date || new Date();
			$.query.date = null;
			$.query.date2 = 1;
			var builder = DATA.query('SELECT COUNT(1)::int4 AS count, a.date FROM view_ticket a LEFT JOIN tbl_ticket_unread b ON b.id=(a.id||\'{0}\') {where} GROUP BY date'.format($.user.id));
			makefilter($, builder);
			date.setHours(12);
			date.setDate(1);
			var a = date.add('-1 month');
			var b = date.add('2 month');
			a.setHours(0);
			a.setMinutes(0);
			a.setSeconds(0);
			b.setHours(0);
			b.setMinutes(0);
			b.setSeconds(0);
			builder.between('a.date', a, b);
			builder.callback($);
		}
	});

	schema.action('read', {
		name: 'Read ticket',
		params: '*id:String',
		public: true,
		action: async function($) {

			var params = $.params;
			var userid = PG_ESCAPE($.user.id);
			var builder = DATA.query('SELECT a.*, b.isunread, b.iscomment FROM view_ticket a LEFT JOIN tbl_ticket_unread b ON b.id=(a.id||{0})'.format(userid));

			builder.where('a.id', params.id);

			if (!$.user.sa || $.user.permissions.includes('admin'))
				builder.query('(a.ispublic=TRUE OR (a.userid && {1}::_text) OR (a.watcherid && {1}::_text) OR ownerid={0})'.format(userid, PG_ESCAPE('{' + $.user.id + '}')));

			builder.first();
			builder.error('@(Ticket not found)');

			var response = await builder.promise($);

			response.linecomments = response.comments ? await DATA.query('SELECT line, COUNT(1)::int2 AS count FROM tbl_ticket_comment WHERE ticketid={0} AND line IS NOT NULL GROUP BY line'.format(PG_ESCAPE(params.id))).promise($) : [];

			$.callback(response);

			if (response.isunread)
				DATA.modify('tbl_ticket_unread', { isunread: false, iscomment: false }).id(params.id + $.user.id);

		}
	});

	schema.action('create', {
		name: 'Create ticket',
		input: '*name:String, parentid:String, statusid:String, note:String, folderid:UID, folder:String, users:[String], userid:[String], watcherid:[String], watcherid:[String], ispriority:Number, isbillable:Boolean, ispublic:Boolean, source:String, tags:[String], html:String, markdown:String, reference:String, date:Date, deadline:Date, worked:Number, attachments:[*name:String, *data:*Base64], callback:String, attrs:Object',
		public: true,
		partial: true,
		action: async function($, model) {

			var keys = Object.keys(model);

			if (model.folder) {
				var folder = await DATA.read('tbl_folder').fields('id,isbillable').search('name', model.folder).error('@(Folder not found)').promise($);
				model.folderid = folder.id;
				if (model.isbillable == null && folder.isbillable)
					model.isbillable = true;
			}

			if (model.attrs)
				model.attrs = JSON.stringify(model.attrs);

			if (model.date) {
				model.date.setHours(0);
				model.date.setMinutes(0);
				model.date.setSeconds(0);
			}

			if (model.users) {
				let userid = [];
				for (let m of model.users) {
					let user = await DATA.read('tbl_user').fields('id').or(b => b.search('name', m).search('email', m)).promise($);
					if (user) {
						userid.push(user.id);
					} else {
						$.error.replace('@', m);
						$.invalid('@(User "@" not found)');
						break;
					}
				}
				model.userid = userid;
			}

			if (model.watchers) {
				let watchers = [];
				for (let m of model.watchers) {
					let user = await DATA.read('tbl_user').fields('id').or(b => b.search('name', m).search('email', m)).promise($);
					if (user) {
						watchers.push(user.id);
					} else {
						$.error.replace('@', m);
						$.invalid('@(User "@" not found)');
						break;
					}
				}
				model.watcherid = watchers;
			}

			model.users = undefined;
			model.watchers = undefined;
			model.folder = undefined;

			NOW = new Date();

			model.id = UID();
			model.ownerid = $.user.id;

			if (!model.userid)
				model.userid = [];

			if (model.ispublic && model.userid.length)
				model.userid = [];

			if (!model.statusid)
				model.statusid = 'pending';

			model.search = model.name.toSearch();

			keys.unshift('id');

			if (!model.folderid)
				model.folderid = null;

			if (!model.date)
				model.date = NOW;

			keys.push('date');

			if (!model.tags)
				model.tags = [];

			if (model.attachments && model.attachments.length) {
				var attachments = [];
				var arr = model.attachments;
				var fs = FILESTORAGE('attachments');

				for (var m of arr) {
					try {
						var file = await fs.save(UID(), m.name, m.data.base64ToBuffer());
						file.url = '/download/' + file.id.sign(CONF.salt) + '.' + file.ext;
						file.dtcreated = NOW;
						attachments.push(file);
					} catch (e) {
						// unhandled error
						console.log(e);
					}
				}

				model.attachments = JSON.stringify(attachments);

			} else
				model.attachments = '[]';

			var response = await DATA.insert('tbl_ticket', model).returning(Returning).promise($);

			if (model.worked) {
				var logwork = {};
				logwork.id = UID();
				logwork.ticketid = model.id;
				logwork.userid = $.user.id;
				logwork.minutes = model.worked;
				logwork.date = NOW;
				logwork.dtcreated = NOW;
				await DATA.insert('tbl_ticket_time', logwork).promise($);
			}

			var filter = client => response.ispublic || response.ownerid === client.user.id || response.userid.includes(client.user.id);

			if (response.userid.length) {
				var users = await DATA.find('tbl_user').fields('id,name').in('id', response.userid).promise($);
				for (let m of response.userid) {
					let user = users.findItem('id', m);
					if (user && user.id !== $.user.id) {
						await FUNC.notify(response.id, m, 'user', $.user.name, user.name);
						if (m !== $.user.id)
							await FUNC.unread(response.id, m, 'user', user.name);
					}
				}
			}

			MAIN.ws && MAIN.ws.send({ TYPE: 'refresh', id: model.id  }, filter);

			response.type = 'create';
			EMIT('ticket', response);

			$.success(model.id);

			if (response.callback)
				TicketCallback(response, keys);

		}
	});

	schema.action('update', {
		name: 'Update ticket',
		input: 'userid:[String], watcherid:[String], *folderid:UID, note:String, *statusid:String, ownerid:String, *name:String, reference:String, estimate:Number, ispriority:Number, isbillable:Boolean, ispublic:Boolean, tags:[String], deadline:Date, attachments:[Object], date:Date, html:String, markdown:String, callback:String, attrs:Object',
		params: '*id:String',
		partial: true,
		public: true,
		action: async function($, model) {

			var params = $.params;
			var keys = Object.keys(model);
			var clientid = $.query.clientid || $.headers['x-clientid'];

			model.changed = 'metadata';
			model.dtupdated = NOW;

			if (model.attrs != null)
				model.attrs = JSON.stringify(model.attrs);

			if (model.name)
				model.search = model.name.toSearch();

			if (model.attachments)
				model.attachments = JSON.stringify(model.attachments);

			if (model.statusid) {
				model.dtstatus = NOW;
				if (model.statusid === 'closed')
					model.ispriority = 0;
			}

			var userid = null;
			var ticket = await DATA.read('tbl_ticket').fields('userid').id(params.id).where('isremoved=FALSE').error(404).promise($);

			if (model.ispublic)
				model.userid = [];
			else if (model.userid) {
				model.changed = 'user';
				userid = ticket.userid;
			} else if (model.statusid)
				model.changed = 'status';

			model.isprocessed = false;

			var response = await DATA.modify('tbl_ticket', model).error(404).id(params.id).where('isremoved=FALSE').returning(Returning).first().promise($);

			if (CONF.backup && model.markdown != null)
				DATA.insert('tbl_ticket_backup', { id: UID(), ticketid: params.id, userid: $.user.id, markdown: model.markdown, ip: $.ip, ua: $.ua });

			if (model.ispublic == null && model.userid) {
				var newbie = [];
				for (let m of model.userid) {
					if (!userid.includes(m))
						newbie.push(m);
				}
				if (newbie.length) {
					var users = await DATA.find('tbl_user').fields('id,name').in('id', newbie).promise($);
					for (let n of newbie) {
						let user = users.findItem('id', n);
						if (user) {
							await FUNC.notify(response.id, $.user.id, 'user', $.user.name, user.name);
							if (user.id !== $.user.id)
								await FUNC.unread(response.id, user.id, 'user', user.name);
						}
					}
				}
			} else if (model.statusid) {

				await FUNC.notify(response.id, response.ownerid, 'status', $.user.name, model.statusid);

				if (response.ownerid && response.ownerid !== $.user.id)
					await FUNC.unread(response.id, response.ownerid, 'status', model.statusid);

			} else if (response.ownerid === $.user.id) {
				await FUNC.notify(response.id, $.user.id, 'metadata', $.user.name, keys.join(','));
				for (let m of response.userid) {
					if (m !== $.user.id)
						await FUNC.unread(response.id, m, 'metadata', keys.join(','));
				}
			}

			if (response.userid && response.userid.length) {
				let notin = response.userid.slice(0);
				notin.push(response.ownerid);
				DATA.remove('tbl_ticket_unread').where('ticketid', params.id).notin('userid', notin);
			}

			var filter = client => response.ispublic || response.ownerid === client.user.id || response.userid.includes(client.user.id);

			MAIN.ws && MAIN.ws.send({ TYPE: 'refresh', id: params.id, markdown: model.markdown, clientid: clientid }, filter);

			response.type = 'udpate';
			EMIT('ticket', response);

			$.success(params.id);

			if (response.callback)
				TicketCallback(response, keys);

		}
	});

	schema.action('markdown', {
		name: 'Reads ticket markdown',
		params: '*id:String',
		public: true,
		action: function($) {
			var params = $.params;
			DATA.read('tbl_ticket').fields('markdown').id(params.id).error(404).callback($);
		}
	});

	schema.action('clone', {
		name: 'Clone ticket',
		params: '*id:String',
		input: 'name:String,folderid:UID,*date:Date,users:Boolean,status:Boolean',
		public: true,
		action: async function($, model) {

			var params = $.params;
			var item = await DATA.read('tbl_ticket').id(params.id).where('isremoved=FALSE').error(404).promise($);

			NOW = new Date();

			item.id = UID();

			if (item.deadline) {
				var diff = item.deadline - item.date;
				item.deadline = diff > 0 ? item.date.add(Math.round(diff / 1000 / 60 / 60 / 24) + ' days') : null;
			}

			item.search = item.name.toSearch();
			item.date = model.date || NOW;
			item.dtcreated = NOW;
			item.dtupdated = null;
			item.worked = 0;
			item.comments = 0;

			if (model.name)
				item.name = model.name;
			else
				item.name += ' (CLONED)';

			if (model.folderid)
				item.folderid = model.folderid;

			item.ownerid = $.user.id;
			item.isprocessed = false;

			if (!model.status)
				item.statusid = 'pending';

			if (!model.users)
				item.userid = [];

			var response = await DATA.insert('tbl_ticket', item).returning(Returning).promise($);
			var filter = client => response.ispublic || response.ownerid === client.user.id || response.userid.includes(client.user.id);

			if (response.ispublic)
				response.userid = MAIN.users;

			for (var m of response.userid) {
				if (m !== $.user.id)
					await FUNC.unread(response.id, m, 'user');
			}

			MAIN.ws && MAIN.ws.send({ TYPE: 'refresh', id: item.id }, filter);

			response.type = 'clone';
			EMIT('ticket', response);

			$.success(item.id);

			if (response.callback)
				TicketCallback(response);
		}
	});

	schema.action('logs', {
		name: 'Ticket logs',
		params: '*id:String',
		public: true,
		action: function($) {
			var params = $.params;
			DATA.find('view_ticket_time').fields('id,userid,user_name,name,date,minutes').where('ticketid', params.id).where('start IS NULL').sort('date', true).callback($);
		}
	});

	schema.action('remove', {
		name: 'Remove ticket',
		params: '*id:String',
		public: true,
		action: function($) {

			if (UNAUTHORIZED($, 'tickets_remove', 'admin'))
				return;

			var params = $.params;
			DATA.modify('tbl_ticket', { isremoved: true, dtremoved: NOW }).id(params.id).error(404).callback($.done(params.id));
			DATA.remove('tbl_ticket_unread').where('ticketid', params.id);
			DATA.remove('tbl_ticket_bookmark').where('ticketid', params.id);
			DATA.remove('tbl_notification').where('ticketid', params.id);

			var obj = {};
			obj.id = params.id;
			obj.type = 'remove';
			EMIT('ticket', obj);
		}
	});

	schema.action('logwork_start', {
		name: 'Start logwork timer',
		input: '*ticketid,name',
		action: async function($, model) {

			var ticket = await DATA.read('tbl_ticket').fields('statusid').id(model.ticketid).where('isremoved=FALSE').error(404).promise($);
			if (ticket.statusid === 'pending') {
				// change status to "open"
				await $.action('Tickets/update', { statusid: 'open' }).params({ id: model.ticketid }).user($.user).promise($);
			}

			NOW = new Date();
			model.id = UID();
			model.userid = $.user.id;
			model.dtcreated = NOW;
			model.date = NOW;
			model.start = NOW;

			await DATA.insert('tbl_ticket_time', model).promise($);
			$.success(model.id);
		}
	});

	schema.action('logwork_open', {
		name: 'Open timers',
		action: function($) {
			DATA.query('SELECT a.id, a.ticketid, b.name, a.start, a.name AS note FROM tbl_ticket_time a LEFT JOIN tbl_ticket b ON b.id=a.ticketid WHERE a.userid=\'{0}\' AND start IS NOT NULL ORDER BY a.start'.format($.user.id)).callback($);
		}
	});

	schema.action('logwork_stop', {
		name: 'Stop logwork timer',
		input: '*id:String,name',
		action: async function($, model) {

			var item = await DATA.read('tbl_ticket_time').fields('ticketid,start').id(model.id).where('userid', $.user.id).where('start IS NOT NULL').error('@(Timer not found)').promise($);
			var diff = Math.ceil((Date.now() - item.start) / 1000 / 60);
			var limit = 60 * 8; // Max. 8 hours

			if (diff > limit)
				diff = limit;

			if (diff < CONF.minlogtime)
				diff = CONF.minlogtime;

			await DATA.modify('tbl_ticket_time', { '+minutes': diff, start: null, name: model.name }).id(model.id).promise($);
			await DATA.modify('tbl_ticket', { '+worked': diff }).id(item.ticketid).promise($);

			var ticket = await DATA.read('tbl_ticket').fields('id,ownerid,userid,worked,ispublic').id(item.ticketid).promise($);
			$.callback({ id: item.ticketid, worked: ticket.worked });

			if (ticket.ispublic)
				ticket.userid = MAIN.users;

			FUNC.notify(item.ticketid, $.user.id, 'logwork', $.user.name, diff + '');

			var filter = client => ticket.ispublic || ticket.ownerid === client.user.id || ticket.userid.includes(client.user.id);
			MAIN.ws && MAIN.ws.send({ TYPE: 'refresh', id: ticket.id }, filter);

		}
	});

	schema.action('logwork_create', {
		name: 'Logwork',
		input: '*ticketid:String, *minutes:Number, name:String, *date:Date',
		public: true,
		action: async function($, model) {

			model.id = UID();
			model.userid = $.user.id;
			model.dtcreated = NOW;

			if (model.minutes < CONF.minlogtime)
				model.minutes = CONF.minlogtime;

			await DATA.modify('tbl_ticket', { '+worked': model.minutes }).id(model.ticketid).error('@(Ticket not found)').promise($);
			await DATA.insert('tbl_ticket_time', model).promise($);

			var ticket = await DATA.read('tbl_ticket').fields('id,userid,worked,ispublic,ownerid').id(model.ticketid).promise($);
			$.success(ticket.worked);

			if (ticket.ispublic)
				ticket.userid = MAIN.users;

			FUNC.notify(model.ticketid, $.user.id, 'logwork', $.user.name, model.minutes + '', model.id);

			var filter = client => ticket.ispublic || ticket.ownerid === client.user.id || ticket.userid.includes(client.user.id);
			MAIN.ws && MAIN.ws.send({ TYPE: 'refresh', id: ticket.id }, filter);

		}
	});

	schema.action('logwork_update', {
		name: 'Update time',
		input: '*minutes:Number, name:String, *date:Date',
		params: '*id:String',
		action: async function($, model) {

			var params = $.params;

			if (model.minutes < CONF.minlogtime)
				model.minutes = CONF.minlogtime;

			var response = await DATA.modify('tbl_ticket_time', model).id(params.id).error('@(Log not found)').returning('ticketid').first().promise($);
			await DATA.query('UPDATE tbl_ticket a SET worked=(SELECT SUM(x.minutes) FROM tbl_ticket_time x WHERE x.ticketid=a.id) WHERE a.id=' + PG_ESCAPE(response.ticketid));
			var ticket = await DATA.read('tbl_ticket').fields('id,ownerid,userid,worked,ispublic').id(response.ticketid).promise($);
			$.success(ticket.worked);

			DATA.modify('tbl_notification', { value: model.minutes + '' }).where('ticketid', response.ticketid).where('reference', params.id).where('typeid', 'logwork');
			FUNC.notify(model.ticketid, $.user.id, 'logwork', $.user.name, model.minutes + '', model.id);

			var filter = client => ticket.ispublic || ticket.ownerid === client.user.id || ticket.userid.includes(client.user.id);
			MAIN.ws && MAIN.ws.send({ TYPE: 'refresh', id: ticket.id }, filter);
		}
	});

	schema.action('logwork_remove', {
		name: 'Remove time',
		params: '*id:String',
		action: async function($) {
			var params = $.params;
			var response = await DATA.remove('tbl_ticket_time').id(params.id).error('@(Log not found)').returning('ticketid').first().promise($);
			await DATA.query('UPDATE tbl_ticket a SET worked=(SELECT SUM(x.minutes) FROM tbl_ticket_time x WHERE x.ticketid=a.id) WHERE a.id=' + PG_ESCAPE(response.ticketid));
			var ticket = await DATA.read('tbl_ticket').fields('id,ownerid,userid,worked,ispublic').id(response.ticketid).promise($);

			$.success(ticket.worked);
			DATA.remove('tbl_notification').where('ticketid', response.ticketid).where('reference', params.id).where('typeid', 'logwork');

			var filter = client => ticket.ispublic || ticket.ownerid === client.user.id || ticket.userid.includes(client.user.id);
			MAIN.ws && MAIN.ws.send({ TYPE: 'refresh', id: ticket.id }, filter);
		}
	});

	schema.action('history', {
		name: 'Read all notifications + set unread to read',
		params: '*id:String',
		action: async function($) {

			var params = $.params;
			var items = await DATA.find('tbl_notification').fields('id,typeid,createdby,value,dtcreated').where('ticketid', params.id).sort('dtcreated', true).promise($);
			var pk = params.id + $.user.id;
			var unread = await DATA.read('tbl_ticket_unread').id(pk).fields('notificationid').promise($);

			if (items.length && unread && unread.notificationid !== items[0].id) {

				var noid = unread.notificationid;

				for (var m of items) {
					if (noid && m.id === noid)
						break;
					else
						m.isunread = true;
				}

				if (unread.notificationid !== items[0].id)
					await DATA.modify('tbl_ticket_unread', { notificationid: items[0].id }).id(pk).promise();
			}

			$.callback(items);
		}
	});

	schema.action('bookmark', {
		name: 'Toggle bookmark',
		params: '*id:String',
		input: 'type:{create|remove|check}',
		action: async function($, model) {
			var params = $.params;
			var id = params.id + $.user.id;
			var bookmark = await DATA.read('tbl_ticket_bookmark').id(id).promise($);
			var output = {};

			switch (model.type) {
				case 'create':
					if (!bookmark)
						await DATA.insert('tbl_ticket_bookmark', { id: id, ticketid: params.id, userid: $.user.id }).promise($);
					output.is = true;
					break;
				case 'remove':
					if (bookmark)
						await DATA.remove('tbl_ticket_bookmark').id(id).promise($);
					output.is = false;
					break;
				default:
					output.is = bookmark ? true : false;
					break;
			}

			$.callback(output);
		}
	});

	schema.action('unread', {
		name: 'Unread counter',
		action: function($) {
			DATA.count('tbl_ticket_unread').where('userid', $.user.id).where('isunread=TRUE AND EXISTS(SELECT 1 FROM tbl_ticket x WHERE x.isremoved=FALSE AND x.id=tbl_ticket_unread.id AND x.date<=timezone(\'utc\'::text, now()))').callback($);
		}
	});

	schema.action('reset', {
		name: 'Reset unread state',
		params: '*id:String',
		action: function($) {

			var params = $.params;
			var builder = DATA.modify('tbl_ticket_unread', { isunread: false });

			if (params.id !== 'all') {
				builder.id(params.id + $.user.id);
				builder.error(404);
			} else
				builder.where('userid', $.user.id);

			builder.callback($.done(params.id));
		}
	});

	schema.action('counter', {
		name: 'Get counts from tickets',
		action: function($) {
			var builder = 'SELECT ';
			builder += '(SELECT COUNT(1)::int4 FROM tbl_ticket_unread a INNER JOIN tbl_ticket b ON b.id=a.ticketid AND b.isremoved=FALSE AND b.date<=timezone(\'utc\'::text, now()) WHERE a.userid={0} AND a.isunread=TRUE) AS unread,';
			builder += '(SELECT COUNT(1)::int4 FROM tbl_ticket WHERE statusid=\'review\' AND ownerid={0} AND isremoved=FALSE) AS review,';
			builder += '(SELECT COUNT(1)::int4 FROM tbl_ticket WHERE statusid=\'pending\' AND (ispublic=TRUE OR ownerid={0} OR {0}=ANY(userid)) AND isremoved=FALSE AND date<=timezone(\'utc\'::text, now()) AND folderid IN (SELECT x.id FROM tbl_folder x WHERE x.isprivate=FALSE AND x.isarchived=FALSE)) AS pending,';
			builder += '(SELECT COUNT(1)::int4 FROM tbl_ticket WHERE statusid=\'open\' AND (ispublic=TRUE OR ownerid={0} OR {0}=ANY(userid)) AND isremoved=FALSE AND date<=timezone(\'utc\'::text, now()) AND folderid IN (SELECT x.id FROM tbl_folder x WHERE x.isprivate=FALSE AND x.isarchived=FALSE)) AS open,';
			builder += '(SELECT COUNT(1)::int4 FROM tbl_ticket WHERE ({0}=ANY(userid) OR ownerid={0} OR {0}=ANY(watcherid)) AND isremoved=FALSE AND id IN (SELECT x.ticketid FROM tbl_ticket_bookmark x WHERE x.userid={0})) AS bookmarks';
			DATA.query(builder.format(PG_ESCAPE($.user.id))).first().callback($);
		}
	});

	schema.action('link', {
		name: 'Link with another ticket',
		input: '*ticketid:String, *type:{add|rem}',
		params: '*id:String',
		action: async function($, model) {

			var params = $.params;

			if (params.id === model.ticketid && model.type === 'add') {
				$.invalid("@(The ticket can't be assigned to itself)");
				return;
			}

			var ticket = await DATA.read('tbl_ticket').fields('ispublic,userid,ownerid').id(params.id).error('@(Ticket not found)').promise($);

			if (model.type === 'add') {
				await DATA.modify('tbl_ticket', { parentid: params.id, dtparent: NOW }).id(model.ticketid).promise($);
			} else {
				await DATA.modify('tbl_ticket', { parentid: null, dtparent: null }).id(model.ticketid).promise($);
			}

			var filter = client => ticket.ispublic || ticket.ownerid === client.user.id || ticket.userid.includes(client.user.id);
			MAIN.ws && MAIN.ws.send({ TYPE: 'refresh', id: params.id }, filter);
			$.success();

		}
	});

	schema.action('links', {
		name: 'Links list',
		params: '*id:String',
		action: async function($) {

			var fields = 'id,name,statusid,userid,dtparent,worked';
			var params = $.params;
			var item = await DATA.read('tbl_ticket').fields('parentid').id(params.id).where('isremoved=FALSE').error(404).promise($);
			var response = await DATA.find('tbl_ticket').fields(fields).where('parentid', params.id).sort('dtparent').where('isremoved=FALSE').promise($);

			if (item.parentid) {
				var parent = await DATA.read('tbl_ticket').fields(fields).id(item.parentid).promise($);
				parent.type = 'child';
				response.push(parent);
			}

			$.callback(response);

		}
	});

	schema.action('find', {
		name: 'Find tickets according identifiers',
		query: '*id:String',
		action: function($) {
			var fields = 'id,name,folderid,statusid,userid,worked,ownerid,dtcreated';
			DATA.find('tbl_ticket').fields(fields).in('id', $.query.id.split(',')).where('isremoved=FALSE').sort('dtcreated', true).callback($);
		}
	});

	schema.action('comments', {
		name: 'List of comments',
		params: '*id:String',
		public: true,
		query: 'line:Number',
		action: function($) {
			var params = $.params;
			var query = $.query;
			var builder = DATA.find('tbl_ticket_comment');
			builder.fields('id,userid,username,userphoto,markdown,dtcreated,dtupdated');
			builder.where('ticketid', params.id);
			builder.sort('dtcreated');

			if (query.line != null)
				builder.where('line', query.line);

			builder.callback($);
		}
	});

	var updatecommentscount = function(id) {
		DATA.query('UPDATE tbl_ticket a SET comments=(SELECT COUNT(1) FROM tbl_ticket_comment x WHERE x.ticketid=a.id) WHERE a.id=' + PG_ESCAPE(id));
	};

	schema.action('comments_create', {
		name: 'Create comment',
		input: '*ticketid:String,line:Number,*markdown:String',
		public: true,
		action: async function($, model) {

			var item = await DATA.read('tbl_ticket').fields(Returning).id(model.ticketid).error(404).promise($);

			model.id = UID();
			model.userid = $.user.id;
			model.username = $.user.name;
			model.userphoto = $.user.photo;
			model.dtcreated = NOW = new Date();

			await DATA.insert('tbl_ticket_comment', model).promise($);
			updatecommentscount(model.ticketid);

			if (item.ispublic)
				item.userid = MAIN.users;

			await FUNC.notify(model.ticketid, m, 'comment', $.user.name, model.markdown.max(50), model.id);

			for (var m of item.userid)
				await FUNC.unread(model.ticketid, m, 'comment', null, m !== $.user.id);

			item.type = 'comment';
			EMIT('ticket', item);

			MAIN.ws && MAIN.ws.send({ TYPE: 'comment', id: model.ticketid });

			$.success(model.id);

			if (item.callback)
				TicketCallback(item);

		}
	});

	schema.action('comments_update', {
		name: 'Update comment',
		input: '*markdown:String',
		params: '*id:String',
		action: async function($, model) {

			var params = $.params;
			var item = await DATA.read('tbl_ticket_comment').id(params.id).where('userid', $.user.id).error(404).promise($);

			model.username = $.user.name;
			model.userphoto = $.user.photo;
			model.ticketid = undefined;
			model.dtupdated = NOW;

			await DATA.modify('tbl_ticket_comment', model).id(params.id).promise($);

			var filter = client => item.ownerid === client.user.id || item.userid.includes(client.user.id);
			MAIN.ws && MAIN.ws.send({ TYPE: 'comment', id: params.id }, filter);

			$.success(params.id);
		}
	});

	schema.action('comments_remove', {
		name: 'Remove comment',
		params: '*id:String',
		action: async function($) {
			var params = $.params;
			var comment = await DATA.remove('tbl_ticket_comment').id(params.id).where('userid', $.user.id).returning('ticketid').error(404).promise($);
			updatecommentscount(comment[0].ticketid);
			$.success(params.id);
		}
	});

});

function TicketCallback(data, keys) {
	data.keys = keys;
	RESTBuilder.POST(data.callback, data).callback(NOOP);
}