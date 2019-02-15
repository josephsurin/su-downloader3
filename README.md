# su-downloader3 node.js HTTP downloader

![https://nodei.co/npm/su-downloader3](https://nodei.co/npm/su-downloader3.png?downloads=true&downloadRank=true&stars=true)

![https://travis-ci.org/fumetsuu/su-downloader3](https://img.shields.io/travis/fumetsuu/su-downloader3/master.svg?style=flat-square)

## Basic Usage
su-downloader3 has a very minimal API and is designed to simplify the task of downloading large files via HTTP.

```js
const path = require('path')
const { startDownload } = require('su-downloader3')

var url = 'http://ftp.iinet.net.au/pub/test/5meg.test1'
var savePath = path.join(__dirname, '5meg.test1')
var locations = { url, savePath }
var options = {
	threads: 3,
	throttleRate: 100
}

startDownload(locations, options).subscribe({
	next: progressInfo => console.log(progressInfo),
	error: e => console.log(e),
	complete: () => console.log('download has completed!')
})
```

