const fs = require('graceful-fs')
const request = require('request')
import { bindNodeCallback, from, of } from 'rxjs'
import { map, pluck, tap, filter, scan, finalize, mergeAll, concatMap } from 'rxjs/operators'
import { sudPath, calculateRanges, getRangeHeaders, createRequest, partialPath, getLocalFilesize  } from './util'

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

			var ranges = calculateRanges(filesize, threads)

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

//calculate ranges based on existing .PARTIAL files
//and transform the meta object into an object holding an array of request observables
//and the meta data object
export function makeRequests(meta$, optionalHeaders) {
	return meta$.pipe(
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

//write to buffer side effect within and merge to higher-order observable of thread positions
//a separate meta$ observable created from the passed meta object is concatenated to the front
//the first item emitted from the returned variable will be the meta object
export function getThreadPositions(requestsAndMeta$) {
	return requestsAndMeta$.pipe(
		concatMap(requestsAndMeta => {

			var { request$s, meta, meta: { savePath, ranges } } = requestsAndMeta

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

			var meta$ = of(meta)

			return from([meta$, ...transformedRequest$s])
		}),

		//merge all position observables into one observable
		mergeAll()
	)
}