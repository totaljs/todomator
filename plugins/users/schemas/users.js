NEWSCHEMA('Users', function(schema) {

	// Temporary object for users
	MAIN.users = [];

	(async function() {
		var tmp = await DATA.find('tbl_user').fields('id').where('isremoved=FALSE').promise();
		for (let m of tmp) {
			if (m.id !== 'bot')
				MAIN.users.push(m.id);
		}
	})();

	schema.action('list', {
		name: 'List of users',
		permissions: 'users',
		action: function($) {
			DATA.find('tbl_user').fields('id,name,email,language,photo,isdisabled,sa,isonline,dtlogged,notifications').where('isremoved=FALSE AND id<>\'bot\'').sort('name').callback($);
		}
	});

	schema.action('create', {
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

	schema.action('update', {
		name: 'Update user',
		params: '*id:UID',
		input: 'photo:String, language:Lower(2), *email:Email, password:String, *name:String, sa:Boolean, isdisabled:Boolean, notifications:Boolean, reference:String',
		permissions: 'users',
		action: function($, model) {
			var params = $.params;
			if (model.password)
				model.password = model.password.sha256(CONF.auth_secret);
			model.search = model.name.toSearch().replace(/\s/g, '');
			model.dtupdated = NOW;
			MAIN.session.refresh(params.id);
			DATA.modify('tbl_user', model).id(params.id).where('isremoved=FALSE').error(404).callback($.done(params.id));
		}
	});

	schema.action('read', {
		name: 'Read user',
		params: '*id:UID',
		permissions: 'users',
		action: function($, model) {
			var params = $.params;
			DATA.read('tbl_user', model).fields('id,language,photo,name,email,sa,isdisabled,notifications').id(params.id).where('isremoved=FALSE').error(404).callback($);
		}
	});

	schema.action('remove', {
		name: 'Remove user',
		params: '*id:UID',
		permissions: 'users',
		action: function($) {
			var params = $.params;
			if (params.id === 'bot')
				$.invalid("@(You can't remove HelpDesk bot)");
			else {
				var index = MAIN.users.indexOf(params.id);
				if (index !== -1)
					MAIN.users.splice(index, 1);
				DATA.modify('tbl_user', { isremoved: true, dtupdated: NOW }).id(params.id).where('isremoved=FALSE').error(404).callback($.done(params.id));
				MAIN.session.refresh(params.id);
			}
		}
	});

	schema.action('login', {
		name: 'Login',
		input: '*email:Email,*password:String',
		action: async function($, model) {

			var user = await DATA.read('tbl_user').fields('id,isdisabled').where('email', model.email).where('password', model.password.sha256(CONF.auth_secret)).error('@(Invalid credentials)').where('isremoved=FALSE').promise($);

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

	schema.action('token', {
		name: 'Login by token',
		query: '*token:String',
		action: async function($) {

			var user = await DATA.read('tbl_user').fields('id,isdisabled').where('token', $.query.token).error('@(Invalid token)').where('isremoved=FALSE').promise($);

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

	schema.action('logout', {
		name: 'Logout user',
		action: function($) {
			MAIN.session.logout($);
			$.redirect('/');
		}
	});

	schema.action('password', {
		name: 'Change password',
		input: '*password:String',
		action: function($, model) {
			DATA.modify('tbl_user', { password: model.password.sha256(CONF.auth_secret), dtupdated: NOW }).id($.user.id).error(404).callback($);
		}
	});

});