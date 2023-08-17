require('querybuilderpg').init('default', CONF.database, CONF.pooling || 1, ERROR('DB'));

MAIN.db = MEMORIZE('db');

if (!MAIN.db.config)
	MAIN.db.config = { name: 'Todomator', minlogtime: 10 };

CONF.allow_custom_titles = true;
CONF.version = '1';

// UI components
ON('ready', function() {

	// Componentator
	COMPONENTATOR('ui', 'exec,menu,columns,input,extend,loading,icons,floatingbox,autofill,rawinput,edit,errorhandler,floatinginput,approve,colorpicker,virtualwire,breadcrumb,page,importer,navlayout,viewbox,enter,validate,selection,searchinput,selected,box,tangular-color,tangular-filesize,intranetcss,notify,tabmenu,ready,iframepreview,preview,datepicker,paper,timepicker,dropfiles,locale,empty,miniform,fileuploader,websocket,search,title,aselected,directory,clipboard,nativenotifications,sounds,markdown,clipboardimage,shortcuts,faviconunread,filesaver,info,inlinedatepicker', true);

	FUNC.reconfigure();
	FUNC.refreshtags();

});

async function init() {

	var tables = await DATA.query("SELECT FROM pg_tables WHERE schemaname='public' AND tablename='tbl_ticket' LIMIT 1").promise();

	if (tables.length) {
		PAUSESERVER('Database');
		return;
	}

	// DB is empty
	F.Fs.readFile(PATH.root('database.sql'), async function(err, buffer) {

		var data = {};
		data.id = UID();
		data.password = 'admin'.sha256(CONF.auth_secret);

		var sql = buffer.toString('utf8').arg(data);

		// Run SQL
		await DATA.query(sql).promise();

		PAUSESERVER('Database');

	});

}

PAUSESERVER('Database');

// Docker
if (process.env.DATABASE)
	setTimeout(init, 3000);
else
	init();
