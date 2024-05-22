require('querybuilderpg').init('default', CONF.database, CONF.pooling || 1, ERROR('DB'));

CONF.$customtitles = true;
CONF.version = '1.2';

// UI components
ON('ready', function() {

	// Componentator
	COMPONENTATOR('ui', 'exec,menu,input,columns,idletime,loading,extend,icons,floatingbox,autofill,rawinput,edit,errorhandler,floatinginput,approve,colorpicker,virtualwire,breadcrumb,page,importer,navlayout,viewbox,enter,validate,selection,searchinput,selected,box,tangular-color,tangular-filesize,intranetcss,notify,tabmenu,ready,iframepreview,preview,datepicker,paper,timepicker,dropfiles,locale,empty,miniform,fileuploader,websocket,search,title,aselected,directory,clipboard,nativenotifications,sounds,markdown,clipboardimage,shortcuts,faviconunread,filesaver,info,inlinedatepicker,uibuilder,uistudio,prompt', true);

});

ON('service', function(counter) {
	if (counter % 20 === 0)
		FUNC.reconfigure();
});

async function init() {

	var tables = await DATA.query("SELECT FROM pg_tables WHERE schemaname='public' AND tablename='tbl_ticket' LIMIT 1").promise();

	if (tables.length) {
		FUNC.reconfigure();
		FUNC.refreshtags();
		PAUSESERVER('Database');
		EMIT('start');
		return;
	}

	// DB is empty
	F.Fs.readFile(PATH.root('database.sql'), async function(err, buffer) {

		var data = {};
		data.id = UID();
		data.secret = GUID(10);
		data.password = 'admin'.sha256(data.secret);

		var sql = buffer.toString('utf8').arg(data);

		// Run SQL
		await DATA.query(sql).promise();

		PAUSESERVER('Database');

		FUNC.reconfigure();
		FUNC.refreshtags();
		EMIT('start');
	});

}

PAUSESERVER('Database');

// Docker
if (process.env.DATABASE)
	setTimeout(init, 3000);
else
	init();
