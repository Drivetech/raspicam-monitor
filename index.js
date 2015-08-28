"use strict"

import events from "events"
import path from "path"

import express from "express"
import dotenv from "dotenv"

dotenv.load({silent: true})

let event = new events.EventEmitter()

require("./tcp")(event)
require("./socketio")(event)

const port = process.env.PORT || 3000

const app = express()
app.use(express.static(path.join(__dirname, "public")))

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"))
})

app.listen(port, () => console.log(`Listen in localhost:${port}`))
