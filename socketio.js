"use strict"

import path from "path"
import fs from "fs"

import mkdirp from "mkdirp"
import {Server} from "ws"
import s3 from "s3"

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
      const client = s3.createClient({
        maxAsyncS3: 20,
        s3RetryCount: 3,
        s3RetryDelay: 1000,
        multipartUploadThreshold: 20971520,
        multipartUploadSize: 15728640,
        s3Options: {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
          Bucket: process.env.AWS_STORAGE_BUCKET_NAME
        }
      })
      const stagingparams = {
        s3Params: {
          Bucket: process.env.AWS_STORAGE_BUCKET_NAME
        },
        recursive: true
      }
      const listobj = client.listObjects(stagingparams)
      let dataLst = []
      listobj.on("data", (data) => {
        dataLst = dataLst.concat(data.Contents)
      })
      listobj.on("error", (err) => {
        console.error(err)
      })
      listobj.on("end", () => {
        if (listobj.progressAmount === 1) {
          dataLst = dataLst.filter(x => x.Key.endsWith(".webm"))
          dataLst = dataLst.map(x => {
            return {
              video: s3.getPublicUrl(
                process.env.AWS_STORAGE_BUCKET_NAME, x.Key),
              name: path.basename(x.Key),
              id: path.dirname(x.Key)
            }
          })
          socket.emit("videos", dataLst)
          const cameras = Object.keys(sockets).map(i => sockets[i])
          socket.emit("cameras", cameras)
        }
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
