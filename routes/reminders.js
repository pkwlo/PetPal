const { UpdateCommand, GetCommand } = require('@aws-sdk/lib-dynamodb');
const express = require('express');
const router = express.Router();
const { dynamoClient } = require('../db');
const path = require('path');
const sendEmail = require('../email_sender');

router.get('/', (req, res) => {
    if (!req.session.userInfo) {
        return res.redirect('/login'); // Redirect to login if not authenticated
    }

    res.sendFile(path.join(__dirname, '../views/reminders.html'));
});

router.get('/upcoming', async (req, res) => {
    if (!req.session.userInfo) {
        return res.status(401).json({ error: 'Not authenticated' });
    }

    const userId = req.session.userInfo.sub;

    const params = {
        TableName: 'PetPal',
        Key: { userId }
    };

    try {
        const result = await dynamoClient.send(new GetCommand(params));
        const reminders = result.Item?.reminders || [];
        res.json(reminders);
    } catch (err) {
        console.error('Error fetching reminders:', err);
        res.status(500).send('Error fetching reminders');
    }
});


router.post('/submit', async (req, res) => {
    if (!req.session.userInfo) {
        return res.status(401).json({ error: 'Not authenticated' });
    }

    const userId = req.session.userInfo.sub;
    const { reminderType, reminderDate, reminderTime, reminderDescription } = req.body;

    const params = {
        TableName: 'PetPal',
        Key: { userId },
        UpdateExpression: 'SET reminders = list_append(if_not_exists(reminders, :empty_list), :reminder)',
        ExpressionAttributeValues: {
            ':reminder': [{
                reminderType,
                reminderDate,
                reminderTime,
                reminderDescription
            }],
            ':empty_list': []
        },
        ReturnValues: 'ALL_NEW'
    };

    try {
        const result = await dynamoClient.send(new UpdateCommand(params));
        res.redirect('/reminders');
    } catch (err) {
        console.error('Error adding reminder:', err);
        res.status(500).send('Error adding reminder');
    }
});

router.post('/sendemail', async (req, res) => {
    try {
        await sendEmail.sendReminderEmails();
        res.send('Emails sent successfully');
    } catch (err) {
        console.error('Error sending emails:', err);
        res.status(500).send('Error sending emails');
    }
});


module.exports = router;