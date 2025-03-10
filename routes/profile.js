const express = require('express');
const router = express.Router();
const { dynamoClient } = require('../index');
const { v4: uuidv4 } = require('uuid');
const path = require('path');

router.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../views/profile.html'));
});

router.post('/submit', (req, res) => {
    const { name, breed, age } = req.body;
    const petId = uuidv4();

    const params = {
        TableName: 'PetProfiles',
        Item: { petId, name, breed, age }
    };

    dynamoClient.put(params, (err) => {
        if (err) return res.status(500).send('Error saving profile');
        res.send('Profile saved successfully!');
    });
});

module.exports = router;