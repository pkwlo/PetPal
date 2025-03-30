require('dotenv').config();

const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const session = require('express-session');
const { Issuer, generators } = require('openid-client'); // For OIDC

const app = express();
const PORT = 8080;

// Middleware
app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(session({
    secret: 'your-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: {
        httpOnly: true,
        secure: false, // keep false on localhost, true if deployed with HTTPS
        sameSite: 'lax' // works for same-origin, safe
    }
}));

// Initialize OpenID Client
let client;
async function initializeClient() {
    const issuer = await Issuer.discover('https://cognito-idp.us-west-2.amazonaws.com/us-west-2_eLNBcBQN3');
    client = new issuer.Client({
        client_id: process.env.COGNITO_APP_CLIENT_ID,
        client_secret: process.env.COGNITO_APP_CLIENT_SECRET,
        redirect_uris: ['http://localhost:8080/authorize'], // Callback URL
        response_types: ['code']
    });
}
initializeClient().catch(console.error);

// Login route
app.get('/login', (req, res) => {
    const nonce = generators.nonce();
    const state = generators.state();

    req.session.nonce = nonce;
    req.session.state = state;

    const authUrl = client.authorizationUrl({
        scope: 'email openid profile',
        state: state,
        nonce: nonce,
    });

    res.redirect(authUrl);
});

// Callback route to handle Cognito response
app.get('/authorize', async (req, res) => {
    try {
        const params = client.callbackParams(req);
        const tokenSet = await client.callback(
            'http://localhost:8080/authorize',
            params,
            {
                nonce: req.session.nonce,
                state: req.session.state,
            }
        );

        const userInfo = await client.userinfo(tokenSet.access_token);
        req.session.userInfo = userInfo;

        req.session.save(err => {
            if (err) {
                console.error('Error saving session:', err);
            }
            res.redirect('/profile');
        });
        
    } catch (err) {
        console.error('Callback error:', err);
        res.redirect('/');
    }
});

// Route to check if the user is authenticated
app.get('/check-auth', (req, res) => {
    res.json({ isAuthenticated: !!req.session.userInfo });
});

// Home route
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'views/index.html'));
});

// Logout route
app.get('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.error("Error during session destruction", err);
            return res.redirect('/');
        }

        res.clearCookie('connect.sid');

        // Correct logout URL for Cognito
        const logoutUrl = `https://us-west-2elnbcbqn3.auth.us-west-2.amazoncognito.com/logout?client_id=${process.env.COGNITO_APP_CLIENT_ID}&logout_uri=${encodeURIComponent('http://localhost:8080')}`;

        res.redirect(logoutUrl);
    });
});


const profileRoute = require('./routes/profile');
app.use('/profile', profileRoute);

const remindersRoute = require('./routes/reminders');
app.use('/reminders', remindersRoute);

const communityRoute = require('./routes/community');
app.use('/community', communityRoute);

// Start the server
app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});