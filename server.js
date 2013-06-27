var express = require('express')
    , cons = require('consolidate')
    , app = express()
    , nodemailer = require('nodemailer')
    , g = require('gremlin');

// assign the mustache engine to .html files
app.engine('html', cons.mustache);

// set .html as the default extension 
app.set('view engine', 'html');
app.set('views', __dirname + '/site');

app.use(express.logger(':method :url'));

app.use(express.cookieParser('test all the things!'));
app.use(express.bodyParser());

var transport = nodemailer.createTransport('sendmail');

var versions = [ '1', '2' ];

app.initializeDB = function () {
    var T = g.Tokens,
        Direction = g.Direction,
        Type = g.ClassTypes;

    //Get a reference to Titan specific Enum
    var UniqCon = g.java.import("com.thinkaurelius.titan.core.TypeMaker$UniquenessConsistency");

    var BaseConfiguration = g.java.import('org.apache.commons.configuration.BaseConfiguration');

    var conf = new BaseConfiguration();
    conf.setPropertySync("storage.backend","cassandra");
    conf.setPropertySync("storage.hostname","127.0.0.1");
    conf.setPropertySync("storage.keyspace","titan");

    var TitanFactory = g.java.import('com.thinkaurelius.titan.core.TitanFactory');
    app.graphDB = TitanFactory.openSync(conf);
    g.SetGraph(app.graphDB);

    try {
        //Create index
        app.graphDB.makeTypeSync().nameSync("foo").dataTypeSync(Type.String.class).indexedSync(Type.Vertex.class)
            .uniqueSync(Direction.BOTH, UniqCon.NO_LOCK).makePropertyKeySync();
    } catch (e) {
    }


    var lucia = app.graphDB.addVertexSync(null);
    lucia.setPropertySync( "name", "Lucia" );

    var manos = app.graphDB.addVertexSync(null);
    manos.setPropertySync( "name", "Manos" );

    var luciaKnowsMarkos = app.graphDB.addEdgeSync(null, lucia, manos, "knows");

    app.graphDB.commitSync();

    console.log(g.V().in().toJSON());
};

app.versionRedirect = function (req, res) {
    var v = Math.floor((Math.random() * versions.length) + 1);
    res.redirect('/?v=' + v);
};

app.showHome = function (req, res, data) {
    data = data || { };
    data.assetpath = '/v' + req.param('v');
    res.render('v' + req.param('v') + '/index', data, function (err, html) {
        if (err) {
            app.versionRedirect(req, res);
        } else {
            res.send(html);
        }
    });
};

app.get('/', function(req, res){
    if (versions.indexOf(req.param('v')) > -1) {
        app.showHome(req, res);
    } else {
        app.versionRedirect(req, res);
    }
});

app.post('/', function(req, res){
    console.log({ 'registration': req.body });
    if (typeof req.body.name !== 'undefined' && typeof req.body.email !== 'undefined' && versions.indexOf(req.param('v')) > -1) {
        req.body.version = req.body.version || req.param('v');
        cons.mustache(__dirname + '/extra/registration.mustache', req.body, function(err, res) {
            if (err) {
                console.log(err);
            } else {
                transport.sendMail({
                    'to':   email,
                    'from': email,
                    'subject': 'Version ' + req.body.version + ' subscription',
                    'body': res
                }, function (err, result) {
                    if (err) {
                        console.log(err);
                    }
                });
            }
        });

        app.showHome(req, res, { 'message': req.body.message });
    } else {
        app.versionRedirect(req, res);
    }
});

app.initializeDB();

process.on('exit', app.graphDB.shutdownSync);
process.on('SIGINT', app.graphDB.shutdownSync);

app.listen(3000);

