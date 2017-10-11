//  OpenShift sample Node application
var express = require('express'),
    fs      = require('fs'),
    app     = express(),
    eps     = require('ejs'),
    morgan  = require('morgan');
    //mongoose = require('mongoose');

//session
var session = require('express-session');
const MongoStore = require('connect-mongo')(session);

//Stripe add
//const keyPublishable = process.env.PUBLISHABLE_KEY;
//const keySecret = process.env.SECRET_KEY;    
const keyPublishable = "pk_test_6pRNASCoBOKtIshFeQd4XMUh";
const keySecret= "sk_test_BQokikJOvBiI2HlWgH4olfQ2";
const stripe = require("stripe")(keySecret);
app.set('view engine', 'ejs');
app.use(require("body-parser").urlencoded({extended: false}));

Object.assign=require('object-assign')

app.engine('html', require('ejs').renderFile);
app.use(express.static('public'))
app.use(morgan('combined'))

var port = process.env.PORT || process.env.OPENSHIFT_NODEJS_PORT || 8080,
    ip   = process.env.IP   || process.env.OPENSHIFT_NODEJS_IP || '0.0.0.0',
    mongoURL = process.env.OPENSHIFT_MONGODB_DB_URL || process.env.MONGO_URL,
    mongoURLLabel = "";

if (mongoURL == null && process.env.DATABASE_SERVICE_NAME) {
  var mongoServiceName = process.env.DATABASE_SERVICE_NAME.toUpperCase(),
      mongoHost = process.env[mongoServiceName + '_SERVICE_HOST'],
      mongoPort = process.env[mongoServiceName + '_SERVICE_PORT'],
      mongoDatabase = process.env[mongoServiceName + '_DATABASE'],
      mongoPassword = process.env[mongoServiceName + '_PASSWORD']
      mongoUser = process.env[mongoServiceName + '_USER'];

  if (mongoHost && mongoPort && mongoDatabase) {
    mongoURLLabel = mongoURL = 'mongodb://';
    if (mongoUser && mongoPassword) {
      mongoURL += mongoUser + ':' + mongoPassword + '@';
    }
    // Provide UI label that excludes user id and pw
    mongoURLLabel += mongoHost + ':' + mongoPort + '/' + mongoDatabase;
    mongoURL += mongoHost + ':' +  mongoPort + '/' + mongoDatabase;

  }
}
var db = null,
    dbDetails = new Object();

var storeAlex = null;

//mongoose.connect(mongoURL);
//db = mongoose.connection;
//app.use(session({store: new MongoStore({mongooseConnection : db}), secret: 'this-is-a-secret-token', cookie: { maxAge: 600000 }, resave: false, saveUninitialized: true}));
//console.log('MongoStore started');
//
var initDb = function(callback) {
  //TEST
  //mongoURL = 'mongodb://userTFG:ii6oqwwefYtGfnmP@172.30.37.243:27017/sampledb';
  //mongoURLLabel ='mongodb://172.30.37.243:27017/sampledb';
  if (mongoURL == null) return;
 
  var mongodb = require('mongodb');
  if (mongodb == null) return;
 
  mongodb.connect(mongoURL, function(err, conn) {
    if (err) {
      callback(err);
      return;
    }
    db = conn;
    dbDetails.databaseName = db.databaseName;
    dbDetails.url = mongoURLLabel;
    dbDetails.type = 'MongoDB';

    console.log('Connected to MongoDB at: %s', mongoURL);
     
    //Session
    storeAlex = new MongoStore({db : conn, collection : 'mySessions', ttl: 14 * 24 * 60 * 60},function(err){console.log('Error connecting to Mongo. Message:\n'+err);});
    console.log(storeAlex.state);
    //app.use(session({store: store, secret: 'this-is-a-secret-token', cookie: { maxAge: 600000 }, resave: false, saveUninitialized: true}));
    console.log('MongoStore started');
    console.log(mongoURL);
  });
};

app.use(session({store : storeAlex, secret: 'this-is-a-secret-token', resave: false, saveUninitialized: true}));

app.get('/', function (req, res) {
  // try to initialize the db on every request if it's not already
  // initialized.
  var sessData = req.session;
  console.log(req.session);
  console.log(req.sessionStore);
  if(storeAlex){
    console.log('storestate : ' + storeAlex.state);
  }
  if(req.session){
    sessData.someAttribute = req.sessionID;
  }
  if (!db) {
    initDb(function(err){});
  }
  if (db) {
    var col = db.collection('counts');
    //console.log(req.session.id);
    // Create a document with request IP and current time of request
    col.insert({ip: req.ip, date: Date.now()});
    col.count(function(err, count){
      res.render('index.html', { pageCountMessage : count, dbInfo: dbDetails , keyPublishable});
    });
  } else {
    res.render('index.html', { pageCountMessage : null, keyPublishable});
  }
});

app.get('/item2', function (req, res) {
  // try to initialize the db on every request if it's not already
  // initialized.
  if (!db) {
    initDb(function(err){});
  }
  if (db) {
    var col = db.collection('counts');
    // Create a document with request IP and current time of request
    col.insert({ip: req.ip, date: Date.now()});
    col.count(function(err, count){
      res.render('item2.html', { pageCountMessage : count, dbInfo: dbDetails , keyPublishable});
    });
  } else {
    res.render('item2.html', { pageCountMessage : null});
  }
});

app.get('/pagecount', function (req, res) {
  // try to initialize the db on every request if it's not already
  // initialized.
  var sessData = req.session;
  if(req.session){
    sessData.someAttribute = req.sessionID;
  }
  if (!db) {
    initDb(function(err){});
  }
  if (db) {
    db.collection('counts').count(function(err, count ){
        var someAttribute ='';
        if(req.session){
        var someAttribute = req.session.someAttribute;
        }
      res.send('{ pageCount: ' + count + '}' + ' Your sessionID is ' + someAttribute );
    });
  } else {
    res.send('{ pageCount: -1 }');
  }
});

//Stripe charge
app.post("/charge", (req, res) => {
  let amount = 500;

  stripe.customers.create({
     email: req.body.stripeEmail,
    source: req.body.stripeToken
  })
  .then(customer =>
    stripe.charges.create({
      amount,
      description: "Sample Charge",
         currency: "usd",
         customer: customer.id
    }))
  .then(charge => res.render("charge.html"));
});

// error handling
app.use(function(err, req, res, next){
  console.error(err.stack);
  res.status(500).send('Something bad happened!');
});

initDb(function(err){
  console.log('Error connecting to Mongo. Message:\n'+err);
});

app.listen(port, ip);
console.log('Server running on http://%s:%s', ip, port);

module.exports = app ;
