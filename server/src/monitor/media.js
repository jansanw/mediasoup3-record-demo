const NodeMediaServer = require('node-media-server')

const config = {
    rtmp: {
        port: process.env.RTMP_LISTEN_PORT || 55555,
        chunk_size: 60000,
        gop_cache: true,
        ping: 60,
        ping_timeout: 120
    },
    http: {
        port: process.env.MEDIA_LISTEN_PORT || 8182,
        allow_origin: '*'
    }
}


const nms = new NodeMediaServer(config)

nms.run()
