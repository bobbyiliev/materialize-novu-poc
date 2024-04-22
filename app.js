import pkg from "pg";
import { Novu } from "@novu/node";
import "dotenv/config";

// Initialize Novu with your API key.
const novu = new Novu(process.env.NOVU_API_KEY);
const { Client } = pkg;

async function main() {
  console.log("Starting Materialize listener...");
  const client = new Client({
    user: process.env.MATERIALIZE_USERNAME,
    password: process.env.MATERIALIZE_PASSWORD,
    host: process.env.MATERIALIZE_HOST,
    port: process.env.MATERIALIZE_PORT,
    database: process.env.MATERIALIZE_DATABASE,
    ssl: process.env.MATERIALIZE_SSL === "true",
  });

  try {
    console.log("Connecting to Materialize...");
    await client.connect();
    await client.query("BEGIN");
    await client.query(
      "DECLARE c CURSOR FOR SUBSCRIBE TO (SELECT * FROM winning_bids) WITH (SNAPSHOT = FALSE)"
    );

    console.log("Listening for updates...");
    while (true) {
      const res = await client.query("FETCH ALL c");
      if (res.rows.length > 0) {
        console.log("Received rows:", res.rows);
        res.rows.forEach(row => handleMaterializeUpdate(row));
      } else {
        console.log("No new data.");
      }
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  } catch (error) {
    console.error("Error:", error);
  } finally {
    await client.end();
  }
}

function handleMaterializeUpdate(data) {
  // Example trigger logic for Novu
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
