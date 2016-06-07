var express=require('express');
var credentials=require('./credentials.js')
var nodemailer=require('nodemailer');
var http=require('http');
var fs=require('fs');

var mailTransport=nodemailer.createTransport('SMTP', {
	service: 'Gmail',
	auth: {
		user: credentials.gmail.user,
		pass: credentials.gmail.password
	}
})

var app=express();

var handlebars=require('express3-handlebars').create({
	defaultLayout:'main',
	helpers: {
		section: function(name, options){
			if(!this._sections) this._sections={};
			this._sections[name]=options.fn(this);
			return null;
		}
	}
});
app.engine('handlebars', handlebars.engine);
app.set('view engine', 'handlebars');

var formidable=require('formidable');
var jqupload=require('jquery-file-upload-middleware');
var fortune=require("./lib/fortune.js");

function getWeatherData(){
	return {
		locations: [
			{
				name: 'portland',
				forecastUrl:'http://www.wunderground.com/US/OR/Portland.html',
				iconUrl: 'http://icons-ak.wxug.com/i/c/k/cloudy.gif',
				weather: 'Overcast',
				temp: '54.1 F (12.3 C)'
			},
			{
				name: 'Bend',
				forecastUrl:'http://www.wunderground.com/US/OR/Bend.html',
				iconUrl: 'http://icons-ak.wxug.com/i/c/k/partlycloudy.gif',
				weather: 'Partly Cloudy',
				temp: '55.0 F (12.8 C)'
			},
			{
				name: 'Manzanita',
				forecastUrl:'http://www.wunderground.com/US/OR/Manzanita.html',
				iconUrl: 'http://icons-ak.wxug.com/i/c/k/rain.gif',
				weather: 'LightRain',
				temp: '55.0 F (12.8 C)'
			}
		]
	};
};

app.set('port', process.env.PORT || 3000);

app.use(function(req, res, next){
	//为这个请求创建一个域
	var domain=require('domain').create();
	//处理这个域中的错误
	domain.on('error', function(err){
		console.log('DOMAIN ERROR CAUGHT\n', err.stack);
		try{
			//在5秒内进行故障保护关机
			setTimeout(function(){
				console.error('Failsafe shutdown.');
				process.exit(1);
			}, 5000);
			
			//从集群中断开
			var worker=require('cluster').worker;
			if(worker) worker.disconnect();
			
			//停止接收新请求
			server.close();
			
			try{
				//尝试使用Express错误路由
				next(err);
			}catch(err){
				//如果Express错误路由失效，尝试返回普通文本相应
				console.error('Express error mechanism failed.\n', err.stack);
				res.statusCode=500;
				res.setHeader('content-type', 'text/plain');
				res.end('Server error');
			}
		}catch(err){
			console.log('Unable to send 500 response.\n', err.stack);
		}
	});
	
	//向域中添加请求和响应对象
	domain.add(req);
	domain.add(res);
	
	//执行该域中剩余的请求链
	domain.run(next);
});

app.use(express.static(__dirname+'/public'));

app.use(function(req, res, next){
	res.locals.showTests=app.get('env') !== 'production' && req.query.test === '1';
	next();
});

app.use(require('body-parser')());
app.use(require('cookie-parser')(credentials.cookieSecret));
app.use(require('express-session')());

app.use(function(req, res, next){
	if(!res.locals.partials) res.locals.partials={};
	res.locals.partials.weather=getWeatherData();
	next();
});

app.use('/upload', function(req, res, next){
	var now=Date.now();
	jqupload.fileHandler({
		uploadDir:function(){
			return __dirname+'/public/uploads/'+now;
		},
		uploadUrl:function(){
			return '/uploads'+now;
		}
	})(req, res, next);
});

app.use(function(req, res, next){
	res.locals.flash=req.session.flash;
	delete req.session.flash;
	next();
});

switch(app.get('evn')){
	case 'development':
		app.use(require('morgan')('dev'));
		break;
	case 'production':
		app.use(require('express-logger')({
			path: __dirname + '/log/requests.log'
		}));
		break;
}

app.use(function(req, res, next){
	var cluster=require('cluster');
	if(cluster.isWorker) console.log('Worker %d received request', cluster.worker.id);
	next();
});

