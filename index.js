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
    secret: 'your-secret-key', // Change this to a secure random string
    resave: false,
    saveUninitialized: true
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

        res.redirect('/profile'); // Redirect to profile page after login
    } catch (err) {
        console.error('Callback error:', err);
        res.redirect('/'); // Redirect to home if there's an error
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
            return res.redirect('/'); // In case of an error, redirect to home
        }

        // Clear the session cookie
        res.clearCookie('connect.sid');
        res.redirect('/');
    });
});

const profileRoute = require('./routes/profile');
app.use('/profile', profileRoute);

// Start the server
app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});