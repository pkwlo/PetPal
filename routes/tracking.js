const express = require('express');
const router = express.Router();
const { dynamoClient } = require('../index');
const { v4: uuidv4 } = require('uuid');
const path = require('path');

router.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../views/tracking.html'));
});

router.post('/submit', (req, res) => {
    const { petId, meals, walks, medicalNotes } = req.body;
    const logId = uuidv4();

    const params = {
        TableName: 'HealthTracking',
        Item: { logId, petId, meals, walks, medicalNotes }
    };

    dynamoClient.put(params, (err) => {
        if (err) return res.status(500).send('Error saving tracking data');
        res.send('Health tracking data saved!');
    });
});

module.exports = router;