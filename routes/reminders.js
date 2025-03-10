const express = require('express');
const router = express.Router();
const { dynamoClient } = require('../index');
const { v4: uuidv4 } = require('uuid');
const path = require('path');

router.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../views/reminders.html'));
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