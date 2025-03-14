const nodemailer = require('nodemailer');
const { dynamoClient } = require('./db');
const { ScanCommand } = require('@aws-sdk/lib-dynamodb');
const AWS = require('aws-sdk');
const cron = require('node-cron');
require('dotenv').config();

const cognitoIdentityServiceProvider = new AWS.CognitoIdentityServiceProvider({
    region: 'us-west-2',
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
    }
});

const listAllUsers = async () => {
    const params = {
        UserPoolId: process.env.COGNITO_USER_POOL_ID,
        Limit: 60,
    };

    try {
        let users = [];
        let data;
        do {
            data = await cognitoIdentityServiceProvider.listUsers(params).promise();
            users = users.concat(data.Users);
            if (data.PaginationToken) {
                params.PaginationToken = data.PaginationToken; 
            }
        } while (data.PaginationToken); 
        return users;
    } catch (error) {
        console.error('Error fetching users:', error);
        throw error;
    }
};

// Function to fetch all records from DynamoDB table
async function fetchAllRecords(tableName) {
    let params = {
        TableName: tableName
    };
    let items = [];
    let lastEvaluatedKey = null;

    do {
        if (lastEvaluatedKey) {
            params.ExclusiveStartKey = lastEvaluatedKey; 
        }

        try {
            const data = await dynamoClient.send(new ScanCommand(params));
            items = items.concat(data.Items);
            lastEvaluatedKey = data.LastEvaluatedKey; 
        } catch (error) {
            console.error('Error scanning DynamoDB:', error);
            throw error;
        }
    } while (lastEvaluatedKey);
    console.log(`Fetched ${items.length} records from table: ${tableName}`);
    return items;
}

function isNextDay(reminderDate) {
    const today = new Date();
    const nextDay = new Date(today);
    nextDay.setDate(today.getDate() + 1); 

    const reminderDateObj = new Date(reminderDate);
    reminderDateObj.setHours(0, 0, 0, 0); 

    nextDay.setHours(0, 0, 0, 0);

    console.log('Reminder Date:', reminderDateObj);
    console.log('Next Day:', nextDay);

    return reminderDateObj.getTime() === nextDay.getTime();
}

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.PETPAL_GMAIL,
        pass: process.env.PETPAL_GMAIL_PASSWORD
    }
});

const getUsersAndEmails = async () => {
    try {
        const users = await listAllUsers();
        return users.map(user => ({
            userid: user.Attributes.find(attr => attr.Name === 'sub')?.Value,
            email: user.Attributes.find(attr => attr.Name === 'email')?.Value
        }));
    } catch (err) {
        console.error('Failed to fetch all user data:', err);
    }
};

async function sendReminderEmails() {
    try {
        const items = await fetchAllRecords('PetPal');
        const users = await getUsersAndEmails();

        items.forEach(item => {
            const user = users.find(user => user.userid === item.userId);
            if (user) {
                item.reminders.forEach(reminder => {
                    if (isNextDay(reminder.reminderDate)) {
                        console.log(`Sending reminder email for: ${reminder.reminderType}`);
                        const mailOptions = {
                            from: 'doNotReply.PetPat@gmail.com',
                            to: user.email,
                            subject: `Reminder: ${reminder.reminderType}`,
                            text: `
                                Hello,
                                You have the following reminder for tomorrow:

                                Reminder Type: ${reminder.reminderType}
                                Reminder Time: ${reminder.reminderTime}
                                Description: ${reminder.reminderDescription}

                                Please make sure to take action on this reminder.

                                Best regards,
                                Your Reminder Service
                            `,
                        };
                        transporter.sendMail(mailOptions, (error, info) => {
                            if (error) {
                                console.error('Error sending email:', error);
                            } else {
                                console.log('Email sent:', info.response);
                            }
                        });
                    }
                });
            }
        });
    } catch (error) {
        console.error('Error sending reminder emails:', error);
    }
}

// Schedule the function to run every day at 12:00 AM (midnight)
cron.schedule('0 0 * * *', () => {
    console.log('Running reminder emails at 12:00 AM...');
    sendReminderEmails();
});
