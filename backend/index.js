    const express = require('express');
    const axios = require('axios');
    const cron = require('node-cron');
    const { WebClient } = require('@slack/web-api');
    const path = require('path');
    const bodyParser = require('body-parser'); 
    require('dotenv').config();

    const app = express();
    const port = process.env.PORT || 3000; /*** The port number that the Express.js server will listen on.*/


    // Middleware to parse JSON
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));
    app.use(bodyParser.json({ limit: '50mb' })); // Increase limit if necessary

    // Serve static files
    app.use(express.static(path.join(__dirname, 'public')));

    // Define locations
    const locations = {
        'klang-valley': {
            name: 'Klang Valley',
            weatherLocation: 'Kuala Lumpur, Malaysia',
            coordinates: [3.1390, 101.6869],
            zoomLevel: 9
        },
        'singapore': {
            name: 'Singapore',
            weatherLocation: 'Singapore',
            coordinates: [1.3521, 103.8198],
            zoomLevel: 12
        },
        'hong-kong': {
            name: 'Hong Kong',
            weatherLocation: 'Hong Kong',
            coordinates: [22.3193, 114.1694],
            zoomLevel: 12
        }
    };

    // API keys and Slack channel info
    const slackToken = process.env.SLACK_BOT_TOKEN;
    const channelId = process.env.SLACK_CHANNEL_ID;
    const slackClient = new WebClient(slackToken);

    // Cache structure for weather data
    let weatherCache = {
        'klang-valley': { data: null, timestamp: 0 },
        'singapore': { data: null, timestamp: 0 },
        'hong-kong': { data: null, timestamp: 0 }
    };

    // Fetch weather data function
    async function fetchWeatherData(locationKey) {
        const now = Date.now();
        const cacheDuration = 5 * 60 * 1000; // Cache for 5 minutes


        if (!locationKey) {
            console.error('Error: locationKey is not defined');
            return null;
        }

        if (weatherCache[locationKey].data && (now - weatherCache[locationKey].timestamp < cacheDuration)) {
            console.log(`Using cached data for ${locationKey}`);
            return weatherCache[locationKey].data;
        }

        let apiUrl;
        switch (locationKey) {
            case 'klang-valley':
                apiUrl = 'https://api.data.gov.my/weather/warning?limit=3';
                break;
            case 'singapore':
                apiUrl = 'https://api.data.gov.sg/v1/environment/2-hour-weather-forecast';
                break;
            case 'hong-kong':
                apiUrl = 'https://data.weather.gov.hk/weatherAPI/opendata/weather.php?dataType=flw&lang=en';
                break;
            default:
                console.error('No API URL defined for location:', locationKey);
                return null;
        }

        try {
            const response = await axios.get(apiUrl);
            console.log('API Response for', locationKey, response.data);
            
            if (response.status === 200 && response.data) {
                weatherCache[locationKey] = { data: response.data, timestamp: now };
                return response.data;
            } else {
                console.error(`No data found for ${locationKey}`);
                return { error: `No data available for ${locationKey}` }; // Return an error object
            }
        }catch (error) {
            console.error(`Error fetching weather data for ${locationKey}:`, error.message);
            return { error: `Error fetching data for ${locationKey}` }; // Default response on error
        }
        
    }

   
    // Send formatted data to Slack
    async function prepareSlackMessage() {
        // Fetch and format the weather data for each location
        const malaysiaData = await formatLocationData(await fetchWeatherData('klang-valley'), 'klang-valley');
        const singaporeData = await formatLocationData(await fetchWeatherData('singapore'), 'singapore');
        const hongKongData = await formatLocationData(await fetchWeatherData('hong-kong'), 'hong-kong');
        
        // Corrected map URL
        const localhostUrl = 'https://slackbot-project.onrender.com';
        const mapUrlSG = `${localhostUrl}`; // Ensure the URL is correctly formatted
        
        // Construct the Slack message
        return {
            blocks: [
                { 
                    type: "section", 
                    text: { 
                        type: "mrkdwn", 
                        text: ":mostly_sunny: *Weather Update*" 
                    } 
                },
                { type: "divider" },
                {
                    type: "section",
                    text: {
                        type: "mrkdwn",
                        text: `:flag-sg: *Singapore 2-Hour Weather Forecast*\n${singaporeData.text}`
                    }
                },
                { type: "divider" },
                {
                    type: "section",
                    text: {
                        type: "mrkdwn",
                        text: `:flag-my: *Malaysia Weather Warning*\n${malaysiaData.text}`
                    }
                },
                { type: "divider" },
                {
                    type: "section",
                    text: {
                        type: "mrkdwn",
                        text: `:flag-hk: *Hong Kong Weather Update*\n${hongKongData.text}`
                    }
                },
                { type: "divider" },
                {
                    type: "section",
                    text: {
                        type: "mrkdwn",
                        text: `<${mapUrlSG}|View Map For More>` 
                    }
                }
            ]
        };
    }
    
    function formatLocationData(weatherData, locationKey) {
        let weatherText = '';
    
        // Handle error for missing data
        if (weatherData.error) {
            weatherText = `:warning: Error fetching weather data: ${weatherData.error}`;
            return { text: weatherText }; // Return the error message
        }
    
        // Formatting weather data based on location
        switch (locationKey) {
            case 'klang-valley':
                const warningIssue = weatherData[2]?.warning_issue || {};
                weatherText = `*Warning Issue:* ${warningIssue.title_en || 'Available Soon'}\n` +
                              `*Issued:* ${warningIssue.issued || 'Available Soon'}\n` +
                              `*Valid To:* ${weatherData[2]?.valid_to || 'Available Soon'}\n` +
                              `*Description:* ${weatherData[2]?.text_en || 'Available Soon'}`;
                break;
            case 'singapore':
                const selectedAreas = [
                    "Ang Mo Kio", "Toa Payoh", "Changi", "City",
                    "Jurong East", "Jurong West", "Tuas", "Kallang",
                    "Pasir Ris", "Woodlands","Bukit Panjang","Queenstown","Bedok","Sentosa",
                ];
                const sgForecasts = weatherData.items[0]?.forecasts
                    .filter(item => selectedAreas.includes(item.area))
                    .map(item => `Area: ${item.area} - Forecast: ${item.forecast}`)
                    .join('\n');
                weatherText = sgForecasts || 'No forecasts available';
                break;
            case 'hong-kong':
                weatherText = `*General Situation:* ${weatherData.generalSituation || 'Available Soon'}\n` +
                              `*Typhoon Info:* ${weatherData.tcInfo || 'No typhoon warnings'}\n` +
                              `*Outlook:* ${weatherData.outlook || 'Available Soon'}`;
                break;
            default:
                weatherText = `No weather data available for ${locationKey}`;
        }
    
        return { text: weatherText };
    }
    
    
    // Send Slack notification function
    async function sendSlackNotification() {
        try {
            const formattedSlackMessage = await prepareSlackMessage();

            console.log(JSON.stringify(formattedSlackMessage, null, 2));


            // Post the message with the weather data
            const response = await slackClient.chat.postMessage({
                channel: channelId,
                blocks: formattedSlackMessage.blocks, // This sends the formatted blocks
                text: "Weather update for Klang Valley, Singapore, and Hong Kong." // Fallback plain text
            });

            console.log('Message sent successfully:', response);

        } catch (error) {
            console.error('Error sending Slack message:', error.message);
        }


   // 2-hour intervals (at 8:00, 12:00, 14:00, 16:00, 20:00, 21:00)
cron.schedule('0 8,12,14,16,20,21 * * *', () => {
    console.log('Running scheduled 2-hour weather update...');
    sendSlackNotification();
});

// 30-minute intervals (at 10:00, 10:30, 11:00, 11:30, 17:00, 17:30, 18:00, 18:30)
cron.schedule('0,30 10,11,17,18 * * *', () => {
    console.log('Running scheduled 30-minute weather update...');
    sendSlackNotification();
});
    
    // Home route
    app.get('/', (req, res) => {
        res.sendFile(path.join(__dirname, 'index.html'));
    });

    // Manual trigger for sending Slack notification
    app.get('/send-notification', async (req, res) => {
        console.log('Manual Slack notification trigger...');
        await sendSlackNotification();
        res.send('Slack notification sent!');
    });

    // Serve map page with location handling
    app.get('/map', (req, res) => {
        const { lat, lng, zoom } = req.query;

        if (!lat || !lng || !zoom) {
            return res.status(400).send('Invalid or missing parameters. Please provide lat, lng, and zoom.');
        }

        // Serve the HTML file for the map
        res.sendFile(path.join(__dirname, 'index.html'));
    });

    // Start server
    app.listen(port, () => {
        console.log(`Server is running on http://localhost:${port}`);
    });
}
