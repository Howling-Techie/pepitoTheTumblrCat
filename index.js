import axios from "axios";
import * as fs from "fs";
import * as path from "path";
import * as stream from "stream";
import {promisify} from "util";
import EventSource from "eventsource";

import {config} from "dotenv";
import tumblr from "tumblr.js";

config();

// Authenticate via OAuth
console.log("Loading...");
const client = tumblr.createClient({
    consumer_key: process.env.CONSUMER_KEY,
    consumer_secret: process.env.CONSUMER_SECRET,
    token: process.env.TOKEN,
    token_secret: process.env.TOKEN_SECRET
});


const pipeline = promisify(stream.pipeline);

const createPost = async (text, imageURL, tags) => {
    try {
        // Fetch the image data from the URL
        const response = await axios({
            url: imageURL,
            method: "GET",
            responseType: "stream",
        });

        // Create a temporary file path to save the image
        const tempFilePath = path.join(__dirname, "temp_image.jpg");

        // Save the image stream to a temporary file
        await pipeline(response.data, fs.createWriteStream(tempFilePath));

        // Create a ReadStream object from the temporary file
        const imageData = fs.createReadStream(tempFilePath);

        // Send image data
        await client.createPost("pepitothecat", {
            content: [
                {
                    type: "text",
                    text: text,
                },
                {
                    type: "image",
                    media: imageData,
                    alt_text: text,
                },
            ],
            tags: tags
        });

        // Clean up the temporary file after upload
        fs.unlinkSync(tempFilePath);
    } catch (error) {
        console.error("Error creating post:", error);
    }
};

const pepitoSource = new EventSource("https://api.thecatdoor.com/sse/v1/events");
pepitoSource.onmessage = (event) => {
    const data = JSON.parse(event.data);
    const time = new Date(data.time * 1000);
    const pepitoTime = `${((time.getUTCHours() + 2) % 24).toString().padStart(2, "0")}:${time.getMinutes().toString().padStart(2, "0")}:${time.getSeconds().toString().padStart(2, "0")}`;
    // If it's Pepito, let the world know!
    if (data.event === "pepito")
        switch (data.type) {
            case "in":
                createPost(`Pépito is back home at ${pepitoTime}`, data.img, ["pepito", "pepito the cat", "pepito is in"]);
                break;
            case "out":
                createPost(`Pépito is out at ${pepitoTime}`, data.img, ["pepito", "pepito the cat", "pepito is out"]);
                break;
        }
};

console.log("Waiting for Pepito...");