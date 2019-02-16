# su-downloader3 - A node.js HTTP downloader

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
[More examples](https://github.com/fumetsuu/su-downloader3/tree/master/examples)

## Overview
su-downloader3 is a node.js downloader library that facilitates the downloading of files via http/s requests. It is based around the [request](https://github.com/request/request) package and has inbuilt support for pausing/resuming (even after the process has exited), downloading using multiple concurrent requests (faster download speeds), and monitoring download progress.

There are two parts to the library; the downloader and the scheduler.

### The downloader
The downloader is the core of su-downloader3. It's API consists only of the `startDownload` function which returns an [observable](http://reactivex.io/rxjs/class/es6/Observable.js%7EObservable.html). In order for the download to begin, this observable must be subscribed to. The meta data for the download and the download's progress info will be emitted by the observable.

### The scheduler
The scheduler acts as an interface between the user and the downloader to manage multiple download tasks. It implements a FIFO queue data structure to allow the user to queue tasks, have them start automatically, and to limit the number of active downloads. The scheduler maintains a list of the download tasks, with each task being identified by a unique key provided when queueing the download. The scheduler also maintains a list containing the subscriptions for each active download. This removes the need for the user to subscribe to the observable returned by the downloader's `startDownload` function. Instead, they provide an observer object to the scheduler when queueing a download, and the scheduler will subscribe to the observable when the download is started.
The scheduler can be configured to use a default download options object which applies to all downloads made through it. Options provided as a parameter will override the default options.

## API
If you are using the scheduler, you should never need to call the `startDownload` function. Instead, queue the download using the scheduler's `queueDownload` instance method, and then the `startDownload` instance method.
### startDownload(locations, options) => Observable
The download begins when the returned observable is subscribed to by the user.
| Param | Type | Default | Description |
| --- | --- | --- | --- |
| locations | `object` or `string` | | If string, `locations` should be either a download url or an existing `.sud` path. |
| locations.url | `string` | | url to download file from |
| locations.savePath | `string` | | Path (including filename) to save the file to |
| locations.saveDir	| `string` | | Directory to save the file to |

Note: Only one of `locations.savePath` and `locations.saveDir` need to be defined. If both are defined, the file is saved to the path given by `locations.savePath` and `locations.saveDir` is ignored.
If no save path is provided, the file will be saved to the current working directory with a filename determined by the url. e.g. `http://download.location/file.zip` will save the file to `./file.zip`.
If the save dir is provided, the file will be saved to that directory with the filename being determined as described above.