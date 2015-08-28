"use strict"

import path from "path"
import fs from "fs"

import mkdirp from "mkdirp"
import recursive from "recursive-readdir"
import {Server} from "ws"

let streams = {}
let sockets = {}
const WEBSOCKET_PORT = 8084
const STREAM_MAGIC_BYTES = "jsmp"
const width = 640
const height = 480

export default function socketio (event) {
  function prepareDir(dir, cb) {
    fs.exists(dir, (exist) => {
      if (!exist) mkdirp(dir, (cb()))
      cb()
    })
  }


  const io = require("socket.io")(5000)
  const socketServer = new Server({port: WEBSOCKET_PORT})

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
            return {id: dir, video: name, name: name}
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
      prepareDir(basePath, () => {
        event.emit("start")
      })
    })

    // Solicitud para detener grabación
    socket.on("camera stop", () => {
      event.emit("stop")
    })

    event.on("new video", (data) => {
      io.emit("new video", {id: 1, path: data, name: path.basename(data)})
    })

    socket.on("disconnect", () => {
      if (sockets[socket.id]) {
        io.emit("camera disconnect", sockets[socket.id])
      }
    })

  })

  socketServer.on("connection", (socket) => {
    // Send magic bytes and video size to the newly connected socket
    // struct { char magic[4]; unsigned short width, height;}
    var streamHeader = new Buffer(8)
    streamHeader.write(STREAM_MAGIC_BYTES)
    streamHeader.writeUInt16BE(width, 4)
    streamHeader.writeUInt16BE(height, 6)
    socket.send(streamHeader, {binary: true})

    console.log(`New WebSocket Connection (${socketServer.clients.length} total)`)

    socket.on("close", () => {
      console.log(`Disconnected WebSocket (${socketServer.clients.length} total)`)
    })
  })

  socketServer.broadcast = function(data, opts) {
    for (let client of this.clients) {
      if (client.readyState === 1) {
        client.send(data, opts)
      } else {
        console.log(`Error: Client (${client}) not connected.`)
      }
    }
  }

  event.on("data", (data) => {
    socketServer.broadcast(data, {binary: true})
  })
}
