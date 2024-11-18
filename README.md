# Slackbot-Project

Weather Notification Slackbot for DeliveryOps

This project is a weather notification Slackbot that mainly for delivery and logistics ops. It fetches and sends real-time weather updates for three regions: Klang Valley (Malaysia), Singapore, and Hong Kong. It retrieves weather data from public APIs and sends notifications to a designated Slack channel at scheduled intervals using cron jobs. The bot also includes an interactive map feature that allows users to view weather updates on a map interface.

Features

Fetches weather data for Klang Valley (Malaysia), Singapore, and Hong Kong from respective government APIs such as: Malaysia Weather Warning from MET Malaysia: Data.gov.my || 2-hour weather forecast from data.gov.sg: Data.gov.sg || General weather update from Hong Kong Observatory: Hong Kong Observatory API

Scheduled weather updates posted to a Slack channel at regular intervals

A built-in cron scheduler sends weather updates during specified periods.

Interactive Slack message with buttons linking to interactive weather maps

Cached weather data to minimize unnecessary API calls

Weather data is cached for 5 minutes to optimize API requests.

Interactive map interface for displaying weather updates based on coordinates.

Provides manual Slack notification triggers for Unit Test

Technologies Used

Node.js: Backend framework
Express: Web server and routing
Axios: For HTTP requests to external APIs
node-cron: For scheduling periodic weather notifications
Slack API: For sending notifications to Slack
dotenv: To manage environment variables securely
Body-parser: For parsing incoming requests
HTML/CSS/JS: To serve static files and maps
Installation Guide

Clone the repository:
git clone https://github.com/timothylee58/SlackBot-Project.git
cd SlackBot-Project
Install the required dependencies:
npm install
Create a .env file in the root directory and add your own following environment variables:
SLACK_BOT_TOKEN=slack-bot-token
SLACK_CHANNEL_ID=slack-channel-id
Start the Server
npm start
Usage

Local Weather Map The app serves a basic static HTML file that displays weather information on a map. You can manually load the map using the following URL format: http://localhost:3000/map?lat=&lng=&zoom=

Manual Slack Notification You can trigger the weather notification manually via Postman by visiting: http://localhost:3000/send-notification

Automated Weather Updates The bot is configured to send automated weather updates at regular intervals:

The cron jobs are defined using node-cron and will automatically trigger the weather notifications as per the schedule: Every 2 hours: 8 AM to 10 PM Every 30 minutes: 10 AM to 11:30 AM, 5 PM to 6:30 PM - Peak Hour

API Endpoints: GET /: Serves the homepage (index.html). || GET /map?lat=&lng=&zoom=: Serves the map view with the specified coordinates and zoom level. || GET /send-notification: Triggers a manual Slack notification.

API Routes: /send-notification: Manually trigger a Slack weather notification. || /map: View an interactive map of a specified location using query parameters:

lat: Latitude of the location.
lng: Longitude of the location.
zoom: Zoom level of the map. Example: http://localhost:3000/map?lat=3.1390&lng=101.6869&zoom=10
Debugging For debugging purposes, logs are printed to the console when the weather data is fetched or sent to Slack.

Future Development

Adding New Locations: Extend the project to support more locations by adding entries to the locations object in app.js. P.S: Each location must have a name, weather API endpoint, coordinates, and zoom level.
Contributing

Fork the repository.
Create a new branch (git checkout -b feature-branch).
Make your changes.
Commit your changes (git commit -m 'Add some feature').
Push to the branch (git push origin feature-branch).
Open a pull request.
Contact For any issues, questions, or suggestions, feel free to contact me through GitHub or Slack.
