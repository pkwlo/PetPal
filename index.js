const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const session = require('express-session');
const AWS = require('aws-sdk');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = 3000;

// AWS SDK Configuration
AWS.config.update({
    region: 'us-west-2', // change to your region
    accessKeyId: 'AKIAT7JJUZHBXOLMFAED',
    secretAccessKey: '/LVy6wQJ563ATUCU3q7SLp4YQVHju1e2uVnlNNeK'
});
const dynamoClient = new AWS.DynamoDB.DocumentClient();

// Middleware
app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(session({ secret: 'your-secret-key', resave: false, saveUninitialized: true }));

// Middleware for session-protected routes
function isAuthenticated(req, res, next) {
    if (req.session.user) {
        return next();
    }
    res.redirect('/auth/login');
}

// Routes
const profileRoute = require('./routes/profile');
const trackingRoute = require('./routes/tracking');
const communityRoute = require('./routes/community');
const remindersRoute = require('./routes/reminders');
const authRoute = require('./routes/auth');

app.use('/profile', isAuthenticated, profileRoute);
app.use('/tracking', isAuthenticated, trackingRoute);
app.use('/community', isAuthenticated, communityRoute);
app.use('/reminders', isAuthenticated, remindersRoute);
app.use('/auth', authRoute);

app.get('/', (req, res) => {
    let html = '<!DOCTYPE html><html><head><title>Pet Care App - Home</title></head><body>';
    html += '<h1>Welcome to the Pet Care App</h1>';
    if (req.session.user) {
        html += `<p>Hello, ${req.session.user}!</p>`;
    }
    html += '<ul>';
    html += '<li><a href="/auth/login">Login</a></li>';
    html += '<li><a href="/auth/register">Register</a></li>';
    html += '<li><a href="/auth/logout">Logout</a></li>';
    html += '<li><a href="/profile">Pet Profile</a></li>';
    html += '<li><a href="/tracking">Health Tracking</a></li>';
    html += '<li><a href="/community">Community</a></li>';
    html += '<li><a href="/reminders">Reminders</a></li>';
    html += '</ul></body></html>';
    res.send(html);
});

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});

module.exports.dynamoClient = dynamoClient;