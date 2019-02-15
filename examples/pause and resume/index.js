const path = require('path')
const { startDownload, sudPath } = require('../../build/downloader')
const testObserver = require('../common/testObserver')

var url = 'http://ftp.iinet.net.au/pub/test/5meg.test1'
var savePath = path.join(__dirname, '5meg.test')
var locations = { url, savePath }
var options = {
	threads: 7,
	throttleRate: 50
}

var draft = console.draft()

//start the download
var dlSubscription = startDownload(locations, options).subscribe(testObserver(draft))

//pause after 1.3 seconds
setTimeout(() => dlSubscription.unsubscribe(), 1300)

//resume a further 1s later
setTimeout(() => startDownload(sudPath(savePath), options).subscribe(testObserver(draft)), 2300)
