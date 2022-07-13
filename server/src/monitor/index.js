const FFmpeg = require('./ffmpeg');
const {
    getPort,
    releasePort
} = require('./port');
const config = {
    plainRtpTransport: {
        // TODO: Change announcedIp to your external IP or domain name
        listenIp: {
            ip: process.env.MEDIASOUP_LISTEN_IP || '127.0.0.1',
            announcedIp: process.env.MEDIASOUP_ANNOUNCED_IP || '127.0.0.1'
        },
        rtcpMux: true,
        comedia: false
    }
}

class Monitor {
    constructor(peer, router) {
        this.peer = peer
        this.router = router
    }

    async start() {
        const peer = this.peer
        let rtpParameters = {};

        for (const producer of peer.producers) {
            rtpParameters[producer.kind] = await this.publishProducerRtpStream(peer, producer);
        }

        try {
            peer.process = new FFmpeg(rtpParameters);

            setTimeout(async () => {
                for (const consumer of peer.consumers) {
                    // Sometimes the consumer gets resumed before the GStreamer process has fully started
                    // so wait a couple of seconds
                    await consumer.resume();
                    await consumer.requestKeyFrame();
                }
            }, 1000);
        } catch (e) {
            console.error(e);
            this.stop();
        }
    };

    async stop() {
        const peer = this.peer
        console.log('stop() [data:%o]', peer);

        if (!peer || !peer.process) {
            throw new Error(`Peer with id \$\{peer\} is not recording`);
        }

        peer.process.kill();
        peer.process = undefined;

        // Release ports from port set
        for (const remotePort of peer.remotePorts) {
            releasePort(remotePort);
        }
    };

    async publishProducerRtpStream(peer, producer, ffmpegRtpCapabilities) {
        const router = this.router

        console.log('publishProducerRtpStream()');

        // Create the mediasoup RTP Transport used to send media to the GStreamer process
        const rtpTransportConfig = config.plainRtpTransport;

        const rtpTransport = await router.createPlainTransport(rtpTransportConfig);

        // Set the receiver RTP ports
        const remoteRtpPort = await getPort();
        peer.remotePorts.push(remoteRtpPort);

        let remoteRtcpPort;
        // If rtpTransport rtcpMux is false also set the receiver RTCP ports
        if (!rtpTransportConfig.rtcpMux) {
            remoteRtcpPort = await getPort();
            peer.remotePorts.push(remoteRtcpPort);
        }

        // Connect the mediasoup RTP transport to the ports used by GStreamer
        await rtpTransport.connect({
            ip: '127.0.0.1',
            port: remoteRtpPort,
            rtcpPort: remoteRtcpPort
        });

        peer.transports.push(rtpTransport);

        const codecs = [];
        // Codec passed to the RTP Consumer must match the codec in the Mediasoup router rtpCapabilities
        const routerCodec = router.rtpCapabilities.codecs.find(
            codec => codec.kind === producer.kind
        );
        codecs.push(routerCodec);

        const rtpCapabilities = {
            codecs,
            rtcpFeedback: []
        };

        // Start the consumer paused
        // Once the gstreamer process is ready to consume resume and send a keyframe
        const rtpConsumer = await rtpTransport.consume({
            producerId: producer.id,
            rtpCapabilities,
            paused: true
        });

        peer.consumers.push(rtpConsumer);

        return {
            remoteRtpPort,
            remoteRtcpPort,
            localRtcpPort: rtpTransport.rtcpTuple ? rtpTransport.rtcpTuple.localPort : undefined,
            rtpCapabilities,
            rtpParameters: rtpConsumer.rtpParameters
        };
    };
}

module.exports = Monitor