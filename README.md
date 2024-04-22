# Materialize and Novu Notification Integration Demo

## Overview

This project demonstrates a real-time notification system using Materialize and Novu. The demo is designed to subscribe to updates from a `winning_bids` view managed by Materialize and send notifications through Novu based on those updates. This example is simplified for demonstration purposes and is based on the [Materialize Quickstart Guide](https://materialize.com/docs/get-started/quickstart/), which includes a load generator for simulating data entries in the `winning_bids` view.

Rundown of the demo:

1. **Materialize**:
   - Data is continuously generated and updated within Materialize. A view is set up to aggregate or filter this data in a meaningful way.
   - The view updates are streamed, meaning any change in the underlying data is reflected in the view.

2. **Simple Node.js Application**:
   - A very simple Node.js app which connects to Materialize using `SUBSCRIBE`. It runs in an infinite loop and listens for any changes to the specified view.
   - When changes are detected, the application reads these changes and forwards the relevant data to the Novu platform using Novu's API.

3. **Novu Platform**:
   - Novu receives the data from the Node.js application.
   - Based on the incoming data, Novu can trigger various notifications. The specifics of these notifications are configured within Novu's workflows.

4. **Notification Workflow**:
   - Within Novu, different workflows can be set up. Each workflow can have its own rules on how to process incoming data.
   - These rules can include conditional logic to determine when notifications should be sent, what the content of the notification should be, and through what channels the notifications should be distributed (e.g., email, SMS, push notifications).

The above approach allows for real-time data processing and immediate action based on changes in the data without using extra services like Kafka.

## Prerequisites

Before running this demo, ensure you have the following:

- Node.js installed on your system.
- [A Materialize account](https://materialize.com/register/).
- An account and [API key from Novu](https://web.novu.co/settings).

## Setting Up

To run this demo, follow these steps:

1. Start by following the [Materialize Quickstart Guide](https://materialize.com/docs/get-started/quickstart/) to set up a load generator source in Materialize.

1. **Clone the Repository:**
   ```bash
   git clone git@github.com:bobbyiliev/materialize-novu-poc.git
   cd materialize-novu-poc
   ```

1. **Install Dependencies:**
   ```bash
   npm install
   ```

1. **Set Up Environment Variables:**
   Copy the `.env.example` file to `.env` and update the following environment variables with your Materialize and Novu credentials:
   ```plaintext
   MATERIALIZE_USERNAME=<username>
   MATERIALIZE_PASSWORD=<password>
   MATERIALIZE_HOST=<host>
   MATERIALIZE_PORT=6875
   MATERIALIZE_DATABASE=materialize
   MATERIALIZE_SSL=true
   NOVU_API_KEY=<your_novu_api_key>
   ```

1. **Run the Application:**
   ```bash
   node app.js
   ```

## How It Works

The application connects to a Materialize database and listens for updates to the `winning_bids` view. Upon receiving an update, it triggers a notification using Novu. The notification logic is structured to dynamically include details about the events from the `winning_bids` view, such as the buyer, auction ID, and bid amount.

## Further Improvements

The current implementation is a basic example to demonstrate the integration between Materialize and Novu.

The `SUBSCRIBE` query in the application is currently using `SNAPSHOT = FALSE` so that it only receives new updates without the initial snapshot of the view. Depending on your use case, you might want to adjust this behavior and possibly use `RETAIN HISTORY` as well.
