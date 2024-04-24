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
   - The application also keeps track of the last progress timestamp for each subscription in a Materialize table. This can be changed to store the progress in a different database or service if needed.

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

1. Start by following the [Materialize Quickstart Guide](https://materialize.com/docs/get-started/quickstart/) to set up a load generator source in Materialize:

```sql
CREATE SOURCE IF NOT EXISTS auction_house_source
FROM LOAD GENERATOR AUCTION (TICK INTERVAL '500ms')
FOR ALL TABLES;

CREATE VIEW on_time_bids AS
    SELECT
        bids.id       AS bid_id,
        auctions.id   AS auction_id,
        auctions.seller,
        bids.buyer,
        auctions.item,
        bids.bid_time,
        auctions.end_time,
        bids.amount
    FROM bids
    JOIN auctions ON bids.auction_id = auctions.id
    WHERE bids.bid_time < auctions.end_time;

CREATE VIEW highest_bid_per_auction AS
    SELECT grp.auction_id, bid_id, buyer, seller, item, amount, bid_time, end_time FROM
        (SELECT DISTINCT auction_id FROM on_time_bids) grp,
        LATERAL (
            SELECT * FROM on_time_bids
            WHERE auction_id = grp.auction_id
            ORDER BY amount DESC LIMIT 1
        );

CREATE MATERIALIZED VIEW winning_bids AS
    SELECT * FROM highest_bid_per_auction
    WHERE end_time < mz_now();

CREATE INDEX winning_bids_idx_amount ON winning_bids (amount);

ALTER MATERIALIZED VIEW winning_bids SET (RETAIN HISTORY = FOR '1h');
```

1. Create a table in Materialize, where we will store the last progress timestamp for each subscription:

    ```sql
    CREATE TABLE subscribe_progress (
        subscribe_name TEXT,
        last_progress_mz_timestamp TEXT
    );
    ```

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

- The `SUBSCRIBE` query in the application is currently using `SNAPSHOT = FALSE` so that it only receives new updates without the initial snapshot of the view.
- Handle error where `AS OF` timestamp is past the retain history interval, currently this is hardcoded to 1 hour.
- Make recording `last_progress_mz_timestamp` an async task that happens periodically.

## Teardown

Back in the SQL shell:

```sql
DROP SOURCE auction_house_source CASCADE;
```
