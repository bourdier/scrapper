import fs from "fs";
import axios from "axios";
import logSymbols from 'log-symbols';
import mongoose from 'mongoose';
import tvModel from "./models/tv.mjs";
import { database, apiKey, baseUrl, language, total } from "./config.mjs";
import formatDate from "./utils/formatDate.mjs";
import formatTime from "./utils/formatTime.mjs";
import deleteDuplicate from "./utils/deleteDuplicate.mjs";

mongoose.connect(database, {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

const TV = mongoose.model('TV', tvModel);
let tvLength = await TV.countDocuments();
let lastIdFetched = (await TV.find({}).sort({_id: -1}).limit(1))[0].id === undefined ? 0 : (await TV.find({}).sort({_id: -1}).limit(1))[0].id;
const startTimer = Date.now();

console.log(`${logSymbols.info} Last ID fetched from Mongoose database: ${lastIdFetched}\n${logSymbols.info} Total data in Mongoose database: ${tvLength}\n`);

async function fetchData(id) {
  const url = `${baseUrl}${id}?api_key=${apiKey}&language=${language}`;
  try {
    const response = await axios.get(url);
    if (typeof response.data === "object") {
      console.log(`${logSymbols.success} Data fetched for ID ${id}`);
      return response.data;
    } else {
      console.log(`${logSymbols.error} Unexpected response data for ID ${id}: ${response.data}`);
      return null;
    }
  } catch (error) {
    console.log(`${logSymbols.error} Error fetching data for ID ${id}: ${error.message}`);
    return null;
  }
}

async function saveData(data) {
  try {
   await TV.insertMany(data);
  } catch (err) {
    console.error(`${logSymbols.error} Error saving data to Mongoose database:`, err);
    await fs.promises.writeFile(`error_${formatDate(Date())}.txt`, err)
  }
}

async function main() {
  let allData = [];
  let newDataCounter = [];
  let count = 0;
  let i;
  for (lastIdFetched ? i = lastIdFetched : i = 1; i <= total; i++) {
    const data = await fetchData(i);
    count++;

    if (data) {
      allData.push(data);
      newDataCounter.push(data);
    }

    if (count === 100) {
      await saveData(allData);
      console.log(`${logSymbols.info} Full batch saved to Mongoose database`);
      allData = [];
      count = 0;
    } else if (count < 100 && i === JSON.parse(total)) {
      await saveData(allData);
      console.log(`${logSymbols.info} Batch with ${allData.length} data saved to Mongoose database`);
      allData = [];
      count = 0;
    }

  }
  const timeElapsed = Date.now() - startTimer;

  console.log(`\n${logSymbols.success} New data: ${newDataCounter.length}`);
  console.log(`${logSymbols.info} Total data: ${tvLength + newDataCounter.length}`)
  console.log(`${logSymbols.info} Time elapsed: ${formatTime(timeElapsed)}\n`);
  fs.writeFileSync(`log_${formatDate(Date())}.txt`, `Total data: ${tvLength}\nNew data: ${newDataCounter.length}\nTime elapsed: ${formatTime(timeElapsed)}\n`);

  deleteDuplicate();
}

main();