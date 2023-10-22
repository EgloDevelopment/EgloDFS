require(`dotenv`).config();

const express = require(`express`);
const app = express();
const multer = require(`multer`);
const upload = multer({ dest: __dirname + `/temporary` });
const { MongoClient } = require(`mongodb`);
const client = new MongoClient(process.env.MONGODB_URL);
const { v4: uuidv4 } = require(`uuid`);
const splitFile = require(`split-file`);
const fs = require(`fs`);
const { Readable } = require("stream");
const { finished } = require("stream/promises");
const { Client, GatewayIntentBits } = require(`discord.js`);
const cron = require("node-cron");

const { deleteOldFiles } = require(`./helpers`);

cron.schedule("* * * * *", () => {
  console.log(`⏲️   Clearing temporary files ${Date.now()} (UNIX)`);
  deleteOldFiles(__dirname + `/temporary`);
});

app.use(express.json());

const discordBot = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages],
});

app.get(`/`, (req, res) => {
  res.status(200).send({ status: `OK` });
});

app.post(`/upload`, upload.single(`file`), async (req, res) => {
  try {
    const channel = await discordBot.channels.fetch(
      process.env.DISCORD_CHANNEL_ID
    );

    url_array = [];
    files_to_delete_locations_array = [];

    const split_file_locations = await splitFile.splitFileBySize(
      __dirname + `/temporary/` + req.file.filename,
      19000000
    );

    files_to_delete_locations_array.push(
      __dirname + `/temporary/` + req.file.filename
    );

    for (const file of split_file_locations) {
      const message = await channel.send({ files: [file] });
      url_array.push(message.attachments.first().attachment);
      files_to_delete_locations_array.push(file);
    }

    const file_id = uuidv4();
    const time_uploaded = Date.now();

    await client.db(`EDFS`).collection(`Files`).insertOne({
      id: file_id,
      time_uploaded: time_uploaded,
      original_name: req.file.originalname,
      urls: url_array,
    });

    try {
      files_to_delete_locations_array.forEach(
        (path) => fs.existsSync(path) && fs.unlinkSync(path)
      );
    } catch {
      console.log(`Failed to delete some files`);
    }

    res.status(200).send({
      status: `OK`,
      id: file_id,
      original_name: req.file.originalname,
      time_uploaded: time_uploaded,
    });
  } catch (e) {
    console.log(e);
    res.status(500).send({ error: `Internal server error` });
  }
});

app.get(`/download`, async (req, res) => {
  try {
    const file = await client.db(`EDFS`).collection(`Files`).findOne({
      id: req.query.file_id,
    });

    downloaded_files_locations_array = [];

    let file_location = uuidv4();

    for (const file_url of file.urls) {
      let unique_id = uuidv4();
      const res = await fetch(file_url);
      const fileStream = fs.createWriteStream(
        `${__dirname}/temporary/${unique_id}.${file.original_name
          .split(`.`)
          .pop()}`,
        { flags: "wx" }
      );
      downloaded_files_locations_array.push(
        `${__dirname}/temporary/${unique_id}.${file.original_name
          .split(`.`)
          .pop()}`
      );
      await finished(Readable.from(res.body).pipe(fileStream));
    }

    await splitFile
      .mergeFiles(
        downloaded_files_locations_array,
        `${__dirname}/temporary/${file_location}.${file.original_name
          .split(`.`)
          .pop()}`
      )
      .then((location) => {
        res.status(200).download(location, file.original_name);
      });
  } catch (e) {
    console.log(e);
    res.status(500).send({ error: `Internal server error` });
  }
});

async function Init() {
  try {
    await client.connect();
    console.log(`🎉  Connected to MongoDB`);

    app.listen(6969, () => {
      console.log(`💻  EDFS listening on port 6969`);
    });

    discordBot.on(`ready`, () => {
      console.log(`💾  Discord bot is online`);
    });

    discordBot.login(process.env.DISCORD_BOT_TOKEN);
  } catch (e) {
    console.error(e);
  }
}

Init();
