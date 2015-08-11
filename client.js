"use strict"

import fs from "fs"
import {spawn} from "child_process"

import dotenv from "dotenv"
import io from "socket.io-client"
import uuid from "uuid"

dotenv.load({silent: true})
const host = process.env.SOCKETIO_HOST || "127.0.0.1"
const port = process.env.SOCKETIO_PORT || 5000
const cameraId = process.env.CAMERA_ID || uuid.v4()
let raspivid

const socket = io.connect(`http://${host}:${port}`)

socket.on("connect", () => {
  console.log("Connect to server")
  socket.emit("init", cameraId)
})

// Evento que inicia la grabación
socket.on("start", () => {
  const raspividArgs = [
    "-t", "99999999",
    "-w", "800",
    "-h", "600",
    "-o", "-"
  ]
  // Proceso para capturar el video en h264
  raspivid = spawn("raspivid", raspividArgs)
  const avconvArgs = [
    "-i", "pipe:0",
    "-c", "copy",
    "-r", "30",
    "-f", "mp4",
    "-movflags", "frag_keyframe",
    "pipe:1"
  ]
  // Proceso para pasar el video a mp4
  const avconv = spawn("avconv", avconvArgs)
  // COnecto la salida de raspivid a la entrada de avconv
  raspivid.stdout.pipe(avconv.stdin)
  const outputFile = fs.createWriteStream("./output.h264")
  // Se guarda el mp4 en disco
  avconv.stdout.pipe(outputFile)
  outputFile.on("finish", () => {
    // Se lee el mp4 almacenado
    const readFile = fs.createReadStream("./output.h264")
    readFile.on("data", (data) => {
      // Se emite los datos del mp4
      socket.emit("chunk", {id: cameraId, chunk: data})
    })
    // Notifica que el proceso finalizo
    readFile.on("end", () => socket.emit("end", cameraId))
  })
})

// Evento que detiene la grabación
socket.on("stop", () => {
  raspivid.kill()
})
