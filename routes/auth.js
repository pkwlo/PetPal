const express = require('express');
const router = express.Router();
const path = require('path');
const AWS = require('aws-sdk');

const cognito = new AWS.CognitoIdentityServiceProvider();

router.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, '../views/login.html'));
});

router.post('/login', (req, res) => {
    const { username, password } = req.body;
    const params = {
        AuthFlow: 'USER_PASSWORD_AUTH',
        ClientId: 'YOUR_COGNITO_APP_CLIENT_ID',
        AuthParameters: {
            USERNAME: username,
            PASSWORD: password
        }
    };

    cognito.initiateAuth(params, (err, data) => {
        if (err) {
            console.error('Login error:', err);
            return res.status(401).send('Login failed');
        }
        req.session.user = username;
        res.redirect('/auth/success');
    });
});

router.get('/register', (req, res) => {
    res.sendFile(path.join(__dirname, '../views/register.html'));
});

router.post('/register', (req, res) => {
    const { username, password, email } = req.body;
    const params = {
        ClientId: 'YOUR_COGNITO_APP_CLIENT_ID',
        Username: username,
        Password: password,
        UserAttributes: [
            { Name: 'email', Value: email }
        ]
    };

    cognito.signUp(params, (err, data) => {
        if (err) {
            console.error('Signup error:', err);
            return res.status(500).send('Registration failed');
        }
        res.redirect('/auth/confirm');
    });
});

router.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/auth/logout-success');
});

router.get('/success', (req, res) => {
    res.send(`<h1>Login Successful</h1><p>Welcome, ${req.session.user}!</p><a href="/">Go to Home</a>`);
});

router.get('/confirm', (req, res) => {
    res.send('<h1>Registration Successful</h1><p>Please check your email to confirm your account.</p><a href="/auth/login">Go to Login</a>');
});

router.get('/logout-success', (req, res) => {
    res.send('<h1>Logged Out</h1><p>You have been successfully logged out.</p><a href="/">Go to Home</a>');
});

module.exports = router;
