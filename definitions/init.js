require('querybuilderpg').init('default', CONF.database, CONF.pooling || 1, ERROR('DB'));

MAIN.db = MEMORIZE('db');

if (!MAIN.db.config)
	MAIN.db.config = { name: 'TaskMan', minlogtime: 10 };

CONF.allow_custom_titles = true;
CONF.version = '1';
CONF.op_icon = 'ti ti-support';

// Componentator
COMPONENTATOR('ui', 'exec,menu,icons,input,loading,floatingbox,autofill,edit,errorhandler,floatinginput,approve,colorpicker,virtualwire,breadcrumb,page,importer,navlayout,viewbox,enter,selection,validate,selected,searchinput,box,tangular-color,tangular-filesize,intranetcss,notify,ready,tabmenu,iframepreview,preview,datepicker,paper,dropfiles,locale,empty,miniform,fileuploader,websocket,search,title,aselected,directory,clipboard,nativenotifications,sounds,markdown,clipboardimage,shortcuts,faviconunread', true);

// UI components
ON('ready', function() {

	// Loads all paper widgets
	F.Fs.readdir(PATH.public('paper'), function(err, files) {
		var builder = [];
		for (var m of files)
			builder.push(m.substring(0, m.length - 5));
		REPO.paperwidgets = builder.join(',');
	});

	FUNC.reconfigure();
	FUNC.refreshtags();
});