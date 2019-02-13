const fs = require('graceful-fs')
const request = require('request')
import { bindNodeCallback, from } from 'rxjs'
import { map, pluck, tap, mergeMap, filter, scan, finalize, mergeAll, } from 'rxjs/operators'
import { sudPath, getRangeHeaders, createRequest } from './util'
import { partialPath, getLocalFilesize } from '../dist/util'

//the observable created from the requestHead function will emit the array [response, ''] if no error is caught
//because the parameters for the request callback are (err, response, body) and body is empty
//see https://rxjs.dev/api/index/function/bindNodeCallback for more info
const requestHead = bindNodeCallback(request.head)

export function getRemoteFilesize(url) {
	return requestHead(url).pipe(
		map(x => x[0]),
		pluck('headers', 'content-length')
	)
}

export function getMetadata(url, savePath, threads, filesize$) {
	return filesize$.pipe(
		map(filesize => {
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
			var meta = {
				url,
				savePath,
				sudPath: sudPath(savePath),
				filesize,
				ranges
			}
			return meta
		}),
		//write data to .sud meta file side effect
		tap(meta => {
			fs.writeFile(meta.sudPath, JSON.stringify(meta))
		})
	)
}

export function makeRequests(meta$, optionalHeaders) {
	return meta$.pipe(
		//calculate ranges based on existing .PARTIAL files
		//and transform the meta object into an object holding an array of request observables
		//and the meta data object
		map(meta => {
			var { url, savePath, ranges } = meta
			var rangeHeaders = getRangeHeaders(savePath, ranges)
			var request$s = new Array(rangeHeaders.length)
			rangeHeaders.forEach((rangeHeader, index) => {
				request$s[index] = createRequest(url, Object.assign(optionalHeaders || {}, { range: rangeHeader }))
			})
			return { request$s, meta }
		})
	)
}

export function getThreadPositions(requestsAndMeta$) {
	//write to buffer side effect within merge to higher-order positions observable
	return requestsAndMeta$.pipe(
		mergeMap(requestsAndMeta => {
			var { request$s, meta: { savePath, ranges } } = requestsAndMeta 
			var transformedRequest$s = request$s.map((request$, index) => {
				var partialFile = partialPath(savePath, index)
				var startPos = ranges[index][0] + getLocalFilesize(partialFile)
				var writeStream = fs.createWriteStream(partialFile, { flags: 'a', start: startPos })
				return request$.pipe(
					filter(x => x.event == 'data'),
					pluck('data'),
					tap(data => writeStream.write(data)),
					scan((position, data) => position += Buffer.byteLength(data), startPos),
					finalize(() => writeStream.end())
				)
			})
			return from(transformedRequest$s)
		}),
		//merge all position observables into one observable
		mergeAll()
	)
}