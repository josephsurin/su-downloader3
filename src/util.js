const fs = require('graceful-fs')
const request = require('request')
import { Observable } from 'rxjs'

export const sudPath = filename => filename + '.sud'
export const partialPath = (filename, index) => `${filename}.${index}.PARTIAL` 

export function createRequest(url, headers) {
	return Observable.create(observer => {
		const req = request(url, { headers })
			.on('data', data => observer.next({ event: 'data', data }))
			.on('error', e => observer.error(e))
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
	var rangeHeaders = new Array(ranges.length)
	ranges.forEach((range, index) => {
		var position = getLocalFilesize(partialPath(savePath, index))
		rangeHeaders[index] = toRangeHeader(range, position)
	})
	return rangeHeaders
}