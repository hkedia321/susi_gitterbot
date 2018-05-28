/*jshint globalstrict:true, trailing:false, unused:true, node:true */
"use strict";

var express         = require('express');
var passport        = require('passport');
var OAuth2Strategy  = require('passport-oauth2');
var request         = require('request');

var gitterHost    = process.env.HOST || 'https://gitter.im';
var port          = process.env.PORT || 8000;

// Client OAuth configuration
// the API key and secret are those of the SUSI bot account
var clientId      = process.env.GITTER_KEY ? process.env.GITTER_KEY.trim() : "1aa9825fad1bf430e1ead10c3d05dc24e075e68b";
var clientSecret  = process.env.GITTER_SECRET ? process.env.GITTER_SECRET.trim() : "1de732067b97ec27e4dbc84eca02880964dfaac8";

// Gitter API client helper
var gitter = {
  fetch: function(path, token, cb) {
    var options = {
     url: gitterHost + path,
     headers: {
       'Authorization': 'Bearer ' + token
     }
    };

    request(options, function (err, res, body) {
      if (err) return cb(err);

      if (res.statusCode === 200) {
        cb(null, JSON.parse(body));
      } else {
        cb('err' + res.statusCode);
      }
    });
  },

  fetchCurrentUser: function(token, cb) {
    this.fetch('/api/v1/user/', token, function(err, user) {
      cb(err, user[0]);
    });
  },

  fetchRooms: function(user, token, cb) {
    this.fetch('/api/v1/user/' + user.id + '/rooms', token, function(err, rooms) {
      cb(err, rooms);
    });
  }
};

var app = express();

// Middlewares
app.set('view engine', 'ejs');
app.set('views', __dirname + '/views');
app.use(express.json());
app.use(express.urlencoded());
app.use(express.static( __dirname + '/public'));
app.use(express.bodyParser());
app.use(express.methodOverride());
app.use(express.cookieParser());
app.use(express.session({secret: 'keyboard cat'}));
app.use(passport.initialize());
app.use(passport.session());
app.use(app.router);

// Passport Configuration

passport.use(new OAuth2Strategy({
    authorizationURL:   gitterHost + '/login/oauth/authorize',
    tokenURL:           gitterHost + '/login/oauth/token',
    clientID:           clientId,
    clientSecret:       clientSecret,
    callbackURL:        '/login/callback',
    passReqToCallback:  true
  },
  function(req, accessToken, refreshToken, profile, done) {
    req.session.token = accessToken;
    gitter.fetchCurrentUser(accessToken, function(err, user) {
      return (err ? done(err) : done(null, user));
    });
  }
));

passport.serializeUser(function(user, done) {
  done(null, JSON.stringify(user));
});

passport.deserializeUser(function (user, done) {
  done(null, JSON.parse(user));
});

app.get('/login',
  passport.authenticate('oauth2')
);

app.get('/login/callback',
  passport.authenticate('oauth2', {
    successRedirect: '/rooms',
    failureRedirect: '/'
  })
);

app.get('/logout', function(req,res) {
  req.session.destroy();
  res.redirect('/');
});

app.get('/', function(req, res) {
  res.render('index');
});


app.get('/rooms', function(req, res) {
  if (!req.user) return res.redirect('/');

  // Fetch user rooms using the Gitter API
  gitter.fetchRooms(req.user, req.session.token, function(err, rooms) {
    if (err) return res.send(500);

    res.render('rooms', {
      user: req.user,
      token: req.session.token,
      clientId: clientId,
      rooms: rooms
    });
  });

});

app.listen(port);
console.log('Demo app running at http://localhost:' + port);
