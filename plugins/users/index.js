exports.icon = 'ti ti-users';
exports.name = '@(Users)';
exports.permissions = [{ id: 'users', name: 'Users' }];
exports.visible = user => user.sa || user.permissions.includes('admin') || user.permissions.includes('users');

// Temporary object for users
MAIN.users = [];

async function refresh() {
	var tmp = await DATA.find('tbl_user').fields('id').where('isremoved=FALSE').promise();
	for (let m of tmp) {
		if (m.id !== 'bot')
			MAIN.users.push(m.id);
	}
}

ON('start', refresh);
ON('service', function(counter) {
	if (counter % 10 === 0)
		refresh();
});

NEWACTION('Users', {
	name: 'List of users',
	route: true,
	permissions: 'users',
	action: function($) {
		DATA.find('tbl_user').fields('id,name,email,search,language,photo,isdisabled,sa,isinactive,isonline,is2fa,dtlogged,notifications').where('isremoved=FALSE AND id<>\'bot\'').sort('isinactive').sort('name').callback($);
	}
});

NEWACTION('Users|save', {
	input: 'id:UID,photo:String,language:Lower(2),*email:Email,search:String,password:String,*name:String,isdisabled:Boolean,isinactive:Boolean,is2fa:Boolean,sa:Boolean,notifications:Boolean,reference:String',
	route: true,
	permissions: 'users',
	action: async function($, model) {

		let newbie = !model.id;

		if (newbie) {
			model.id = UID();
			model.permissions = [];
		}
		model.password = model.password ? model.password.sha256(CONF.auth_secret) : undefined;

		if (!model.search)
			model.search = model.name.slug().replace(/-/g, '');

		if (newbie) {
			model.dtcreated = NOW;
			await DATA.insert('tbl_user', model).promise($);
		} else {
			model.dtupdated = NOW;
			await DATA.modify('tbl_user', model).id(model.id).error(404).promise($);
		}

		if (!newbie && model.isinactive) {
			// Remove from all tickets
			// DATA.query('UPDATE tbl_ticket SET userid=ARRAY_REMOVE(userid, \'{0}\') WHERE isremoved=FALSE AND userid && \'{{0}}\'::_text'.format(model.id));
			// DATA.remove('tbl_ticket_bookmark').where('userid', model.id);
			// DATA.remove('tbl_ticket_unread').where('userid', model.id);
			// DATA.remove('tbl_notification').where('userid', model.id);
			await DATA.remove('tbl_session').where('userid', model.id).promise($);
		}

		if (newbie)
			MAIN.users.push(model.id);
		else
			MAIN.session.refresh(model.id);

		$.success(model.id);
	}
});

NEWACTION('Users|read', {
	name: 'Read user',
	input: '*id:UID',
	route: true,
	permissions: 'users',
	action: function($, model) {
		DATA.read('tbl_user').fields('id,language,search,photo,name,email,sa,isdisabled,isinactive,notifications').id(model.id).where('isremoved=FALSE').error(404).callback($);
	}
});

NEWACTION('Users|remove', {
	name: 'Remove user',
	input: '*id',
	route: true,
	permissions: 'users',
	action: function($, model) {
		if (model.id === 'bot')
			$.invalid("@(You can't remove Todomator's bot)");
		else {
			let index = MAIN.users.indexOf(model.id);
			if (index !== -1)
				MAIN.users.splice(index, 1);
			DATA.query('UPDATE tbl_ticket SET userid=ARRAY_REMOVE(userid, \'{0}\') WHERE isremoved=FALSE AND userid && \'{{0}}\'::_text'.format(model.id));
			DATA.modify('tbl_user', { isremoved: true, dtupdated: NOW }).id(model.id).where('isremoved=FALSE').error(404).callback($.done(model.id));
			MAIN.session.refresh(model.id);
		}
	}
});

NEWACTION('Users|login', {
	name: 'Login',
	input: '*email:Email,*password:String,code',
	route: true,
	action: async function($, model) {

		if (BLOCKED($, 10, '10 minutes'))
			return;

		let user = await DATA.read('tbl_user').fields('id,isdisabled,is2fa,code,dtcode').where('email', model.email).where('password', model.password.sha256(CONF.auth_secret)).error('@(Invalid credentials)').where('isinactive=FALSE AND isremoved=FALSE').promise($);

		if (user.isdisabled) {
			$.invalid('@(Account is banned)');
			return;
		}

		if (user.is2fa) {

			if (model.code) {

				if (user.code !== model.code || user.dtcode.add('10 minutes') < NOW) {
					$.invalid('@(Invalid code)');
					return;
				}

				await DATA.modify('tbl_user', { code: null }).id(user.id).promise($);

			} else {
				let code = U.random_number(6);
				let data = { code: code, dtcode: NOW, url: CONF.url };
				await DATA.modify('tbl_user', data).id(user.id).promise($);
				let html = await TEMPLATE('mail-2fa', data, $);
				HTMLMAIL(model.email, '@(2FA code: {0})'.format(data.code), html, $.language);
				$.success('code');
				return;
			}
		}

		BLOCKED($, -1);

		let obj = {};
		obj.id = UID();
		obj.userid = user.id;
		obj.ua = $.ua;
		obj.ip = $.ip;
		obj.device = $.mobile ? 'mobile' : 'desktop';
		obj.dtexpire = NOW.add(CONF.auth_cookie_expire || '1 month');
		obj.dtcreated = NOW;

		await DATA.insert('tbl_session', obj).promise($);
		MAIN.session.authcookie($, obj.id, obj.userid, CONF.auth_cookie_expire);
		$.success();
	}
});

NEWACTION('Users|token', {
	name: 'Login by token',
	input: '*token:String',
	route: true,
	action: async function($, model) {

		if (BLOCKED($, 10, '10 minutes'))
			return;

		let user = await DATA.read('tbl_user').fields('id,isdisabled').where('token', model.token).error('@(Invalid token)').where('isinactive=FALSE AND isremoved=FALSE').promise($);

		if (user.isdisabled) {
			$.invalid('@(Account is banned)');
			return;
		}

		BLOCKED($, -1);

		let obj = {};
		obj.id = UID();
		obj.userid = user.id;
		obj.ua = $.ua;
		obj.ip = $.ip;
		obj.device = $.mobile ? 'mobile' : 'desktop';
		obj.dtexpire = NOW.add(CONF.auth_cookie_expire || '1 month');
		obj.dtcreated = NOW;

		await DATA.insert('tbl_session', obj).promise($);
		await DATA.modify('tbl_user', { token: null }).id(user.id).promise($);

		MAIN.session.authcookie($, obj.id, obj.userid, CONF.auth_cookie_expire);
		$.success();

	}
});

NEWACTION('Users|logout', {
	name: 'Logout user',
	route: '+GET /logout/',
	user: true,
	action: function($) {
		MAIN.session.logout($);
		$.redirect('/');
	}
});

NEWACTION('Users|password', {
	name: 'Change password',
	input: '*password:String,is2fa:Boolean',
	route: true,
	user: true,
	action: async function($, model) {
		await DATA.modify('tbl_user', { is2fa: model.is2fa, password: model.password.sha256(CONF.auth_secret), dtupdated: NOW }).id($.user.id).error(404).promise($);
		$.user.is2fa = model.is2fa;
		$.success();
	}
});