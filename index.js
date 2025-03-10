const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const AWS = require('aws-sdk');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = 3000;

// AWS SDK Configuration
AWS.config.update({
    region: 'us-west-2', // change to your region
    accessKeyId: 'YOUR_ACCESS_KEY_ID',
    secretAccessKey: 'YOUR_SECRET_ACCESS_KEY'
});
const dynamoClient = new AWS.DynamoDB.DocumentClient();

// Middleware
app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// Routes
const profileRoute = require('./routes/profile');
const trackingRoute = require('./routes/tracking');
const communityRoute = require('./routes/community');
const remindersRoute = require('./routes/reminders');

app.use('/profile', profileRoute);
app.use('/tracking', trackingRoute);
app.use('/community', communityRoute);
app.use('/reminders', remindersRoute);

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, './views/index.html'));
});

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});

module.exports.dynamoClient = dynamoClient;