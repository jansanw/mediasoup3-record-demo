// Class to handle child process used for running FFmpeg

const child_process = require('child_process');
const {EventEmitter} = require('events');

const {createSdpText} = require('./sdp');
const {convertStringToStream} = require('./utils');

// const RECORD_FILE_LOCATION_PATH = process.env.RECORD_FILE_LOCATION_PATH || './files';
const MEDIA_SERVER = `127.0.0.1:${process.env.RTMP_LISTEN_PORT || 55555}`

module.exports = class FFmpeg {
    constructor(rtpParameters) {
        const r = Math.random().toString(36).slice(-8)
        this._rtmp = `rtmp://${MEDIA_SERVER}/live/${r}`;
        this.flv = `http://${MEDIA_SERVER}/live/$${r}.flv`;

        this._rtpParameters = rtpParameters;
        this._process = undefined;
        this._observer = new EventEmitter();
        this._createProcess();
    }

    _createProcess() {
        const sdpString = createSdpText(this._rtpParameters);
        const sdpStream = convertStringToStream(sdpString);

        console.log('createProcess() [sdpString:%s]', sdpString);

        this._process = child_process.spawn('ffmpeg', this._commandArgs);

        if (this._process.stderr) {
            this._process.stderr.setEncoding('utf-8');

            this._process.stderr.on('data', data =>
                console.log('ffmpeg::process::data [data:%o]', data)
            );
        }

        if (this._process.stdout) {
            this._process.stdout.setEncoding('utf-8');

            this._process.stdout.on('data', data =>
                console.log('ffmpeg::process::data [data:%o]', data)
            );
        }

        this._process.on('message', message =>
            console.log('ffmpeg::process::message [message:%o]', message)
        );

        this._process.on('error', error =>
            console.error('ffmpeg::process::error [error:%o]', error)
        );

        this._process.once('close', () => {
            console.log('ffmpeg::process::close');
            this._observer.emit('process-close');
        });

        sdpStream.on('error', error =>
            console.error('sdpStream::error [error:%o]', error)
        );

        // Pipe sdp stream to the ffmpeg process
        sdpStream.resume();
        sdpStream.pipe(this._process.stdin);
    }

    kill() {
        console.log('kill() [pid:%d]', this._process.pid);
        this._process.kill('SIGINT');
    }

    get _commandArgs() {
        let commandArgs = [
            '-loglevel',
            'debug',
            '-protocol_whitelist',
            'pipe,udp,rtp',
            '-fflags',
            '+genpts',
            '-f',
            'sdp',
            '-i',
            'pipe:0'
        ];

        commandArgs = commandArgs.concat(this._videoArgs);
        commandArgs = commandArgs.concat(this._audioArgs);

        commandArgs = commandArgs.concat([
            /*
            '-flags',
            '+global_header',
            */
            // `${RECORD_FILE_LOCATION_PATH}/${this._rtpParameters.fileName}.webm`
            // '-g',
            // '60',

            '-f',
            'flv',
            // 'rtmp://localhost:1935/live/rfBd56ti2SMtYvSgD5xAV0YU99zampta7Z7S575KLkIZ9PYk'
            // `rtmp://42.193.249.251:8156/live/stream8`
            this._rtmp,
        ]);

        console.log('commandArgs:%o', commandArgs);

        return commandArgs;
    }

    get _videoArgs() {
        return [
            '-map',
            '0:v:0',
            // '-c:v',
            // 'copy'
            '-vcodec', 'libx264', '-r', '20',
            '-preset', 'ultrafast', '-tune:v', 'zerolatency',
            '-maxrate', '10000k', '-bufsize', '1000k', '-pix_fmt', 'yuv420p', '-b:v', '400k',
            // web
            // '-c:v', 'libvpc-vp8', '-maxrate', '6000k', '-bufsize', '6000k', '-pix_fmt', 'yuv420p' // , '-c:a', 'libvorbis', '-b:v', '6000k'
        ];
    }

    get _audioArgs() {
        return [
            '-map',
            '0:a:0',
            '-strict', // libvorbis is experimental
            '-2',
            // '-c:a',
            // 'libx264',
            // 'copy'
            '-ac', '1',
            '-b:a', '64k',
        ];
    }
}

// module.exports = createRtmp = () => {
//     const r = Math.random().toString(36).slice(-8)
//     const rtmp = `rtmp://42.193.249.251:8156/live/${r}`
//     return rtmp
// }
