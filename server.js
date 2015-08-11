"use strict"

import path from "path"
import fs from "fs"

import express from "express"
import dotenv from "dotenv"
import mkdirp from "mkdirp"
import moment from "moment"
import recursive from "recursive-readdir"
import socketio from "socket.io"

dotenv.load({silent: true})
const port = process.env.PORT || 3000
let streams = {}
let sockets = {}

const app = express()
app.use(express.static(path.join(__dirname, "public")))
const io = socketio(5000)

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"))
})

function prepareDir(dir, cb) {
  fs.exists(dir, (exist) => {
    if (!exist) mkdirp(dir, (cb()))
    cb()
  })
}

io.on("connection", (socket) => {

  // Nueva camara conectada
  socket.on("init", (id) => {
    socket.join(id)
    streams[id] = {}
    sockets[socket.id] = id
    io.emit("new camera", id)
  })

  socket.on("get all", () => {
    recursive(path.join(__dirname, "public", "videos"), (err, files) => {
      let videos = []
      if (!err) {
        videos = files.map(file => {
          const name = file.split(`/videos/`)[1]
          const dir = path.basename(path.dirname(file))
          return {id: dir, video: name}
        })
      }
      socket.emit("videos", videos)
      const cameras = Object.keys(sockets).map(i => sockets[i])
      socket.emit("cameras", cameras)
    })
  })

  // Solicitud para iniciar grabación
  socket.on("camera start", (id) => {
    const basePath = path.join(__dirname, "public", "videos", id)
    const date = moment().format("YYYY-MM-DD_HH:mm:ss")
    const filename = path.join(basePath, `${date}.mp4`)
    prepareDir(basePath, () => {
      streams[id] = {stream: fs.createWriteStream(filename), path: filename}
      io.to(id).emit("start")
    })
  })

  // Solicitud para detener grabación
  socket.on("camera stop", (id) => {
    io.to(id).emit("stop")
  })

  // Trozos del video enviado desde una camara
  socket.on("chunk", ({id, chunk}) => {
    streams[id].stream.write(chunk, (err) => {
      if (err) streams[id].stream.end()
    })
  })

  // Grabación finalizada, se almacena el video
  socket.on("end", (id) => {
    streams[id].stream.end()
    const filename = path.basename(streams[id].path)
    io.emit("ready", {id: id, path: path.join(id, filename)})
  })

  socket.on("disconnect", () => {
    if (sockets[socket.id]) {
      io.emit("camera disconnect", sockets[socket.id])
    }
  })
})

app.listen(port, () => console.log(`Listen in localhost:${port}`))
