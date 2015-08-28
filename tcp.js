"use strict"

import net from "net"
import fs from "fs"
import path from "path"
import moment from "moment"
import ffmpeg from "fluent-ffmpeg"
import s3 from "s3"

export default function tcp (event) {
  const server = net.createServer()
  let ws, filename, filename2
  const r = /finish/i

  const client = s3.createClient({
    maxAsyncS3: 20,
    s3RetryCount: 3,
    s3RetryDelay: 1000,
    multipartUploadThreshold: 20971520,
    multipartUploadSize: 15728640,
    s3Options: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
    }
  })

  server.on("connection", socket => {
    socket.name = `${socket.remoteAddress}:${socket.remotePort}`

    socket.on("data", (data) => {
      if (r.test(data.toString())) {
        ws.end()
        let oldfile = filename
        ffmpeg(filename)
        .noAudio()
        .videoCodec("libvpx")
        .on("error", (err) => {
          console.log(`An error occurred: ${err.message}`)
        })
        .on("end", () => {
          const id = path.basename(path.dirname(filename2))
          const fname = path.basename(filename2)
          const params = {
            localFile: filename2,
            s3Params: {
              Bucket: process.env.AWS_STORAGE_BUCKET_NAME,
              Key: `${id}/${fname}`,
              ACL: "public-read"
            }
          }
          const uploader = client.uploadFile(params)
          uploader.on("error", (err) => {
            console.error("unable to upload:", err.stack)
          })
          uploader.on("end", () => {
            fs.unlink(oldfile, () => {
              console.log("done uploading")
              const oname = s3.getPublicUrl(
                process.env.AWS_STORAGE_BUCKET_NAME, `${id}/${fname}`)
              event.emit("new video", oname)
            })
          })
        })
        .save(filename2)
      } else {
        event.emit("data", data)
        ws.write(data)
      }
    })

    // Remove the client from the list when it leaves
    socket.on("end", () => {
      console.log(`${socket.name} left the chat.\n`)
    })

    event.on("start", () => {
      filename = path.join(__dirname, "public", "videos", "1", `${moment().format("YYYYMMDDHHmmss")}.mpeg`)
      filename2 = path.join(__dirname, "public", "videos", "1", `${moment().format("YYYYMMDDHHmmss")}.webm`)
      ws = fs.createWriteStream(filename)
      socket.write("record")
    })

    event.on("stop", () => {
      socket.write("stop")
    })
  })

  server.listen(5005, function() {
    console.log("Net server running on port: 5005")
  })
}
