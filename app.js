import pkg from "pg";
import { Novu } from "@novu/node";
import "dotenv/config";

const novu = new Novu(process.env.NOVU_API_KEY);
const { Client } = pkg;

async function getLastProcessedTimestamp(client) {
  const query = `
      SELECT last_progress_mz_timestamp
      FROM subscribe_progress
      WHERE subscribe_name = 'notify_winners'
      ORDER BY last_progress_mz_timestamp DESC
      LIMIT 1`;
  const result = await client.query(query);
  return result.rows.length ? result.rows[0].last_progress_mz_timestamp : null;
}

async function updateLastProcessedTimestamp(client, subscribeName, timestamp) {
  console.log("Updating last processed timestamp:", timestamp);
  await client.query(
    "DELETE FROM subscribe_progress WHERE subscribe_name = $1",
    [subscribeName]
  );
  await client.query(
    "INSERT INTO subscribe_progress (subscribe_name, last_progress_mz_timestamp) VALUES ($1, $2)",
    [subscribeName, timestamp]
  );
}

async function main() {
  console.log("Starting Materialize listener...");
  const subscribeClient = new Client({
    user: process.env.MATERIALIZE_USERNAME,
    password: process.env.MATERIALIZE_PASSWORD,
    host: process.env.MATERIALIZE_HOST,
    port: process.env.MATERIALIZE_PORT,
    database: process.env.MATERIALIZE_DATABASE,
    ssl: process.env.MATERIALIZE_SSL === "true",
  });
  const updateClient = new Client({
    user: process.env.MATERIALIZE_USERNAME,
    password: process.env.MATERIALIZE_PASSWORD,
    host: process.env.MATERIALIZE_HOST,
    port: process.env.MATERIALIZE_PORT,
    database: process.env.MATERIALIZE_DATABASE,
    ssl: process.env.MATERIALIZE_SSL === "true",
  });

  await subscribeClient.connect();
  await updateClient.connect();
  console.log("Connected to Materialize...");

  const lastProcessedTimestamp = await getLastProcessedTimestamp(updateClient);
  await subscribeClient.query("BEGIN");
  const subscribeSQL = `DECLARE c CURSOR FOR SUBSCRIBE TO (SELECT * FROM winning_bids) WITH (SNAPSHOT = FALSE) ${
    lastProcessedTimestamp ? `AS OF ${lastProcessedTimestamp}` : ""
  }`;
  console.log("Subscribing with:", subscribeSQL);
  await subscribeClient.query(subscribeSQL);

  console.log("Listening for updates...");
  try {
    let buffer = [];
    let lastTimestamp = null;
    while (true) {
      const res = await subscribeClient.query("FETCH ALL c");
      if (res.rows.length > 0) {
        console.log("Received rows:", res.rows);
        for (const row of res.rows) {
          if (lastTimestamp === null || lastTimestamp === row.mz_timestamp) {
            buffer.push(row);
            lastTimestamp = row.mz_timestamp;
          } else {
            // Process the buffer
            for (const bufferedRow of buffer) {
              handleMaterializeUpdate(bufferedRow);
            }
            await updateLastProcessedTimestamp(
              updateClient,
              "notify_winners",
              lastTimestamp
            );
            // Clear the buffer and add the current row to it
            buffer = [row];
            lastTimestamp = row.mz_timestamp;
          }
        }
      } else {
        if (buffer.length > 0) {
          // Process remaining items in the buffer
          for (const bufferedRow of buffer) {
            handleMaterializeUpdate(bufferedRow);
          }
          await updateLastProcessedTimestamp(
            updateClient,
            "notify_winners",
            lastTimestamp
          );
          buffer = [];
          lastTimestamp = null;
        }
        console.log("No new data.");
      }
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  } catch (error) {
    console.error("Error:", error);
  } finally {
    await subscribeClient.end();
    await updateClient.end();
  }
}

function handleMaterializeUpdate(data) {
  console.log("Triggering notification for:", data);
  novu
    .trigger("materialize-poc-notification-workflow", {
      to: { subscriberId: data.buyer, email: data.buyer + "@example.com" },
      payload: {
        id: data.id,
        buyer: data.buyer,
        auction_id: data.auction_id,
        amount: data.amount,
        bid_time: data.bid_time,
        item: data.item,
        seller: data.seller,
      },
    })
    .catch(console.error);
}

main();
