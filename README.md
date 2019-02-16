# su-downloader3 - A node.js HTTP downloader

[![npmjs](https://nodei.co/npm/su-downloader3.png?downloads=true&downloadRank=true&stars=true)](https://www.npmjs.com/package/su-downloader3)

[![travis.ci](https://img.shields.io/travis/fumetsuu/su-downloader3/master.svg?style=flat-square)](https://travis-ci.org/fumetsuu/su-downloader3)

## Table of Contents
- [Basic Usage](#basic-usage)
- [Overview](#overview)
	- [The downloader](#the-downloader)
	- [The scheduler](#the-scheduler)
- [API](#api)
- [Design](#design)


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

<a name="startDownload">
### startDownload(locations, options) => Observable
</a>
The download begins when the returned observable is subscribed to by the user.

| Param | Type | Default | Description |
| --- | :---: | :---: | --- |
| locations | `object` or `string` | | If string, `locations` should be either a download url or an existing `.sud` path. |
| locations.url | `string` | | url to download file from |
| locations.savePath | `string` | | Path (including filename) to save the file to |
| locations.saveDir	| `string` | | Directory to save the file to |
| options | `object` | | Download options |
| options.threads | `integer` | `4` | The number of segments to break the file into
| options.timeout | `integer` | `18000` | How long to wait without receiving data before aborting download, in milliseconds
| options.headers | `object` | | Custom HTTP headers
| options.throttleRate | `integer` | `500` | Minimum time interval between successive emissions of download progress info, in milliseconds |

Note: Only one of `locations.savePath` and `locations.saveDir` need to be defined. If both are defined, the file is saved to the path given by `locations.savePath` and `locations.saveDir` is ignored.
If no save path is provided, the file will be saved to the current working directory with a filename determined by the url. e.g. `http://download.location/file.zip` will save the file to `./file.zip`.
If the save dir is provided, the file will be saved to that directory with the filename being determined as described above.

To pause a download started using the `startDownload` function, the user must call the `unsubscribe` instance method on the subscription made to the observable returned by the `startDownload` function. See [here](https://github.com/fumetsuu/su-downloader3/blob/master/examples/pause%20and%20resume/index.js) for an example.

The returned observable emits the meta data of the download on its first emission. Subsequent emissions contain the download progress info which is an object that looks like:
```js
{
	time: {
		start //timestamp
		elapsed //milliseconds
		eta //seconds
	},
	total: {
		filesize //bytes
		downloaded //bytes
		percentage //real number between 0 and 100
	},
	speed //bytes per second
	avgSpeed //bytes per second
	threadPositions //array of bytes
}
```
`speed` is calculated by finding the change in `downloaded` with respect to a small change in `elapsed`. Because of this, if the `throttleRate` is particularly low, `speed` will likely fluctuate.

### SuDScheduler(schedulerOptions) => SuDScheduler
Instantiates a new SuDScheduler instance with the given options.

| Param | Type | Default | Description |
| --- | :---: | :---: | --- |
| schedulerOptions | `object` | | Scheduler options |
| schedulerOptions.autoStart | `boolean` | `true` | Whether or not to automatically start downloading queued download tasks |
| schedulerOptions.maxConcurrentDownloads | `integer` | `4` | Maximum number of downloads at any single time. Set this to `0` for unlimited concurrent downloads |
| schedulerOptions.downloadOptions | `object` | | Default download options to be used for downloads if not provided (see [`startDownload`](#startDownload))

A SuDScheduler instance's options can be accessed and written to at any time by setting the properties of the SuDScheduler.option object.

### SuDScheduler.queueDownload(key, locations, [options], userObserver) => object or true
Adds a new download task to the end of the queue.

| Param | Type | Default | Description |
| --- | :---: | :---: | --- |
| key | `string` | | Unique identifier for each download task. Required |
| locations | `object` | | Same as the `locations` parameter for [`startDownload`](#startDownload) |
| options | `object` | | Same as the `options` parameter for [`startDownload`](#startDownload) |
| userObserver | `object` | | Can be the 3rd or 4th positional argument. The `userObserver` object must have a `next`, `error` and `complete` fields which are functions. Required |

If the scheduler has `autoStart` set to true, `true` will be returned if a download task is successfully queued.
If the scheduler has `autoStart` set to false, a convenience object containing a `start` method will be returned so that the user may simply dot chain `start()` or easily start the download whenever they need.

### SuDScheduler.startDownload(key) => true
Starts a new download, or resumes an active download. Starting a new download task using this method ignores the `maxConcurrentDownloads` limit.

| Param | Type | Default | Description |
| --- | :---: | :---: | --- |
| key | `string` | | Unique identifier for an existing download task.

### SuDScheduler.pauseDownload(key, stop) => false or undefined
Pauses or stops a download task.

| Param | Type | Default | Description |
| --- | :---: | :---: | --- |
| key | `string` | | Unique identifier for a download task |
| stop | `boolean` | `false` | Whether to stop or just pause the download |

A paused download is considered active.
Thus, if the download is paused, i.e. `stop` is `false`, then new downloads will not be automatically started if the max concurrency limit is already reached.
If the download is stopped, i.e. `stop` is `true`, then the next queued download will start (given that `autoStart` is set to true).
`false` is returned if the provided key does not match any download tasks, or if the download is not currently downloading.

### SuDScheduler.killDownload(key) => undefined
Stops a download (if active) and removes associated `.sud` and `.PARTIAL` files, OR, removes a queued download task from queue.

| Param | Type | Default | Description |
| --- | :---: | :---: | --- |
| key | `string` | | Unique identifier for a download task |

Note: This method is synchronous.

### SuDScheduler.startQueue() => undefined
Starts as many download tasks as possible, limited by the maxConcurrentDownloads option.

### SuDScheduler.pauseAll(stop) => undefined
Pauses or stops all download tasks.

| Param | Type | Default | Description |
| --- | :---: | :---: | --- |
| stop | `boolean` | `false` | Whether to stop or just pause the download |

### Read only properties

#### SuDScheduler.taskQueue => array
The queue of download tasks.

#### SuDScheduler.queuedCount => integer
The number of queued tasks.

#### SuDScheduler.activeCount => integer
The number of active tasks.

#### SuDscheduler.stoppedCount => integer
The number of stopped tasks.

#### SuDScheduler.taskCount => integer
The total number of tasks.

The following utility functions are also exposed for convenience:

#### killFiles(sudPath) => boolean
Synchronously removes all `.sud` and `.PARTIAL` files associated with the `sudPath`.

| Param | Type | Default | Description |
| --- | :---: | :---: | --- |
| sudPath | `string` | | Path to an existing `.sud` file |

If `sudPath` does not exist or is invalid, `false` is returned.
If the files are successfully deleted, `true` is returned.

#### sudPath(savePath) => string
Returns the `.sud` file associated with the given save path.

| Param | Type | Default | Description |
| --- | :---: | :---: | --- |
| savePath | `string` | | Save path of a download |

This function simply appends `.sud` to `savePath`.

## Design
su-downloader3 uses [Rxjs](https://github.com/ReactiveX/rxjs/) to handle streams of data.

There are 4 stages involved with the download process. In each stage, the observable is transformed in some way.

Stage 1: A HEAD request is made to get the file size, which is used to create and write the meta data.
Stage 2: The GET requests are made based on the meta data.
Stage 3: The data from the GET requests are written to the `.PARTIAL` files and the position of each thread is updated. The rebuilding of files is set up.
Stage 4: The download progress info is created based on the thread positions and meta data.

#### Stage 1
The observable returned by `startDownload` is an observable chain that begins with a HEAD request to the url to get its file size.
The file size (and other values provided, such as the url, save path and threads) is then transformed to the meta object which is written to the `.sud` file as a side effect. Since the meta object is emitted through the observable, it doesn't matter that the `.sud` file is written as a side effect as opposed to within the observable chain since it won't be used; it's only purpose is for resuming previous downloads.

#### Stage 2
GET requests will then be made based on the meta data. In particular, the `Range` header is set so that only a particular range of bytes is downloaded for each request. These ranges are calculated based on the file size and the number of threads being used. The meta data is mapped to an object holding an array of these request observables and the plain meta data object.

#### Stage 3
The request observables and meta data object are then mapped to an observable (using `concatMap`) which emits the meta data on its first emission and then the thread positions of any single thread thereafter. Within this `concatMap`, the data is written to disk. This has to be done within the observable chain as opposed to a side effect as delays in I/O can cause corrupted files or cause the rebuilding process to fail. For this same reason, the rebuilding process is also done within the observable chain, after all the request observables have finished (this is done by using `concat` to concatenate the rebuild observable with a flattened requests higher order observable). Note that although the rebuilding process is set up during this stage, the observable that is concatenated to the flattened requests higher order observable that actually performs the rebuilding of files is only subscribed to once the requests higher order observable has finished.

#### Stage 4
The final step is to generate the download progress info based on the thread positions. The observable up to this point currently emits SINGLE thread positions on each emission, e.g. `1995135`, `4331582`, `1996443`... The goal is to track the positions of ALL threads after each emission. To do this, the meta data is used to calculate which thread a certain thread position belongs to (e.g. a thread position of 135 must belong to a thread with a range of 0 to 200), and the thread position for that thread is updated. These thread positions are stored as an array indexed the same as the ranges. The `scan` operator is used to keep track of the download progress info.

The process for resuming a download from an existing `.sud` file is similar. The only difference is in stage 1; instead of making a HEAD request and creating a meta data object, the meta data object is simply read from the file and that is what is used in subsequent stages.