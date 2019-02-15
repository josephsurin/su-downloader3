const path = require('path')
const { startDownload } = require('../../build/downloader')
const testObserver = require('../common/testObserver')

var url = 'http://ftp.iinet.net.au/pub/test/5meg.test1'
var savePath = path.join(__dirname, '5meg.test')
var locations = { url, savePath }
var options = {
	threads: 3,
	throttleRate: 100
}

startDownload(locations, options).subscribe(testObserver(console.draft()))