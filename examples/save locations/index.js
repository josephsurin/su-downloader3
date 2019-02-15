const path = require('path')
const {	startDownload } = require('../../build/downloader')
const testObserver = require('../common/testObserver')

var options = {
	threads: 4,
	throttleRate: 1
}

/* Save location type 1: specify path to save file to (savePath) */ 
//file will save to this examples directory with the filename '5meg.test1'
var locations1 = {
	url: 'http://ftp.iinet.net.au/pub/test/5meg.test1',
	savePath: path.join(__dirname, '5meg.test1')
}

/* Save location type 2: specify directory to save file to (filename determined based on url) */
//file will save to this examples directory with the filename '5meg.test2'
var locations2 = {
	url: 'http://ftp.iinet.net.au/pub/test/5meg.test2',
	saveDir: __dirname
}

/* Save location type 3: Specify nothing (saves file to directory where command is executed with filename determine based on url) */
//file will save to the directory from which the example was run with the filename '5meg.test3'
var locations3 = 'http://ftp.iinet.net.au/pub/test/5meg.test3' //single string is fine

startDownload(locations1, options).subscribe(testObserver(console.draft('starting download for save location type 1')))
console.log('\n')

startDownload(locations2, options).subscribe(testObserver(console.draft('starting download for save location type 2')))
console.log('\n')

startDownload(locations3, options).subscribe(testObserver(console.draft('starting download for save location type 3')))