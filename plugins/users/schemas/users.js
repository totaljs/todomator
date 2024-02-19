// Temporary object for users
MAIN.users = [];

(async function() {
	var tmp = await DATA.find('tbl_user').fields('id').where('isremoved=FALSE').promise();
	for (let m of tmp) {
		if (m.id !== 'bot')
			MAIN.users.push(m.id);
	}
})();

NEWACTION('Users/list', {
	name: 'List of users',
	permissions: 'users',
	action: function($) {
		DATA.find('tbl_user').fields('id,name,email,language,photo,isdisabled,sa,isinactive,isonline,dtlogged,notifications').where('isremoved=FALSE AND id<>\'bot\'').sort('isinactive').sort('name').callback($);
	}
});

NEWACTION('Users/create', {
	name: 'Create user',
	input: 'photo:String, language:Lower(2), *email:Email, password:String, *name:String, isdisabled:Boolean, sa:Boolean, notifications:Boolean, reference:String',
	permissions: 'users',
	action: function($, model) {
		model.id = UID();
		model.permissions = [];
		model.password = model.password ? model.password.sha256(CONF.auth_secret) : null;
		model.search = model.name.toSearch().replace(/\s/g, '');
		DATA.insert('tbl_user', model).callback($.done(model.id));
		MAIN.users.push(model.id);
	}
});

NEWACTION('Users/update', {
	name: 'Update user',
	params: '*id:UID',
	input: 'photo:String, language:Lower(2), *email:Email, password:String, *name:String, sa:Boolean, isdisabled:Boolean, isinactive:Boolean, notifications:Boolean, reference:String',
	permissions: 'users',
	action: async function($, model) {

		var params = $.params;

		model.password = model.password ? model.password.sha256(CONF.auth_secret) : undefined;
		model.search = model.name.toSearch().replace(/\s/g, '');
		model.dtupdated = NOW;

		await DATA.modify('tbl_user', model).id(params.id).where('isremoved=FALSE').error(404).callback($);

		MAIN.session.refresh(params.id);
		$.success(params.id);

		if (model.isinactive) {
			// Remove from all tickets
			DATA.query('UPDATE tbl_ticket SET userid=ARRAY_REMOVE(userid, \'{0}\') WHERE isremoved=FALSE AND userid && \'{{0}}\'::_text'.format(params.id));
			DATA.remove('tbl_ticket_bookmark').where('userid', params.id);
			DATA.remove('tbl_ticket_unread').where('userid', params.id);
			DATA.remove('tbl_notification').where('userid', params.id);
			DATA.remove('tbl_session').where('userid', params.id);
		}

	}
});

NEWACTION('Users/read', {
	name: 'Read user',
	params: '*id:UID',
	permissions: 'users',
	action: function($, model) {
		var params = $.params;
		DATA.read('tbl_user', model).fields('id,language,photo,name,email,sa,isdisabled,isinactive,notifications').id(params.id).where('isremoved=FALSE').error(404).callback($);
	}
});

NEWACTION('Users/remove', {
	name: 'Remove user',
	params: '*id:UID',
	permissions: 'users',
	action: function($) {
		var params = $.params;
		if (params.id === 'bot')
			$.invalid("@(You can't remove Todomator's bot)");
		else {
			var index = MAIN.users.indexOf(params.id);
			if (index !== -1)
				MAIN.users.splice(index, 1);
			DATA.modify('tbl_user', { isremoved: true, dtupdated: NOW }).id(params.id).where('isremoved=FALSE').error(404).callback($.done(params.id));
			MAIN.session.refresh(params.id);
		}
	}
});

NEWACTION('Users/login', {
	name: 'Login',
	input: '*email:Email,*password:String',
	action: async function($, model) {

		var user = await DATA.read('tbl_user').fields('id,isdisabled').where('email', model.email).where('password', model.password.sha256(CONF.auth_secret)).error('@(Invalid credentials)').where('isinactive=FALSE AND isremoved=FALSE').promise($);

		if (user.isdisabled) {
			$.invalid('@(Account is banned)');
			return;
		}

		var obj = {};
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

NEWACTION('Users/token', {
	name: 'Login by token',
	query: '*token:String',
	action: async function($) {

		var user = await DATA.read('tbl_user').fields('id,isdisabled').where('token', $.query.token).error('@(Invalid token)').where('isinactive=FALSE AND isremoved=FALSE').promise($);

		if (user.isdisabled) {
			$.invalid('@(Account is banned)');
			return;
		}

		var obj = {};
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

NEWACTION('Users/logout', {
	name: 'Logout user',
	action: function($) {
		MAIN.session.logout($);
		$.redirect('/');
	}
});

NEWACTION('Users/password', {
	name: 'Change password',
	input: '*password:String',
	action: function($, model) {
		DATA.modify('tbl_user', { password: model.password.sha256(CONF.auth_secret), dtupdated: NOW }).id($.user.id).error(404).callback($);
	}
});