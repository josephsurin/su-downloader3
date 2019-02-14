const fs = require('graceful-fs')
const request = require('request')
import { Observable, range, bindNodeCallback, of } from 'rxjs'
import { map, concatMap } from 'rxjs/operators'

export const sudPath = filename => filename + '.sud'
export const partialPath = (filename, index) => `${filename}.${index}.PARTIAL` 

export function createRequest(url, requestOptions) {
	return Observable.create(observer => {
		const req = request(url, requestOptions)
			.on('data', data => observer.next(data))
			.on('error', error => observer.error(error))
			.on('complete', () => observer.complete())

		//clean up function called when unsubscribed
		return () => req.abort()
	})
}

export const getLocalFilesize = filename => fs.existsSync(filename) ? fs.statSync(filename).size : 0

//takes a file size and the number of partial files (threads) to be used
//and calculates the ranges in bytes for each thread
export function calculateRanges(filesize, threads) {
	var ranges = new Array(threads)

	if(threads == 1) {
		ranges = [[0, filesize]]
	} else {
		var partitionSize = Math.floor(filesize / threads)
		ranges[0] = [0, partitionSize]
		for(var i = 1; i < threads - 1; i++) {
			ranges[i] = [(partitionSize * i) + 1, partitionSize * (i + 1)]
		}
		ranges[threads - 1] = [ranges[threads - 2][1] + 1, filesize]
	}

	return ranges
}

//position starts counting at 0, i.e. the size of the .PARTIAL file
export function toRangeHeader(range, position) {
	var start = range[0] + position
	var end = range[1]
	return `bytes=${start}-${end}`
}

export function getRangeHeaders(savePath, ranges) {
	return ranges.map((range, index) => {
		var position = getLocalFilesize(partialPath(savePath, index))
		return range[0] + position >= range[1] ? 0 : toRangeHeader(range, position)
	})
}


const fsReadFile = bindNodeCallback(fs.readFile)
const fsAppendFile = bindNodeCallback(fs.appendFile)
const fsUnlink = bindNodeCallback(fs.unlink)

//concatenates all .PARTIAL files and renames the resulting file
//cleans up by deleting .PARTIAL files and .sud meta data file
export function rebuildFiles(savePath, numPartials) {
	var sudFile = sudPath(savePath)

	range(0, numPartials).pipe(
		map(index => partialPath(savePath, index)),
		//transform each partial file name into an observable that when subscribed to appends data to
		//the save file and deletes it
		//concatMap ensures this is done in order
		concatMap(partialFile => 
			of(partialFile).pipe(
				concatMap(partialFile => fsReadFile(partialFile)),
				concatMap(partialData => fsAppendFile(savePath, partialData)),
				concatMap(() => fsUnlink(partialFile))
			)
		)
	).subscribe(() => {}, console.log)

	fs.unlinkSync(sudFile)
}