"use strict"

import domify from "domify"
import io from "socket.io-client"
import Jsmpeg from "./jsmpeg"
import videojs from "video.js/dist/video-js/video.js"
require("video.js/dist/video-js/video-js.css")

const host = process.env.SOCKETIO_HOST || "localhost"
const socket = io.connect(`http://${host}:5000`)

const canvas = document.getElementById("videoCanvas")

// Evento para iniciar/detener la grabación
function onClick(event) {
  if (event.target.className === "glyphicon glyphicon-record") {
    socket.emit("camera start", event.target.dataset.id)
    event.target.className = "glyphicon glyphicon-stop"
    canvas.style.display = "block"
  } else if (event.target.className === "glyphicon glyphicon-stop") {
    socket.emit("camera stop", event.target.dataset.id)
    event.target.className = "glyphicon glyphicon-record"
    canvas.style.display = "none"
  }
}

// Solicita las camaras conectadas y videos almacenados
function onConnect() {
  socket.emit("get all")
  const li = domify(`<li id="camera-${1}">
      <div class="btn-group">
        <button class="btn btn-default cameras">
          Camera #${1}
        </button>
        <button class="btn btn-danger">
          <span data-id="${1}" class="glyphicon glyphicon-record"></span>
        </button>
      </button>
    </li>`)
  const ul = document.getElementById("cameras")
  while (ul.firstChild) {
    ul.removeChild(ul.firstChild)
  }
  ul.appendChild(li)
  li.addEventListener("click", onClick)
}

// Agrega nuevas camaras
function onNewCamera(id) {
  if (!document.getElementById(`camera-${id}`)) {
    const li = domify(`<li id="camera-${id}">
        <div class="btn-group">
          <button data-id="${id}" class="btn btn-default cameras">
            Camera #${id}
          </button>
          <button class="btn btn-danger">
            <span class="glyphicon glyphicon-record"></span>
          </button>
        </button>
      </li>`)
    const ul = document.getElementById("cameras")
    ul.appendChild(li)
    li.addEventListener("click", onClick)
  }
}

// Agrega nuevos videos
function onReady({id, path}) {
  if (!document.getElementById(`video-${path}`)) {
    const li = domify(`<li id="video-${path}" data-video="${path}">
      <button class="btn btn-default" data-video="${path}">${path}</button></li>`)
    const ul = document.getElementById("videos")
    ul.appendChild(li)
    li.addEventListener("click", onClickVideos)
  }
}

// Reproducir video almacenado
function onClickVideos(event) {
  const vplayer = videojs("player", { /* Options */ }, function() {
    this.play()
  })
  vplayer.src([{type: "video/webm", src: event.target.dataset.video}])
  vplayer.play()
}

// Quita camara en caso de desconectarse
function onDisconnect(id) {
  const cameras = document.getElementById("cameras")
  const camera = document.querySelector(`[data-id="${id}"]`)
  cameras.removeChild(camera)
}

// Lista de videos
function onVideos(data) {
  data.map(d => onReady({id: d.id, path: d.video}))
}

// Lista de camaras conectadas
function onCameras(data) {
  data.map(d => onNewCamera(d))
}

let ctx = canvas.getContext("2d")
ctx.fillStyle = "#444"
ctx.fillText("Loading...", canvas.width / (2 - 30), canvas.height / 3)
const client = new WebSocket(`ws://${host}:8084/`)
const player = new Jsmpeg(client, {canvas: canvas})

socket.on("connect", onConnect)
socket.on("new camera", onNewCamera)
socket.on("new video", onReady)
socket.on("camera disconnect", onDisconnect)
socket.on("videos", onVideos)
socket.on("cameras", onCameras)
