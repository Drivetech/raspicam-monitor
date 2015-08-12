"use strict"

import domify from "domify"
import io from "socket.io-client"

const host = process.env.SOCKETIO_HOST || "localhost"
const socket = io.connect(`http://${host}:5000`)

// Evento para iniciar/detener la grabación
function onClick(event) {
  if (event.target.innerHTML === "start") {
    socket.emit("camera start", event.target.dataset.id)
    event.target.innerHTML = "stop"
  } else {
    socket.emit("camera stop", event.target.dataset.id)
    event.target.innerHTML = "start"
  }
}

// Solicita las camaras conectadas y videos almacenados
function onConnect() {
  socket.emit("get all")
}

// Agrega nuevas camaras
function onNewCamera(id) {
  if (!document.getElementById(`camera-${id}`)) {
    const li = domify(`<li id="camera-${id}">Camera #${id}
        <a href="#" data-id="${id}" class="cameras">start</a>
      </li>`)
    const ul = document.getElementById("cameras")
    ul.appendChild(li)
    li.addEventListener("click", onClick)
  }
}

// Agrega nuevos videos
function onReady({id, path}) {
  if (!document.getElementById(`video-${path}`)) {
    const li = `<li id="video-${path}">
      <a href="/videos/${path}" data-id="${id}">${path}</a></li>`
    const ul = document.getElementById("videos")
    ul.appendChild(domify(li))
  }
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

socket.on("connect", onConnect)
socket.on("new camera", onNewCamera)
socket.on("ready", onReady)
socket.on("camera disconnect", onDisconnect)
socket.on("videos", onVideos)
socket.on("cameras", onCameras)
