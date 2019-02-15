const path = require('path')
const SuDScheduler = require('../../build/scheduler')
const { sudPath } = require('../../build/downloader/index')
const testObserver = require('../common/testObserver')

var url = 'http://ftp.iinet.net.au/pub/test/5meg.test1'
var savePath = i => path.join(__dirname, `5meg${i}.test`)
var locations = i => { return { url, savePath: savePath(i) }}
var options = {
	threads: 4,
	throttleRate: 50
}

var schedulerOptions = {
	autoStart: true,
	maxConcurrentDownloads: 2,
	downloadOptions: options //default download options
}

const suDScheduler = new SuDScheduler(schedulerOptions)

suDScheduler.queueDownload(locations(1), testObserver(console.draft()))
console.log('\n')

suDScheduler.queueDownload(locations(2), testObserver(console.draft()))
console.log('\n')

suDScheduler.queueDownload(locations(3), testObserver(console.draft()))

//stop download 1 after 1s, download 3 will start downloading once download 1 is stopped
setTimeout(() => suDScheduler.pauseDownload(sudPath(savePath(1)), true), 1000)

//stop all downloads after a further 3s
setTimeout(() => suDScheduler.pauseAll(true), 4000)

//start download 1 and let the queue run after a further 0.5s
setTimeout(() => suDScheduler.startDownload(sudPath(savePath(1))), 4500)

//start the queue again after a further 2s
setTimeout(() => suDScheduler.startQueue(), 6500)