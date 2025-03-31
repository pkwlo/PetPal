const { dynamoClient } = require('./db');
const { ScanCommand } = require('@aws-sdk/lib-dynamodb');
const AWS = require('aws-sdk');
// const cron = require('node-cron');
require('dotenv').config();

const ses = new AWS.SES({
    region: 'us-west-2',
    credentials: {
        accessKeyId: process.env.AWS_SES_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SES_SECRET_ACCESS_KEY
    },
    apiVersion: '2010-12-01'
});

const cognitoIdentityServiceProvider = new AWS.CognitoIdentityServiceProvider({
    region: 'us-west-2',
    credentials: {
        accessKeyId: process.env.COGNITO_AWS_ID,
        secretAccessKey: process.env.COGNITO_AWS_ACCESS_KEY
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

                        // Create sendEmail params
                        var params = {
                            Destination: {
                                CcAddresses: [],
                                ToAddresses: [user.email],
                            },
                            Message: {
                                Body: {
                                    Html: {
                                        Charset: "UTF-8",
                                        Data: `
                                            <html>
                                                <body>
                                                    <p>Hello,</p>
                                                    <p>You have the following reminder for tomorrow:</p>
                                                    <ul>
                                                        <li><strong>Reminder Type:</strong> ${reminder.reminderType}</li>
                                                        <li><strong>Reminder Time:</strong> ${reminder.reminderTime}</li>
                                                        <li><strong>Description:</strong> ${reminder.reminderDescription}</li>
                                                    </ul>
                                                    <p>Please make sure to take action on this reminder.</p>
                                                    <p>Best regards,<br>Your Reminder Service</p>
                                                </body>
                                            </html>
                                        `,
                                    },
                                    Text: {
                                        Charset: "UTF-8",
                                        Data: `
                                            Hello,
                                            
                                            You have the following reminder for tomorrow:

                                            Reminder Type: ${reminder.reminderType}
                                            Reminder Time: ${reminder.reminderTime}
                                            Description: ${reminder.reminderDescription}

                                            Please make sure to take action on this reminder.

                                            Best regards,
                                            Your Reminder Service
                                        `,
                                    },
                                },
                                Subject: {
                                    Charset: "UTF-8",
                                    Data: `Reminder: ${reminder.reminderType}`,
                                },
                            },
                            Source: "donotreply.petpal@gmail.com",
                            ReplyToAddresses: [
                                "donotreply.petpal@gmail.com",
                            ],
                        };

                        var sendPromise = ses.sendEmail(params).promise();

                        // Handle promise's fulfilled/rejected states
                        sendPromise
                            .then(function (data) {
                                console.log(data.MessageId);
                            })
                            .catch(function (err) {
                                console.error(err, err.stack);
                            });
                    }
                });
            }
        });
    } catch (error) {
        console.error('Error sending reminder emails:', error);
    }
}

// module.exports.handler = async (event) => {
//     await sendReminderEmails();
//     const response = {
//       statusCode: 200,
//       body: JSON.stringify('Hello from Lambda!'),
//     };
//     return response;
// };


module.exports = { sendReminderEmails };