const express = require('express');
const multer = require('multer');
const dotenv = require('dotenv');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { v4: uuidv4 } = require('uuid');
const { DynamoDBDocumentClient, PutCommand } = require('@aws-sdk/lib-dynamodb');
const { ScanCommand } = require('@aws-sdk/lib-dynamodb');
const path = require('path');

dotenv.config();

const router = express.Router();

// AWS Clients
const s3 = new S3Client({ region: process.env.AWS_REGION });
const ddb = DynamoDBDocumentClient.from(require('../db').dynamoClient);

// Multer setup for file upload
const storage = multer.memoryStorage();
const upload = multer({ storage });

router.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../views/community.html'));
});

router.post('/submit', upload.single('photo'), async (req, res) => {
    const { comment } = req.body;
    const file = req.file;
    console.log('Form Data:', comment);
    console.log('File Received:', file);

    try {
        if (!file) return res.status(400).send('No image uploaded');

        const imageId = uuidv4();
        const key = `community/${imageId}-${file.originalname}`;
        console.log('Generated S3 key:', key);
        const name = req.session.userInfo.name;

        const s3Params = {
            Bucket: process.env.AWS_S3_BUCKET,
            Key: key,
            Body: file.buffer,
            ContentType: file.mimetype
        };

        console.log('Uploading to S3...');
        await s3.send(new PutObjectCommand(s3Params));
        console.log('Uploaded to S3 successfully');

        const imageUrl = `https://${process.env.AWS_S3_BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;
        console.log('Image URL:', imageUrl);

        const dbParams = {
            TableName: 'CommunityPosts',
            Item: {
                imageId,
                imageUrl,
                name,
                comment,
                timestamp: new Date().toISOString()
            }
        };

        console.log('Saving to DynamoDB:', dbParams);
        await ddb.send(new PutCommand(dbParams));
        console.log('Post saved to DB');

        res.redirect('/community');
    } catch (err) {
        console.error('Upload error:', err.name, err.message, err.stack);
        res.status(500).send('Error uploading post');
    }
});

router.get('/posts', async (req, res) => {
    try {
        const dbParams = {
            TableName: 'CommunityPosts',
            Limit: 10
        };
        const data = await ddb.send(new ScanCommand(dbParams));
        console.log('Fetched posts:', data.Items);
        res.json(data.Items);
    } catch (err) {
        console.error('Error getting posts:', err.name, err.message);
        res.status(500).send('Error getting posts');
    }
});

module.exports = router;
