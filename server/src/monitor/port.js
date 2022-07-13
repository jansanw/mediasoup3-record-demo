// Port used for the gstreamer process to receive RTP from mediasoup 

// const MIN_PORT = 20000;
// const MAX_PORT = 30000;
const MIN_PORT = process.env.MEDIASOUP_MIN_PORT || 40000;
const MAX_PORT = process.env.MEDIASOUP_MAX_PORT || 49999;
const TIMEOUT = 400;

const takenPortSet = new Set();

module.exports.getPort = async () => {
    let port = getRandomPort();

    while (takenPortSet.has(port) || await portIsOccupied(port)) {
        port = getRandomPort();
    }

    takenPortSet.add(port);

    return port;
};

module.exports.releasePort = (port) => takenPortSet.delete(port);

const getRandomPort = () => Math.floor(Math.random() * (MAX_PORT - MIN_PORT + 1) + MIN_PORT);

const net = require('net')

const portIsOccupied = (port) => {
    const server = net.createServer().listen(port)
    return new Promise((resolve, reject) => {
        server.on('listening', () => {
            // console.log(`the server is runnint on port ${port}`)
            server.close();
            resolve(false)
        })

        server.on('error', (err) => {
            resolve(true);
            // if (err.code === 'EADDRINUSE') {
            //     resolve(portIsOccupied(port + 1))//注意这句，如占用端口号+1
            //     console.log(`this port ${port} is occupied.try another.`)
            // } else {
            //     reject(err)
            // }
        })
    })
}