app.get('/', function(req, res){
	res.render('home');
	req.session.userName='Anonymous';
	var colorScheme=req.session.colorScheme || 'dark';
});
app.get('/about', function(req, res){
	res.render('about', {
		fortune: fortune.getFortune(),
		pageTestScript: '/qa/tests-about.js'
	});
});
app.get('/tours/hood-river', function(req, res){
	res.render('tours/hood-river');
});
app.get('/tours/request-group-rate', function(req, res){
	res.render('tours/request-group-rate');
});
app.get('/jquerytest', function(req, res){
	res.render('jquerytest');
});
app.get('/nursery-rhyme', function(req, res){
	res.render('nursery-rhyme');
});
app.get('/data/nursery-rhyme', function(req, res){
	res.json({
		animal:'squirrel',
		bodyPart: 'tail',
		adjective: 'bushy',
		noun: 'heck'
	});
});
app.get('/newsletter/archive', function(req, res){
	res.render('newsletter/archive');
})
app.get('/newsletter', function(req, res){
	res.render('newsletter', {csrf: 'CSRF token goes here'});
});
app.post('/newsletter', function(req, res){
	var name=req.body.name || '';
	var email=req.body.email || '';
	console.log(name + '--' + email);
	if(!email.match(VALID_EMAIL_REGEX)){
		//if(req.xhr) return res.json({error: 'Invalid name email address.'});
		req.session.flash={
			type: 'danger',
			intro: 'Validation error!',
			message: 'The email address you entered was not valid.'
		};
		return res.redirect(303, '/newsletter/archive');
	}
	new NewsletterSignup({name: name, email: email}).save(function(err){
		if(err){
			if(req.xhr) return res.json({error: 'Database error.'});
			req.session.flash={
				type: 'danger',
				intro: 'Database error!',
				message: 'There was a database error; please try again later.'
			}
			return res.redirect(303, '/newsletter/archive');
		}
		if(req.xhr) return res.json({success: true});
		req.session.flash={
			type: 'success',
			intro: 'Think you!',
			message: 'You have now been signed up for the newsletter.'
		};
		return res.redirect(303, '/newsletter/archive');
	});
});
app.post('/process', function(req, res){
	console.log('Form (from queyrstring): ' + req.query.form);
	console.log('CSRF token (from hidden form field): ' + req.body._csrf);
	console.log('Name (from visible form field): ' + req.body.name);
	console.log('Email (from visible form field): ' + req.body.email);
	res.redirect(303, '/thank-you');
})
app.get('/newsletter2', function(req, res){
	res.render('newsletter2', {csrf: 'CSRF token goes here'});
});
app.post('/process2', function(req, res){
	if(req.xhr || req.accepts('json,html')==='json'){
		res.send({success: true});
	}else{
		res.redirect(303, '/thank-you');
	}
});

app.get('/contest/vacation-photo', function(req, res){
	var now=new Date();
	res.render('contest/vacation-photo', {
		year: now.getFullYear(),
		month: now.getMonth()
	});
});

var dataDir=__dirname+'/data';
var vacationPhotoDir=dataDir+'/vacation-photo';
fs.existsSync(dataDir) || fs.mkdirSync(dataDir);
fs.existsSync(vacationPhotoDir) || fs.mkdirSync(vacationPhotoDir);

function saveContestEntry(contestName, emai, year, month, photoPath){
	
}

app.post('/contest/vacation-photo/:year/:month', function(req, res){
	var form=new formidable.IncomingForm();
	form.uploadDir='data/vacation-photo';
	form.parse(req, function(err, fields, files){
		if(err) return res.redirect(303, '/error');
		if(err) {
			res.session.flash={
				type: 'danger',
				intro: 'Oops',
				message: 'There was an error processing your submission. '
					+ 'Pelase try again.'
			};
			return res.redirect(303, '/contest/vacation-photo');
		}
		var photo=files.photo;
		var dir=vacationPhotoDir+'/'+Date.now();
		var path=dir+'/'+photo.name;
		console.log(photo.path);
		console.log(dir+'/'+photo.name);
		fs.mkdirSync(dir);
		fs.renameSync(photo.path, dir+'/'+photo.name);
		saveContestEntry('vacation-photo', fields.email, req.params.year, req.params.month, path);
		req.session.flash={
			type: 'success',
			intro: 'Good luck!',
			message: 'You have been entered into the contest.'
		};
		return res.redirect(303, '/contest/vacation-photo/entries');
	});
});

app.get('/fail', function(req, res){
	throw new Error('Nope!');
});
app.get('/epic-fail', function(req, res){
	process.nextTick(function(){
		throw new Error('Kaboom!');
	});
});

//定制404页面
app.use(function(req, res, next){
	res.status(404);
	res.render('404');
});

//定制500页面
app.use(function(err, req, res, next){
	console.error(err.stack);
	res.status(500);
	res.render('500');
});

//app.listen(app.get('port'), function(){
//	console.log('Express started on http://localhost:'+
//		app.get('port')+
//		'; press Ctrl-C to terminate.');
//});

/*
function startServer(){
	http.createServer(app).listen(app.get('port'), function(){
		console.log('Express started in ' + app.get('env')
			+ ' mode on http://localhost: ' + app.get('port')
			+ '; press Ctrl-C to terminate.');
	});
}

if(require.main===module){
	//应用程序直接运行；启动应用服务器
	startServer();
}else{
	//应用程序作为一个模块通过“require”引入： 导出函数
	//创建服务器
	module.exports=startServer();
}
*/

var server=http.createServer(app).listen(app.get('port'), function(){
	console.log('Listening on port %d.', app.get('port'));
});
