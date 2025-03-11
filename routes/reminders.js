const express = require('express');
const router = express.Router();
const { dynamoClient } = require('../index');
const { v4: uuidv4 } = require('uuid');
const path = require('path');

router.get('/', (req, res) => {
    if (!req.session.userInfo) {
        return res.redirect('/login'); // Redirect to login if not authenticated
    }

    res.sendFile(path.join(__dirname, '../views/reminders.html'));
});

router.get('/upcoming', (req, res) => {
    const userId = req.session.userInfo.sub; // or whatever your session contains as the user ID

    const params = {
        TableName: 'PetPal',
        Key: { userId }
    };

    dynamoClient.get(params, (err, data) => {
        if (err) return res.status(500).send('Error fetching reminders');

        // Send back just the reminders list
        const reminders = data.Item?.reminders || [];
        res.json(reminders);
    });
});


router.post('/submit', (req, res) => {
    const { email, reminderType, date } = req.body;
    const reminderId = uuidv4();

    const params = {
        TableName: 'Reminders',
        Item: { reminderId, email, reminderType, date }
    };

    dynamoClient.put(params, (err) => {
        if (err) return res.status(500).send('Error saving reminder');
        res.send('Reminder saved!');
    });
});

module.exports = router;